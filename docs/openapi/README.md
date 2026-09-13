# OpenAPI — Astronomy Shop public BFF API

| File | What |
|---|---|
| [`index.html`](index.html) | **Browsable reference.** Open it in a browser — fully offline, no server, no network |
| [`astronomy-shop-bff.yaml`](astronomy-shop-bff.yaml) | The spec. **Source of truth — edit this**, then rebuild the HTML |
| [`redocly.yaml`](redocly.yaml) | Lint config, with the two disabled rules justified inline |

## ⚠️ Descriptive, not authoritative

The demo publishes **no** OpenAPI document. This one is reverse-engineered from
`pb/demo.proto`, the BFF handlers in `src/frontend/pages/api/*.ts`, and responses
captured from a running stack. It describes observed behaviour accurately; it is not a
contract the upstream project guarantees. **Re-verify after a demo upgrade.**

## Rebuild after editing the YAML

```bash
npx @redocly/cli lint docs/openapi/astronomy-shop-bff.yaml --config docs/openapi/redocly.yaml
npx @redocly/cli build-docs docs/openapi/astronomy-shop-bff.yaml \
  -o docs/openapi/index.html --title "Astronomy Shop — Public BFF API"
```

`build-docs` emits a CDN `<script>` and a Google Fonts `<link>`. Both are inlined
afterwards so the page works with no network — worth redoing, since a demo that needs
wifi is a demo that can fail in the room.

## Using it with Checkly

Checkly can import an OpenAPI/Swagger document to scaffold API checks, so this turns
eight hand-typed requests into a generated, maintainable suite. Two things to set:

- **Server** — pick `http://frontend-proxy:8080`, not `localhost:8080`. A Checkly
  checker runs in Checkly's cloud (or in the agent container on a Private Location) and
  cannot reach your machine's `localhost`.
- **Response assertions** — the schemas here are strict enough to assert against
  directly, which is stronger than spot-checking one field.

## Three things the spec deliberately documents rather than tidies away

- **`GET /api/cart` takes `sessionId`; `POST`/`DELETE` take `userId`.** Same identity,
  two names. Sending the wrong one returns `200` with an empty cart and **no error** —
  a naive assertion passes against nothing.
- **`422` on checkout is a business outcome, not an outage.** The `paymentFailure` flag
  produces it on purpose. `500` is the real failure.
- **Money is `units` + `nanos`, never a float.** A real captured order line read
  `nanos: 959999999` — assert with tolerance, or on `units` alone.

See [`../03-public-endpoints.md`](../03-public-endpoints.md) for measured latency
baselines and a suggested check portfolio.
