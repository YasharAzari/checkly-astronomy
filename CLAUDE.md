# checkly-astronomy

Checkly **monitoring-as-code** (MaC) for the OpenTelemetry **Astronomy Shop** demo.

## Target application

The OTel Astronomy Shop demo, cloned at `../opentelemetry-demo` and already running
under docker compose (full stack: `compose.yaml` + `full` + `observability` +
`extras` + `agent`).

**All documentation about the demo lives in [`docs/`](docs/)** — it describes the system
under test, not our checks. Start at [`docs/README.md`](docs/README.md):

| Doc | Covers |
|---|---|
| `docs/01-stack-architecture.md` | 31 services, languages, ports, dependency graph, flagd fault injection |
| `docs/02-telemetry-pipeline.md` | Collector receivers/exporters, the three backends, Grafana, known failure modes |
| `docs/03-public-endpoints.md` | **The synthetic-test surface** — every customer-reachable URL, contracts, measured baselines |
| `docs/04-agent-mcp-chatbot.md` | Agent/MCP/chatbot, the `MCP_ENABLED` toggle, and the VCR-replay LLM story |
| `docs/diagrams/*.html` | Rendered diagrams; sources in `docs/diagrams/src/` |

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

## MCP server (`astronomy-shop`)

`.mcp.json` in this repo points at the demo's own MCP server:

```json
{ "mcpServers": { "astronomy-shop": { "type": "http", "url": "http://localhost:8011/mcp" } } }
```

Ten tools, each a thin wrapper over the same `/api/*` BFF routes the checks target —
so it is a convenient way to *drive* those endpoints while building checks.

**Full detail in [`docs/04-agent-mcp-chatbot.md`](docs/04-agent-mcp-chatbot.md)**: the
`MCP_ENABLED=False` default (the agent never calls the MCP server as shipped), the
VCR-replay LLM story, and two real bugs in the shared tool layer.
