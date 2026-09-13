# 04 — Agent, MCP and chatbot

Three services (`agent`, `mcp`, `chatbot`) that exist **only** when `compose.agent.yaml`
is layered in. They are out of scope for the planned checks, and this doc records why —
plus what it would take to bring them in.

## Not wired into the storefront

The chatbot is a standalone **Gradio** app behind Envoy at `{BASE}/chatbot/`. It is
**not** part of the Next.js storefront:

```bash
grep -rniE 'chatbot' src/frontend/components src/frontend/pages
# → no matches
```

Nothing in the storefront links to it, references it, or embeds it. A customer browsing
the shop will never encounter it. That is why it never "pops up in the project" — it is
a sibling UI, not a feature of the shop.

```
customer ──▶ Envoy :8080 ──▶ /          ──▶ frontend (storefront)   ← the product
                         └──▶ /chatbot/  ──▶ chatbot (Gradio)        ← separate UI
                                                  │ HTTP
                                                  ▼
                                               agent  (FastAPI + LangGraph)
                                                  │
                                    ┌─────────────┴─────────────┐
                        MCP_ENABLED=False          MCP_ENABLED=True
                                    │                           │
                          in-process LangChain          MCP session to
                          @tool functions               mcp:8011/mcp
                                    └─────────────┬─────────────┘
                                                  ▼
                                        the same /api/* BFF routes
```

## The MCP server is running but nothing calls it

`.env:195` sets **`MCP_ENABLED=False`**, the demo default. In `agents.py`:

```python
async def get_tool_list(self):
    mcp_enabled = os.getenv("MCP_ENABLED", "False") == "True"
    if mcp_enabled and self.mcp_server is not None:
        return await load_mcp_tools(self.mcp_server.session)
    else:
        tool_list = [add_to_cart, checkout, empty_cart, ...]   # in-process
```

So with the demo as shipped, the `mcp` container starts, answers us on `:8011`, and the
agent **never opens a session to it**. It is live infrastructure with no consumer.

Both paths serve the **same ten tools** — `src/shared/tools.py` is `COPY`ed into both the
`agent` and `mcp` images at build time. MCP here is a swappable *delivery mechanism*, not
a different feature set.

### The ten tools and the routes they wrap

Every tool is a thin `httpx` wrapper over the same BFF routes in
[03-public-endpoints.md](03-public-endpoints.md) — which makes the MCP server a
convenient way to *drive* the endpoints the checks will monitor.

| Tool | Calls |
|---|---|
| `list_products` / `get_product` | `GET /api/products`, `/api/products/{id}` |
| `add_to_cart` / `get_cart` / `empty_cart` | `/api/cart` |
| `checkout` | `POST /api/checkout` |
| `get_recommendations` | `GET /api/recommendations` |
| `get_shipping_quote` | `GET /api/shipping` |
| `get_supported_currencies` | `GET /api/currency` |
| `get_ads` | `GET /api/data` |

It advertises `prompts` and `resources` capabilities, but **both list empty** — those
are FastMCP defaults. Tools only. Server name `astronomy-shop-mcp`, streamable HTTP
transport at `/mcp`.

## Two real bugs in the shared tool layer

Found by exercising the tools end-to-end. Both are upstream defects, both affect the
**in-process agent path too** (shared file), and both are currently unfixed by choice.

### 1. `get_cart` always returns an empty cart

`src/shared/tools.py` sends `params={"user_id": user_id}`, but the BFF reads `sessionId`
(`src/frontend/pages/api/cart.ts:16`). Proven:

```
add_to_cart("mcp-proof-77", "HQTGWGPNH4", 4) → {"userId":"mcp-proof-77","items":[…4 items]}
get_cart("mcp-proof-77")                     → {"userId":"","items":[]}          ← wrong
curl '…/api/cart?sessionId=mcp-proof-77'     → 4× The Comet Book                 ← truth
```

It returns **HTTP 200 with an empty cart**, so it fails silently. One-word fix:
`params={"sessionId": user_id}`.

### 2. `checkout`'s docstring documents the wrong key

The docstring says `{string user_id, ...}`; the code and the gRPC `PlaceOrderRequest`
both want **`userId`**. Following the docstring returns `500`, and the error text then
misleadingly blames an empty cart ("call add_to_cart first") when the cart was fine.

