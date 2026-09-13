# 02 — Telemetry pipeline

Three signals, three transports, **three completely different databases**. Grafana is a
read-only lens over all of them and stores no telemetry itself.

```
                    ┌──────────────────────────────────────────┐
  services ────────▶│                                          │
  (OTLP push)       │            otel-collector                │
                    │              0.159.0                     │
  ad :9465 ◀────────│  ← SCRAPES (prometheus receiver)         │
  valkey  ◀─────────│  ← PULLS   (redis receiver)              │
  postgres◀─────────│  ← PULLS   (postgresql receiver)         │
  kafka   ◀─────────│  ← PULLS   (kafkametrics receiver)       │
  nginx   ◀─────────│  ← PULLS   (nginx receiver)              │
  docker  ◀─────────│  ← PULLS   (docker_stats receiver)       │
  proxy   ◀─────────│  ← PROBES  (http_check receiver)         │
                    └───────┬──────────┬──────────┬────────────┘
                   traces   │  metrics │   logs   │
                            ▼          ▼          ▼
                    ┌──────────┐ ┌───────────┐ ┌────────────┐
                    │  Jaeger  │ │Prometheus │ │ OpenSearch │
                    │  :4317   │ │/api/v1/otlp│ │   :9200   │
                    │ in-MEMORY│ │  own TSDB │ │   Lucene   │
                    └────┬─────┘ └─────┬─────┘ └─────┬──────┘
                         └─────────────┼─────────────┘
                                       ▼
                                  ┌─────────┐
                                  │ Grafana │  reads all three; stores none
                                  └─────────┘
```

## The collector is a hybrid — it both receives and scrapes

A common misreading is that the collector only *receives* pushed OTLP. It does both.
From `src/otel-collector/otelcol-config.yml`:

| Receiver | Direction | Source |
|---|---|---|
| `otlp` | **push** | gRPC `:4317` / HTTP `:4318` — every instrumented service |
| `prometheus/ad` | **scrape** | `ad:9465`, every 10 s |
| `docker_stats` | pull | `unix:///var/run/docker.sock` |
| `host_metrics` | pull | host CPU/mem/disk |
| `nginx` | pull | `image-provider:8081/status` |
| `redis` | pull | `valkey-cart:6379` |
| `postgresql` | pull | `astronomy-db:5432` |
| `kafkametrics` | pull | `kafka:9092` |
| `http_check/frontend-proxy` | **probe** | `http://frontend-proxy:8080` |
| `span_metrics` | derived | generated from the traces pipeline |

