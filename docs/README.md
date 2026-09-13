# Documentation — OpenTelemetry Astronomy Shop (monitoring target)

Everything in `docs/` describes the **system under test**: the OpenTelemetry
Astronomy Shop demo, cloned at `../opentelemetry-demo`. None of it describes the
Checkly checks themselves — those live at the repository root once written.

The demo is the *base*. We treat it as a black box owned by someone else, and
monitor it the way a real customer experiences it: through the Envoy gateway on
`http://localhost:8080`.

## Reading order

| Doc | Covers | Read it when |
|---|---|---|
| [01-stack-architecture.md](01-stack-architecture.md) | All 31 services, languages, ports, the request dependency graph | You need to know what calls what, and what breaks when something fails |
| [02-telemetry-pipeline.md](02-telemetry-pipeline.md) | Collector receivers/exporters, Jaeger, Prometheus, OpenSearch, Grafana | You are interpreting a check failure, or asking "is it the app or the monitoring?" |
| [03-public-endpoints.md](03-public-endpoints.md) | **The synthetic-test surface.** Every URL a customer can reach, with contracts and measured baselines | You are writing a check |
| [04-agent-mcp-chatbot.md](04-agent-mcp-chatbot.md) | The agent / MCP / chatbot layer, and whether it needs a real LLM | You are deciding whether the chatbot is in scope |
| [openapi/](openapi/) | **OpenAPI 3.1 spec** for the public BFF API, plus a browsable offline reference | You want machine-readable contracts, or to scaffold checks from a spec |

## Diagrams

| File | What |
|---|---|
| [diagrams/ARCHITECTURE.html](diagrams/ARCHITECTURE.html) | **Request paths** — browser → Envoy → frontend → services → stores |
| [diagrams/TELEMETRY.html](diagrams/TELEMETRY.html) | **Telemetry pipeline** — collector ingest, the three backends, Grafana as reader |
| [diagrams/MCP-ARCHITECTURE.html](diagrams/MCP-ARCHITECTURE.html) | The agent / MCP / chatbot layer in detail |
| `diagrams/src/*.archify.json` | Diagram **sources**. Edit these, then re-render — never hand-edit the HTML |
| `diagrams/visual-check/` | Rendered QA screenshots. Regenerable, git-ignored |

Re-render after editing a source:

```bash
node .agents/skills/archify/bin/archify.mjs validate architecture docs/diagrams/src/telemetry.archify.json
node .agents/skills/archify/bin/archify.mjs render  architecture docs/diagrams/src/telemetry.archify.json \
     docs/diagrams/TELEMETRY.html --quality showcase
```

## Scope note

Three things in this stack are **deliberately not monitored** by the planned checks,
and each has a reason recorded in the docs above:

- **The chatbot / agent / MCP layer** — not wired into the storefront UI at all, and
  the agent runs on replayed LLM fixtures rather than a live model. See
  [04-agent-mcp-chatbot.md](04-agent-mcp-chatbot.md).
- **The observability UIs** (Grafana, Jaeger, flagd UI, Locust) — operator tools, not
  customer surface. They are reachable through Envoy but a customer never sees them.
- **Internal gRPC services** — unreachable from outside the Docker network by design,
  and correctly so. We reach them only transitively, through the BFF.

## Provenance

Written against demo `DEMO_VERSION=latest` (collector `0.159.0`, Jaeger `2.19.0`,
Grafana `13.1.0`, Prometheus `v3.13.1`, flagd `v0.16.0`), cross-checked against
<https://opentelemetry.io/docs/demo/> and the source in `../opentelemetry-demo`.

Where the upstream published docs and the code disagree, **the code wins** and the
disagreement is called out inline. One example already found: the services page says
Product Catalog reads "from a JSON file", but both the architecture page and this
checkout of the code use PostgreSQL (`astronomy-db`).