Also note the tool's 10 s `httpx` timeout is shorter than checkout under load, and
`httpx.ReadTimeout` stringifies to nothing — producing a bare
`Error while performing checkout:` for an order that may have succeeded. An agent that
retries on that could double-order.

**Consequence for our work:** do not use `get_cart` to verify state while building
checks. Query `{BASE}/api/cart?sessionId=…` directly.

Upstream's own `src/mcp/README.md` is stale in two further places: it says mcp
`depends_on: agent` (the reverse is true) and that the Dockerfile copies
`src/agent/src/agents/tools.py` (it copies `src/shared/tools.py`).

## Does the chatbot need a real LLM? **No.**

This was the open question, and the answer is that the demo is designed to run without
one. The agent wraps `ChatOpenAI` in a **VCR cassette** (`vcrpy`) that replays recorded
HTTP interactions.

`src/agent/src/agents/llm.py`:

```python
class ChatLLM(ChatOpenAI):
    def __init__(self, **kwargs):
        model_name = os.getenv("LLM_MODEL", "default")
        use_vcr = os.getenv("USE_VCR", "True").lower() == "true"
        if use_vcr:
            cassette_name = f"{model_name.replace('/', '_')}_cassette.yaml"
        api_key = os.getenv("API_KEY") or "sk-dummy"     # ← no key needed
    ...
    async def _agenerate(self, messages, ...):
        if self._use_vcr:
            with VCR.use_cassette(self._cassette_name):   # ← replay, no network
                return await super()._agenerate(...)
```

Shipped defaults in `.env`:

```bash
LLM_BASE_URL=https://local-llm.com     # placeholder, never resolved when replaying
LLM_MODEL=azure/gpt-5.5
API_KEY=                               # empty → falls back to "sk-dummy"
USE_VCR=True
VCR_MATCH_THRESHOLD=0.85               # fuzzy match; 1.0 would be exact
```

And the cassettes are present in the repo:

```
src/agent/fixtures/vcr_cassettes/azure_gpt-5.5_cassette.yaml     68K, 15 interactions
src/agent/fixtures/vcr_cassettes/claude-opus-4-7_cassette.yaml   68K
```

mounted into the container via `./src/agent/fixtures:/app/fixtures`, matching
`cassette_library_dir="fixtures/vcr_cassettes"`.

So: **`MCP_ENABLED=True` can be turned on and the chatbot exercised end-to-end with no
model, no API key and no outbound network**, as long as prompts resemble recorded ones.

### The caveat that decides scope

`record_mode="new_episodes"`. A prompt that clears the 0.85 similarity threshold replays
instantly and deterministically. A prompt that **misses** falls through to a genuine HTTP
call against `LLM_BASE_URL` — which is a placeholder domain, so it fails.

With 15 recorded interactions, the replayable surface is narrow. The demo authors
anticipated this: `VCR_MATCH_THRESHOLD` exists specifically because MCP-delivered tool
schemas differ slightly from in-process ones, so exact matching would miss the cassette.

**That is what makes the chatbot a poor synthetic-test target.** A check against it
would assert on fixture-replay coverage, not on the shop working — green when prompts
happen to match, red otherwise, with neither outcome telling you anything about
customer experience. It is excluded on merit, not because it is hard.

## Turning it on, if you want it

```bash
# in ../opentelemetry-demo/.env.override
MCP_ENABLED=True
```

then restart the agent. `.env.override` is the right place — it is already passed by
every Makefile target (`--env-file .env --env-file .env.override`) and keeps `.env`
pristine.

Verify the switch actually took effect, rather than assuming:

```bash
docker logs agent 2>&1 | grep "MCP tools enabled"     # logged only on the MCP path
```

The chatbot UI is then at `{BASE}/chatbot/`, and the MCP server can be inspected
directly at `http://localhost:8011/mcp` (no Envoy route — the direct port is pinned by
`compose.ports.yaml`).

Worth knowing: flipping this changes **which transport delivers the tools**, not what
the shop can do. Both paths end at the same ten `/api/*` calls. If the goal is to prove
the storefront works, the BFF routes are the honest target.
