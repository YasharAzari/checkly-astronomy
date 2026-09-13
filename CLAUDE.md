# checkly-astronomy

Checkly **monitoring-as-code** (MaC) for the OpenTelemetry **Astronomy Shop** demo.

## Status: intentionally empty

There is no scaffolding here yet, and that is deliberate. Project setup — `checkly init`,
`checkly.config.ts`, the private location, the agent container — is being done by hand.

**Do not run `npx checkly init` or generate check files unprompted.** Ask first.

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

Reuse the demo's own `[data-cy="..."]` attributes rather than inventing selectors — they
are maintained by the demo and survive its UI changes. Names and the Cypress happy-path
spec to model a browser check on are listed in
[`docs/03-public-endpoints.md`](docs/03-public-endpoints.md).

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

`.mcp.json` in this repo points at the demo's own MCP server:

```json
{ "mcpServers": { "astronomy-shop": { "type": "http", "url": "http://localhost:8011/mcp" } } }
```

Ten tools, each a thin wrapper over the same `/api/*` BFF routes the checks target —
so it is a convenient way to *drive* those endpoints while building checks.

**Full detail in [`docs/04-agent-mcp-chatbot.md`](docs/04-agent-mcp-chatbot.md)**: the
`MCP_ENABLED=False` default (the agent never calls the MCP server as shipped), the
VCR-replay LLM story, and two real bugs in the shared tool layer.

⚠️ **Do not use the `get_cart` tool to verify state.** It sends `user_id` where the BFF
reads `sessionId`, so it always returns an empty cart with HTTP 200. Query
`http://localhost:8080/api/cart?sessionId=…` directly instead.
