# 03 — Public endpoints (customer perspective)

**This is the synthetic-test surface.** Everything here is reachable through the Envoy
gateway — the door a real customer comes through. Nothing below requires access to the
Docker network.

> **From a Checkly checker, the host is not `localhost`.** Public Checkly runners live
> in Checkly's cloud and cannot reach this machine at all. Checks must run on a Private
> Location, and from inside the agent container the gateway is **`frontend-proxy:8080`**,
> never `localhost:8080`. A check written against `localhost` fails 100% of the time and
> the failure reads like an app outage.
>
> Base URL in this doc is written `{BASE}`. Locally that is `http://localhost:8080`;
> from the agent it is `http://frontend-proxy:8080`.

## Envoy route table — the complete public surface

Source of truth: `src/frontend-proxy/envoy.tmpl.yaml`. Order matters; `/` is the
catch-all and stays last.

| Route | Cluster | Customer surface? |
|---|---|---|
| `/` (catch-all) | `frontend` | ✅ **Yes** — the storefront |
| `/images/` | `image-provider` | ✅ **Yes** — product images |
| `/feature` | `flagd-ui` | ❌ Operator — flag editor |
| `/flagservice/` | `flagd` | ❌ Internal — flag evaluation |
| `/grafana/` | `grafana` | ❌ Operator |
| `/jaeger/` | `jaeger` | ❌ Operator |
| `/loadgen/` | `load-generator` | ❌ Operator — Locust UI |
| `/opamp/` | `opamp-server` | ❌ Operator |
| `/telemetry/` | `telemetry-docs` | ❌ Operator — Weaver docs |
| `/chatbot/` | `chatbot` | ⚠️ Present but **not linked from the storefront** — see [04](04-agent-mcp-chatbot.md) |
| `/otlp-http/` | `otel-collector` | ❌ Telemetry ingest (browser RUM) |
| `/profiles/` | `firepit` | ❌ Only with `compose.profiling.yaml` |

**There is no `/mcp` route and no `/opensearch` route.** Those are reachable only on
direct host ports, which is why `compose.ports.yaml` pins them.

So the genuine customer surface is exactly two branches: **`/` and `/images/`.**

## Customer-visible pages — browser check targets

| Page | Route | What a customer does |
|---|---|---|
| Home | `{BASE}/` | Browse product grid, see ads, switch currency |
| Product detail | `{BASE}/product/{productId}` | View one product, add to cart |
| Cart | `{BASE}/cart` | Review items, proceed to checkout |
| Order confirmation | `{BASE}/cart/checkout/{orderId}` | Confirmation after placing an order |
| Errors | `{BASE}/404`, `{BASE}/500` | — |

That is the whole storefront. The happy path is
**home → product → add to cart → cart → place order → confirmation**, and the demo's
own Cypress spec `src/frontend/cypress/e2e/Checkout.cy.ts` already walks exactly that.

### Use the demo's selectors, don't invent your own

The frontend ships `data-cy` attributes, enumerated in
`src/frontend/utils/enums/CypressFields.ts`. They are maintained by the demo and
survive its UI changes:

`product-card` · `product-list` · `product-price` · `cart-icon` · `cart-item-count` ·
`cart-go-to-shopping` · `checkout-place-order` · `checkout-item` · `currency-switcher`

Select with `[data-cy="product-card"]`. Inventing CSS/text selectors against a UI you
don't own is how browser checks become flaky.

## BFF API — `{BASE}/api/*`

Next.js API routes inside the `frontend` container. These are what the browser itself
calls, so asserting on them is asserting on real customer traffic — not a synthetic
side-channel.

All return `405` on an unsupported method.

### `GET /api/products`

| | |
|---|---|
| Query | `currencyCode` (optional) |
| Returns | `200` — array of products |

```bash
curl "{BASE}/api/products"
```

Each product: `id`, `name`, `description`, `picture`, `priceUsd {currencyCode, units, nanos}`, `categories[]`.

**Stable IDs, safe to hard-code** (seeded in `src/postgresql/init.sql`):

