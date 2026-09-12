# checkly-astronomy

Checkly **monitoring-as-code** (MaC) for the OpenTelemetry **Astronomy Shop** demo.

## Status: intentionally empty

There is no scaffolding here yet, and that is deliberate. Project setup — `checkly init`,
`checkly.config.ts`, the private location, the agent container — is being done by hand.

**Do not run `npx checkly init` or generate check files unprompted.** Ask first.

## Target application

The OTel Astronomy Shop demo, cloned at `../opentelemetry-demo` and already running
under docker compose (full stack: `compose.yaml` + `full` + `observability` +
`extras` + `agent`). See `ARCHITECTURE.html` for the shop topology and
`MCP-ARCHITECTURE.html` for the agent/MCP layer.

**Prefer the `:8080` routes.** Envoy fronts most UIs on the always-stable app port,
so these never move:

| What | Where |
|---|---|
| App | http://localhost:8080 |
| Grafana | http://localhost:8080/grafana/ |
| Jaeger UI | http://localhost:8080/jaeger/ui |
| Load generator (Locust) | http://localhost:8080/loadgen/ |
| flagd UI | http://localhost:8080/feature |
| Telemetry docs | http://localhost:8080/telemetry/ |
| Chatbot (Gradio) | http://localhost:8080/chatbot/ |

Envoy has **no** route for the MCP server, OpenSearch or Prometheus, so those need
direct ports — pinned by `compose.ports.yaml` (Prometheus pins itself upstream):

| What | Where |
|---|---|
| MCP server | http://localhost:8011/mcp |
| OpenSearch | http://localhost:9200 |
| Prometheus | http://localhost:9090 |
| Grafana (direct) | :3000 · Jaeger (direct) :16686 — handy for API calls |
| Envoy admin | :10000 |

Anything *not* pinned and *not* behind Envoy gets a **new random host port on every
recreation** — the demo declares them host-side-less (`ports: ["${GRAFANA_PORT}"]`).
Grafana was observed moving 51903 → 60682 → 61391 in a single session. If a direct
port ever stops answering, re-resolve it with `docker port <service> <container-port>`
rather than assuming an outage.

**BFF routes** — `src/frontend/pages/api/`:
`/api/products` · `/api/cart` · `/api/checkout` · `/api/currency` ·
`/api/recommendations` · `/api/shipping` · `/api/data`

**Stable product IDs** for assertions — seeded in `src/postgresql/init.sql`:

| ID | Name |
|---|---|
| `OLJCESPC7Z` | National Park Foundation Explorascope |
| `66VCHSJNUP` | Starsense Explorer Refractor Telescope |
| `L9ECAV7KIM` | Lens Cleaning Kit |
| `HQTGWGPNH4` | The Comet Book |

## Running the stack

Everything needed to run the demo correctly lives **in the demo repo**, not here.
The demo's entry point is its **Makefile**, not a compose invocation:

```bash
cd ../opentelemetry-demo
make start-checkly     # the whole stack + agent/MCP + log retention
make stop              # tears everything down
```

`make start-checkly` = `start-agentic` plus the retention policy. Use it rather
than hand-rolling `docker compose -f ... -f ...`; the Makefile carries the right
file list, the `--env-file .env --env-file .env.override` pair, and the local
overrides below.

| File (demo repo) | Does |
|---|---|
| `compose.memory.yaml` | Raises memory caps on 21 services |
| `compose.ports.yaml` | Pins MCP, Grafana, Jaeger, OpenSearch host ports |
| `opensearch-log-retention.sh` | ISM policy: delete `otel-logs-*` after 1 day |
| `Makefile` → `DOCKER_COMPOSE_FILES_LOCAL` | Wires the two compose files into every target |

The Makefile wiring matters: without it, `make start` would silently bring the
stack up on upstream's caps and ephemeral ports, discarding all of the above.
Opt out deliberately with `make start-agentic DOCKER_COMPOSE_FILES_LOCAL=`.

**Do not add a `docker-compose.yml`.** Compose resolves `compose.yaml` with higher
precedence, so a second entry point is silently ignored with only a warning
(verified). The Makefile is the single source of truth.

`compose.memory.yaml` exists because upstream tunes the caps so tight that several
services run permanently against the ceiling — `flagd` at 98%, `accounting` 95%,
`kafka` 94% — and Grafana at 175M thrashed its GC hard enough to burn ~11 cores
and serve API calls in 67s (0.1s after the bump). None of this is Checkly work;
it is just the basis for running things correctly locally.

**OpenSearch has no volume.** Its log data *and* the ISM retention policy live in
the container layer, so `docker compose up` wipes both — re-run the script after.
Log history never survives a restart, independent of retention.

**Watch the disk, not the logs.** On 2026-09-12 logs silently stopped for ~12h:
the Docker VM hit 97%, OpenSearch crossed its flood-stage watermark and set
`index.blocks.read_only_allow_delete`, so the collector dropped every record with
"sending queue is full". The culprit was Docker build cache + images (54 GB), not
log volume (1 MB). `docker builder prune -f` freed 11.1 GB and it recovered.
Logs grow at only ~0.78 GiB/day.