The `prometheus/ad` receiver exists because the **ad** service exposes metrics via the
Prometheus client library rather than OTLP — the demo's worked example of bridging
non-OTel instrumentation. Upstream documents it
[here](https://opentelemetry.io/docs/demo/services/ad/#bridging-non-otel-custom-metrics-prometheus-client-library).

Two receivers are worth noticing for our purposes:

- **`http_check/frontend-proxy`** — the collector already runs a crude synthetic probe
  against the same gateway our Checkly checks will target. Useful as a cross-reference;
  it answers "was the gateway up?" independently of Checkly.
- **`span_metrics`** — traces are converted into RED metrics
  (`traces_span_metrics_duration_milliseconds_*`) and fed back into the metrics
  pipeline. So some "metrics" are *derived from traces*, not emitted by services. This
  is what powers the APM dashboard's Duration / Error / Rate panels.

## Exporters — where each signal lands

From `src/otel-collector/otelcol-config-observability.yml`:

```yaml
pipelines:
  traces:   exporters: [debug, otlp_grpc/jaeger, span_metrics]
  metrics:  exporters: [debug, otlp_http/prometheus]
  logs:     exporters: [debug, opensearch]
  profiles: exporters: [debug, otlp_grpc/firepit]
```

| Signal | Transport | Destination |
|---|---|---|
| Traces | OTLP gRPC | `jaeger:4317` |
| Metrics | OTLP **HTTP** | `http://prometheus:9090/api/v1/otlp` |
| Logs | HTTP bulk | `http://opensearch:9200`, index `otel-logs-<yyyy-MM-dd>` |

**Metrics never reach OpenSearch. Logs never reach Prometheus.** OTLP is the transport
for traces and metrics both — same protocol, different destinations.

## Prometheus is push-fed, and that breaks an instinct

`--web.enable-otlp-receiver` means Prometheus accepts the collector's push. It has
**no scrape targets at all**.

Consequence: **`up` returns zero series.** `up` is synthesised per scrape target, and
there are none. This looks exactly like a dead Prometheus and is not. Use a real metric
to test liveness:

```promql
time() - max(timestamp(traces_span_metrics_duration_milliseconds_count))   # staleness, seconds
```

Other flags: `--storage.tsdb.retention.time=7d`, `--storage.tsdb.path=/prometheus`,
`--enable-feature=exemplar-storage` (exemplars carry trace IDs, enabling
metric→trace pivot in Grafana).

## Storage engines and durability

| | Engine | Retention | Survives restart? |
|---|---|---|---|
| **Prometheus** | own TSDB — WAL + compacted blocks, XOR-compressed chunks, inverted label index | **7 days** | Yes |
| **OpenSearch** | Lucene — inverted index, segments | 1 day (ISM policy we added) | **No — no volume** |
| **Jaeger** | **pure in-memory** | `MEMORY_MAX_TRACES=25000`, rolling eviction | **No — RAM only** |

Prometheus is not a query layer over some other database; the TSDB is its own storage
engine. Jaeger here is configured with `traces: memory_backend` in
`src/jaeger/config.yml` — traces live in RAM and vanish on restart.

**Practical impact:** when a check fails, grab the trace promptly. Under constant
load-generator traffic, 25,000 spans is a short window. Metrics are the only signal
with real history, and only 7 days of it — so derive thresholds from Prometheus, not
from spot measurements.

## Grafana

Reads all three; writes none. Datasources are provisioned, not hand-configured:

| UID | Type | Points at |
|---|---|---|
| `webstore-traces` | Jaeger | `http://jaeger:16686/jaeger/ui` |
| `webstore-metrics` | Prometheus | `http://prometheus:9090` |
| `webstore-logs` | OpenSearch | `http://opensearch:9200`, index `otel-logs-*`, timeField `observedTimestamp` |

Anonymous API access is enabled — `curl http://localhost:3000/api/datasources` works
with no token, which makes scripted inspection easy.

Ten dashboards ship with it; the useful one is **APM Dashboard (Jaeger, Prometheus,
OpenSearch)** at `/grafana/d/febljk0a32qyoa/`, which spans all three signals.

### A trap in the APM dashboard

Its `$service_name` dropdown is built from Prometheus `target_info`, which lists **25**
services — but only **17** emit logs. Selecting one of these eight gives an empty Logs
panel that looks broken and is not:

`agent` · `chatbot` · `flagd` · `frontend-web` · `image-provider` · `jaeger` · `mcp` · `telemetry-docs`

The Logs panel query is PPL, and it filters on **both** `resource.service.name` **and**
`resource.service.namespace`:

```sql
search source=otel-logs-*
| where resource.service.name="$service_name"
  and resource.service.namespace="$service_namespace"
| fields @timestamp, severity.text, body, instrumentationScope.name
```

Both fields are mapped `text` with a `.keyword` subfield — aggregate on
`resource.service.name.keyword`, not the bare field, or you get zero buckets.

## Failure modes seen in practice

These are recorded because each one *looked* like an application outage and wasn't.

### Disk fills → logs stop silently

The highest-impact failure observed. Chain:

```
Docker VM disk 97% full
  → OpenSearch crosses its flood-stage watermark (95%)
  → sets index.blocks.read_only_allow_delete on otel-logs-*
  → every write rejected: cluster_block_exception
  → collector retry queue saturates: "sending queue is full"
  → log records dropped at the exporter
```

Logs froze at 995 documents for ~12 hours with no alarm that read as "logs are gone".
**The culprit was Docker build cache + images (54 GB), not log volume (1 MB).** Logs
grow at only ~0.78 GiB/day.

Recovery: free disk (`docker builder prune -f` recovered 11.1 GB, 97% → 74%), then
clear the block:

```bash
curl -X PUT 'http://localhost:9200/otel-logs-*/_settings' \
  -H 'Content-Type: application/json' \
  -d '{"index.blocks.read_only_allow_delete": null}'
```

Clearing the block without freeing disk does nothing — OpenSearch re-blocks in seconds.

### Grafana starved → looks like a network problem

Upstream caps Grafana at **175 MB**, which Grafana 13.1 plus the OpenSearch datasource
plugin does not fit into. It sat at 92% of the cap, ran GC continuously, and burned
**~11 cores (1131% CPU)** while serving `/api/annotations` in **67 seconds**. Raised to
768 MB it settles at ~425 MB, idles under 1% CPU, and serves the same call in
**0.016 s**.

Diagnostic tell: CPU pegged *and* memory near the cap = GC thrash, not load.

### Collector saturation

`OpenTelemetryCollectorSendQueueFailed` and `ReceiverDroppedLogs` alerts fire when the
collector cannot drain. They are real signals of telemetry loss — gaps in a dashboard
during those windows are missing data, not quiet periods. Do not baseline against them.

## Quick health check

```bash
# logs — must be increasing
curl -s 'http://localhost:9200/otel-logs-*/_count'
# disk — must be under ~85%
curl -s 'http://localhost:9200/_cat/allocation?h=disk.percent'
# metrics — staleness in seconds, expect < 60
curl -s -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=time() - max(timestamp(traces_span_metrics_duration_milliseconds_count))'
# traces — service list, expect ~21
curl -s 'http://localhost:16686/jaeger/ui/api/services'
```