| ID | Name | Price |
|---|---|---|
| `OLJCESPC7Z` | National Park Foundation Explorascope | $101.96 |
| `66VCHSJNUP` | Starsense Explorer Refractor Telescope | $349.95 |
| `L9ECAV7KIM` | Lens Cleaning Kit | $21.95 |
| `HQTGWGPNH4` | The Comet Book | $0.99 |

Ten products total. A count assertion of exactly 10 is reasonable but will break if
upstream adds one — assert `>= 10`, or assert on the known IDs being present.

### `GET /api/products/{productId}`

| | |
|---|---|
| Query | `currencyCode` (optional) |
| Returns | `200` — single product |

```bash
curl "{BASE}/api/products/OLJCESPC7Z"
```

### `GET /api/cart`

| | |
|---|---|
| Query | **`sessionId`** (required), `currencyCode` |
| Returns | `200` — `{userId, items[]}` with each item hydrated with its `product` |

```bash
curl "{BASE}/api/cart?sessionId=my-check-session"
```

> ⚠️ **The parameter is `sessionId`, not `userId`.** Passing `user_id` or `userId`
> returns `{"userId":"","items":[]}` — an empty cart, HTTP 200, **no error**. This
> silently passes a naive assertion. It is also a real bug in the demo's own MCP tool
> (see [04](04-agent-mcp-chatbot.md)).

### `POST /api/cart`

| | |
|---|---|
| Body | `{"item": {"productId": "...", "quantity": N}, "userId": "..."}` |
| Returns | `200` — the updated cart |

```bash
curl -X POST "{BASE}/api/cart" -H 'Content-Type: application/json' \
  -d '{"item":{"productId":"OLJCESPC7Z","quantity":2},"userId":"my-check-session"}'
```

Note the asymmetry: **POST takes `userId` in the body; GET takes `sessionId` in the
query.** Same identity, two names.

### `DELETE /api/cart`

| | |
|---|---|
| Body | `{"userId": "..."}` |
| Returns | `204` |

Useful for check teardown so sessions don't accumulate.

### `POST /api/checkout`

The highest-value endpoint — transitively exercises seven services.

| | |
|---|---|
| Query | `currencyCode` |
| Body | `{userId, userCurrency, email, address{...}, creditCard{...}}` |
| Returns | `200` — order; `422` `PAYMENT_FAILED`; `500` otherwise |

```bash
curl -X POST "{BASE}/api/checkout?currencyCode=USD" -H 'Content-Type: application/json' -d '{
  "userId": "my-check-session",
  "userCurrency": "USD",
  "email": "check@example.com",
  "address": {"streetAddress":"1600 Amphitheatre Parkway","city":"Mountain View",
              "state":"CA","country":"USA","zipCode":"94043"},
  "creditCard": {"creditCardNumber":"4432-8015-6152-0454","creditCardCvv":672,
                 "creditCardExpirationYear":2030,"creditCardExpirationMonth":1}
}'
```

Response carries `orderId`, `shippingTrackingId`, `shippingCost`, `shippingAddress`,
`items[]`. Good assertions: `orderId` present and UUID-shaped, `items` non-empty,
`shippingCost.units >= 0`.

**Requires a non-empty cart** — POST to `/api/cart` first, in the same check, with the
same identity. The cart is emptied on success, so the check is naturally idempotent.

**`422` is a *correct* response, not an outage.** The demo injects payment declines via
the `paymentFailure` flag, and the handler distinguishes a decline
(`422 PAYMENT_FAILED`) from an internal error (`500`). A check that treats any non-2xx
as failure will alarm on a deliberately-simulated decline. Decide which you want — and
be able to explain the distinction.

### `GET /api/currency`

Returns `200` — array of 33 ISO-4217 codes. Fastest endpoint in the stack (~4 ms) and
has no downstream dependencies, which makes it the cleanest **gateway-liveness** probe:
if this is slow, the problem is Envoy or the frontend, not a backend.

### `GET /api/recommendations`

| | |
|---|---|
| Query | `productIds`, `sessionId`, `currencyCode` |
| Returns | `200` — array of recommended products |

**The flakiest endpoint.** Give it a generous timeout — see baselines below.

### `GET /api/shipping`

| | |
|---|---|
| Query | `itemList` (JSON-encoded array), `currencyCode`, `address` (JSON-encoded object) |
| Returns | `200` — `{currencyCode, units, nanos}` |