## Checkly cannot reach `localhost`

This is the one thing that will silently waste an afternoon.

Checkly's public checkers run in Checkly's cloud, outside this machine. A check written as

```ts
locations: ['us-east-1'], url: 'http://localhost:8080'   // ❌ fails 100% of the time
```

is unreachable by design, and the failure looks like an app outage rather than a config error.

To monitor the local demo, run a **Private Location + Checkly Agent** container on the
demo's Docker network and target it by slug instead of by region:

```ts
privateLocations: ['<slug>']   // ✅ instead of locations: [...]
```

```bash
docker run -e API_KEY="pl_..." -d checkly/agent:latest
```

From *inside* the agent container the app is `frontend-proxy:8080` — not `localhost:8080`.

Playwright Check Suites need Checkly Agent **6.0.3+** and an agent container with
**≥2 CPU / 4 GB RAM**.

## Selector convention

The demo already has Cypress specs in `src/frontend/cypress/e2e/`. They select via
`[data-cy="..."]`, wrapped in `getElementByField(CypressFields.X)`
(`src/frontend/utils/Cypress.ts`), with names enumerated in
`src/frontend/utils/enums/CypressFields.ts`:

`product-card` · `product-list` · `product-price` · `cart-icon` · `cart-item-count` ·
`cart-go-to-shopping` · `checkout-place-order` · `checkout-item` · `currency-switcher`

**Reuse these in browser checks** rather than inventing selectors — they are maintained
by the demo and survive its UI changes.

`src/frontend/cypress/e2e/Checkout.cy.ts` already walks the happy path
(home → product → add to cart → place order) and is the model for a checkout browser check.

## Checkly CLI

```bash
npx checkly init      # scaffold (not yet run here — by hand)
npx checkly login
npx checkly test      # dry-run checks
npx checkly deploy    # push to Checkly
```

Constructs: `ApiCheck`, `BrowserCheck`, `PlaywrightCheck`, `MultiStepCheck`, `CheckGroup`,
alert channels (`EmailAlertChannel`, `SlackAlertChannel`, `WebhookAlertChannel`), and
`defineConfig` in `checkly.config.ts`.

## MCP server (`astronomy-shop`)

The demo ships its own MCP server. `.mcp.json` in this repo points at it:

```json
{ "mcpServers": { "astronomy-shop": { "type": "http", "url": "http://localhost:8011/mcp" } } }
```

- **Service**: `src/mcp`, Python 3.14 + [FastMCP](https://github.com/jlowin/fastmcp),
  streamable HTTP transport at `/mcp`, server name `astronomy-shop-mcp`.
- **Only exists with the agent layer** — `agent`, `mcp` and `chatbot` are defined in
  `compose.agent.yaml`, not `compose.yaml`.
- **Tools only.** It advertises `prompts` and `resources` capabilities, but both list
  empty — those are FastMCP defaults. Ten tools, registered explicitly in
  `astronomy_shop_mcp_server.py`.

**Port is pinned by us.** `compose.agent.yaml` declares `ports: ["${MCP_PORT}"]` with no
host side, so Docker assigns a *new ephemeral port on every restart*. `compose.ports.yaml`
pins it to `8011:8011`, along with Grafana, Jaeger and OpenSearch.

If the URL ever stops working, `docker port mcp 8011` shows the current mapping.
Envoy has **no** `/mcp` route — `/chatbot/` reaches the Gradio UI, not the MCP server.

### The MCP_ENABLED toggle

The agent takes its tools from one of two places (`src/agent/src/agents/agents.py`):

| `MCP_ENABLED` | Agent tool source |
|---|---|
| `False` *(demo default, and what is running)* | LangChain `@tool` functions bound in-process |
| `True` | MCP session to `mcp:8011/mcp`, adapted by `load_mcp_tools()` |

Both paths serve **the same ten tools** — `src/shared/tools.py` is `COPY`ed into both the
`agent` and `mcp` images at build time. So the MCP server is a swappable *delivery
mechanism*, not a different feature set. The container runs either way; with
`MCP_ENABLED=False` the agent simply never calls it.

### Why this matters for the Checkly work

Every MCP tool is a thin wrapper over the same `/api/*` BFF routes the checks target:

| Tool | Calls |
|---|---|
| `list_products` / `get_product` | `/api/products`, `/api/products/{id}` |
| `add_to_cart` / `get_cart` / `empty_cart` | `/api/cart` |
| `checkout` | `/api/checkout` |
| `get_recommendations` | `/api/recommendations` |
| `get_shipping_quote` | `/api/shipping` |
| `get_supported_currencies` | `/api/currency` |
| `get_ads` | `/api/data` |

So the MCP server is a convenient way to *exercise and inspect* the exact endpoints the
API checks will monitor — drive a cart or a checkout through it, then assert the same
routes from Checkly.

**Note on the demo's own docs**: `src/mcp/README.md` is stale in two places — it says mcp
`depends_on: agent` (the reverse is true) and that the Dockerfile copies
`src/agent/src/agents/tools.py` (it copies `src/shared/tools.py`).
