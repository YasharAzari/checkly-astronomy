# Checkly Private Location agent

Checkly's public checkers run in Checkly's cloud and cannot reach this machine.
Anything targeting the local Astronomy Shop demo has to run on a **Private
Location** — this container — and be pinned to it by slug:

```ts
privateLocations: ['<slug>']   // ✅   not   locations: ['us-east-1']
```

## Setup

1. In the Checkly UI: **Settings → Account → Private Locations → New**, note the
   slug, then **Add API key** and copy the `pl_…` value.
2. Put it in the repo-root `.env` (shared with the CLI — see `../.env.example`):

   ```bash
   cp ../.env.example ../.env      # then fill in API_KEY=pl_…
   ```

3. Start it:

   ```bash
   docker compose up -d
   docker compose ps               # agent should go healthy within ~20s
   ```

   The location shows as connected in the Checkly UI once the agent registers.

## Logs

`tee` in the agent's command fans output to **both** places, so either works:

```bash
tail -f logs/agent.log            # plain file on the host
docker compose logs -f agent      # normal Docker stream
```

`logs/agent.log` is rotated by the `log-rotator` sidecar once it passes 10 MiB,
keeping `agent.log.1` … `agent.log.5` (~60 MiB ceiling). Tune the thresholds in
`compose.yaml`; the rotation itself lives in `rotate.sh`.

Unlike `docker compose logs`, the files survive `down`/`up` — they are on the
host, not in the container. The directory is gitignored except for `.gitkeep`.

## Reaching the app from a check

From *inside* the agent container, `localhost` is the agent itself. Use:

| Target | When |
|---|---|
| `http://host.docker.internal:8080` | default — goes out to the host's `localhost:8080` |
| `http://frontend-proxy:8080` | only if you uncomment the `opentelemetry-demo` network in `compose.yaml` |

## Notes

- **Playwright Check Suites** need agent ≥ 6.0.3 and ≥ 2 CPU / 4 GB RAM; the
  `cpus` / `mem_limit` in `compose.yaml` cover that (image is currently 8.9.0).
- ICMP checks, packet capture and traceroute work out of the box — the image's
  entrypoint detects `NET_RAW` and picks the ICMP-capable binary. The compose
  file keeps that entrypoint rather than replacing it.
- A wrong or expired key makes the agent log
  `The provided private location API key is not valid` and exit 1, which
  `restart: unless-stopped` turns into a crash loop. Check `logs/agent.log`.
