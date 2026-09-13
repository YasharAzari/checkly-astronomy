# 01 — Stack architecture

31 services. Polyglot by design: the demo exists to show OpenTelemetry working
across languages, so the language spread is the point, not an accident.

## The one entry point

```
                         ┌──────────────────────────────┐
   customer / Locust ───▶│  frontend-proxy  (Envoy)     │ :8080   ← the ONLY public door
                         └──────────────┬───────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬────────────────┐
        ▼               ▼               ▼               ▼                ▼
    frontend        image-provider   flagd-ui      observability      chatbot
    (Next.js)        /images/        /feature/     /grafana/ /jaeger/  /chatbot/
        │                                          /loadgen/ /opamp/
        │  BFF routes: /api/*
        ▼
   internal gRPC / HTTP mesh  (not reachable from outside)
```

Everything a customer touches goes through Envoy on `:8080`. Nothing else is
published to the host except operator conveniences (see
[03-public-endpoints.md](03-public-endpoints.md)).

## Service inventory

### Storefront path — what a customer's request touches

| Service | Language | Address | Protocol | Role |
|---|---|---|---|---|
| `frontend-proxy` | Envoy (C++) | `:8080`, admin `:10000` | HTTP | Reverse proxy; the public gateway |
| `frontend` | TypeScript / Next.js | `frontend:8080` | HTTP | UI **and** BFF (`/api/*`); generates session IDs |
| `product-catalog` | Go | `product-catalog:3550` | gRPC | Product list / lookup / search |
| `cart` | .NET | `cart:7070` | gRPC | Cart state |
| `checkout` | Go | `checkout:5050` | gRPC | **Orchestrator** — the fan-out point |
| `currency` | C++ | `currency:7001` | gRPC | Conversion, ECB rates |
| `recommendation` | Python | `recommendation:9001` | gRPC | Related products |
| `ad` | Java | `ad:9555` (+ `:9465` Prom) | gRPC | Contextual ads |
| `shipping` | Rust | `shipping:50050` | **HTTP** | Shipping quote + tracking ID |
| `quote` | PHP | `quote:8090` | **HTTP** | Cost calculation, called by shipping |
| `payment` | JavaScript | `payment:50051` | gRPC | Mock card charge |
| `email` | Ruby | `email:6060` | **HTTP** | Order confirmation |

Note the protocol mix: **`shipping`, `quote` and `email` are HTTP, not gRPC**, despite
sitting alongside gRPC services. Easy to get wrong when reasoning about failures.

### Asynchronous path — post-order processing

| Service | Language | Address | Role |
|---|---|---|---|
| `kafka` | Java | `kafka:9092` | Message queue |
| `accounting` | .NET | — | Consumes orders, sums revenue, reads PostgreSQL |
| `fraud-detection` | Kotlin | — | Consumes orders, flags fraud |

`checkout` publishes to Kafka **after** the order is placed. Both consumers are
downstream of the customer response — a customer-facing check will *never* observe
their failure. Worth stating explicitly: a synthetic checkout can pass green while
accounting is completely broken.

### Data stores

| Service | Engine | Address | Holds | Durable? |
|---|---|---|---|---|
| `astronomy-db` | PostgreSQL 18.4 | `:5432` | Product catalog | Seeded from `src/postgresql/init.sql` |
| `valkey-cart` | Valkey 9.0.4 | `valkey-cart:6379` | Cart contents | In-memory cache |

### Platform / control

| Service | Language | Address | Role |
|---|---|---|---|
| `flagd` | Go | `:8013` gRPC, `:8016` OFREP | Feature flags — **the fault-injection mechanism** |
| `flagd-ui` | Elixir | `:4000` | Flag editor UI |
| `image-provider` | nginx | `:8081` | Static product images |
| `load-generator` | Python / Locust | `:8089` | Simulated shoppers |
| `opamp-server` | Go | — | Receives collector health over WebSocket |
| `telemetry-docs` | — | `:8000` | Weaver-generated telemetry docs |