```bash
curl -G "{BASE}/api/shipping" \
  --data-urlencode 'itemList=[{"productId":"OLJCESPC7Z","quantity":2}]' \
  --data-urlencode 'currencyCode=USD' \
  --data-urlencode 'address={"streetAddress":"1600 Amphitheatre Parkway","city":"Mountain View","state":"CA","country":"USA","zipCode":"94043"}'
```

Both `itemList` and `address` are **JSON encoded inside query parameters** — a common
source of malformed-request errors.

### `GET /api/data`

| | |
|---|---|
| Query | `contextKeys` (e.g. `telescopes`, `travel`) |
| Returns | `200` — ads |

Named `/api/data`, not `/api/ads`.

## Measured latency baselines

Taken on this machine through Envoy, healthy stack, load generator running. Use as a
starting point; re-derive from Prometheus (7-day window) before committing thresholds.

| Endpoint | Observed | Suggested timeout | Note |
|---|---|---|---|
| `GET /api/currency` | **4 ms** | 2 s | No downstream deps |
| `GET /api/products` | **5 ms** | 2 s | |
| `GET /api/data` | **6 ms** | 2 s | |
| `GET /api/products/{id}` | **683 ms** | 5 s | Single-product path far slower than the list |
| `GET /api/cart` | ~10 ms | 3 s | |
| `GET /api/shipping` | ~50 ms | 5 s | Two hops: shipping → quote |
| `POST /api/checkout` | **~1.1 s** | **15 s** | Seven-service fan-out |
| `GET /api/recommendations` | **0.35 – 3.1 s**, observed **504 at 15 s** | **20 s** | See below |

**Do not apply a uniform timeout.** The spread is three orders of magnitude, and being
able to justify per-route budgets is more defensible than one global number.

On `/api/recommendations`: the 504 was real but transient, coinciding with
`product-catalog` restarting — it hydrates results through that service, so it inherits
its instability. Treat a single failure as inconclusive; alert on consecutive failures.

## Suggested check portfolio

A defensible spread, cheapest and most diagnostic first:

| # | Type | Target | Proves |
|---|---|---|---|
| 1 | API | `GET /api/currency` | Gateway + frontend alive. Fast, zero deps — the canary |
| 2 | API | `GET /api/products` | Catalog + PostgreSQL; assert known IDs present |
| 3 | API | `GET /api/products/OLJCESPC7Z` | Single-product path (separately slow) |
| 4 | Multi-step | `POST /api/cart` → `GET /api/cart?sessionId=` → `POST /api/checkout` → `DELETE /api/cart` | The money path, seven services, self-cleaning |
| 5 | API | `GET /api/recommendations` | Known-flaky; loose threshold, consecutive-failure alerting |
| 6 | Browser | home → product → add to cart → place order | Real customer journey; `[data-cy]` selectors |
| 7 | API | `GET /images/...` | Static asset delivery via `image-provider` |

Checks 1–3 isolate *layers*; check 4 proves *integration*; check 6 proves the *UI*
actually works, which no API check can.

### Proving the checks detect something

Don't demo against a permanently-green system. Flip a flagd flag at `{BASE}/feature`,
show the check go red, flip it back:

| Flag | Should trip |
|---|---|
| `productCatalogFailure` | checks 2, 3, 4, 6 |
| `paymentFailure` | check 4 (as `422`) and 6 |
| `cartFailure` | check 4 |
| `imageSlowLoad` | checks 6, 7 |
| `recommendationCacheFailure` | check 5 |

This is the demo's intended purpose and is far more convincing than green dashboards.

## Operator surface — deliberately excluded

Reachable through the gateway, but a customer never sees it. Monitoring it would inflate
the check count without reflecting customer experience.

`{BASE}/grafana/` · `{BASE}/jaeger/ui` · `{BASE}/loadgen/` · `{BASE}/feature` ·
`{BASE}/telemetry/` · `{BASE}/opamp/`

Direct host ports (not via Envoy, pinned by `compose.ports.yaml`):
MCP `:8011` · OpenSearch `:9200` · Prometheus `:9090` · Grafana `:3000` · Jaeger `:16686`

Being explicit about *why* these are out of scope is worth as much as the checks
themselves.