### Observability — see [02-telemetry-pipeline.md](02-telemetry-pipeline.md)

`otel-collector` · `jaeger` · `prometheus` · `opensearch` · `grafana`

### Agent layer — see [04-agent-mcp-chatbot.md](04-agent-mcp-chatbot.md)

`agent` · `mcp` · `chatbot`. **Only present with `compose.agent.yaml`**, and not
wired into the storefront UI.

## Request dependency graph

```
frontend ──gRPC──▶ product-catalog ──SQL──▶ astronomy-db
         ──gRPC──▶ cart ────────────────▶ valkey-cart
         ──gRPC──▶ currency
         ──gRPC──▶ recommendation ──gRPC──▶ product-catalog   ← hydrates results
         ──gRPC──▶ ad
         ──HTTP──▶ shipping ──HTTP──▶ quote
         ──gRPC──▶ checkout
                      │
                      ├──gRPC──▶ cart              (read, then empty)
                      ├──gRPC──▶ product-catalog
                      ├──gRPC──▶ currency
                      ├──HTTP──▶ shipping
                      ├──gRPC──▶ payment
                      ├──HTTP──▶ email
                      └──TCP───▶ kafka ──▶ accounting
                                        └▶ fraud-detection

flagd ◀── consulted by: frontend, cart, recommendation, fraud-detection, ad, payment
```

### Why `checkout` is the highest-value check target

It is the only service that fans out to **seven** dependencies synchronously. A single
successful checkout transitively proves cart, product-catalog, currency, shipping,
quote, payment and email are all alive. Nothing else in the stack has that blast radius.

### Why `recommendation` is the flakiest

`recommendation` calls back into `product-catalog` to hydrate each result. That makes
its latency the sum of two hops plus fan-out, and it is measurably the least stable
endpoint in the stack — observed between **0.35 s and 3.1 s, with a 504 at 15 s**,
against 4–5 ms for `/api/currency` and `/api/products`. Budget for it separately.

## Failure injection — flagd

`flagd` is how the demo breaks itself on purpose. All flags default to `off`
(`src/flagd/demo.flagd.json`); toggle them at `:8080/feature`.

| Flag | Effect |
|---|---|
| `productCatalogFailure` | `product-catalog` fails on one product ID |
| `cartFailure` | `cart` `EmptyCart` fails |
| `paymentFailure` / `paymentUnreachable` | payment errors / hangs |
| `adFailure`, `adHighCpu`, `adManualGc` | ad service degradation |
| `recommendationCacheFailure` | memory leak + latency growth |
| `kafkaQueueProblems` | queue backpressure |
| `emailMemoryLeak`, `intlShippingSlowdown` | as named |
| `imageSlowLoad` | slow static images — front-end timing |
| `loadGeneratorFloodHomepage` | traffic spike |
| `failedReadinessProbe` | container reports unready |
| `productCatalogLockContention` | lock contention |

**This is the demo's built-in way to prove a check actually detects something.** Flip
a flag, watch the check go red, flip it back. Far more convincing than asserting on a
permanently-green system — and it is the intended use of the demo.

Verify current state rather than assuming: the file is the live state, and the UI
writes back to it.

## Facts worth not re-deriving

- **`frontend` is both UI and API.** `/api/*` is Next.js API routes in the same
  container — a BFF, not a separate service. Killing it takes out both.
- **Product IDs are seeded and stable** — safe to hard-code in assertions:
  `OLJCESPC7Z` (Explorascope), `66VCHSJNUP` (Starsense), `L9ECAV7KIM` (Lens Kit),
  `HQTGWGPNH4` (The Comet Book).
- **`product-catalog` ships a 20 MB memory cap upstream** and fails its health probe
  under it. Raised to 128 MB locally — see `compose.memory.yaml` in the demo repo.
- **Cart identity is a `sessionId`**, generated by the frontend. The BFF reads
  `sessionId` from the query string on GET but takes `userId` in the POST body — an
  asymmetry that has already caused one real bug (see
  [04-agent-mcp-chatbot.md](04-agent-mcp-chatbot.md)).
