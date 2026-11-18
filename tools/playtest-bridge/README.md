# Gutterbones playtest bridge

Outbound-polling worker for Luke's Windows 11 laptop (`holme`). The laptop **does not accept inbound connections** in the default setup: it polls n8n on the Pi 5 over Tailscale, claims jobs, runs sims locally, and posts status/results back.

n8n **2.47.3** (single instance, regular mode) holds the MCP Server Trigger surface and the job queue. This repo does **not** ship live n8n workflows — see `docs/n8n-integration.md` and `docs/n8n-playtest-queue-example.json`.

## Requirements (laptop)

- Windows 11, user `holme`
- Python **3.13.5** via the `py` launcher (`py -3.13` — not the Store `python` stub)
- Node **22.16.0**
- Playwright Chromium (repo `npm install` + `npx playwright install chromium`)

## Install

```powershell
cd tools\playtest-bridge
py -3.13 -m pip install -e ".[dev]"
copy .env.example .env
# Edit .env: set GB_BRIDGE_N8N_HEADER_VALUE and GB_BRIDGE_REPO_ROOT
```

## Run worker (production)

```powershell
py -3.13 -m gb_bridge.worker
```

Smoke one poll cycle (no loop):

```powershell
py -3.13 -m gb_bridge.worker --once
```

## Operations (MCP-shaped, executed locally)

| Operation | Local behavior |
|---|---|
| `start_playtest` | Runs `scripts/diagnostics-batch.cjs` with harness env |
| `get_playtest_status` | SQLite + heartbeat posts to n8n |
| `get_playtest_results` | Posted on completion |
| `cancel_playtest` | n8n poll returns `cancel[]`; worker kills process tree (Windows `taskkill /T /F`) |
| `investigate_defect` | Antigravity CLI when enabled; 3/day 10/week budget |

Antigravity: default CLI path is `%LOCALAPPDATA%\agy\bin\agy.exe` (override `GB_BRIDGE_ANTIGRAVITY_CLI`). Each investigate call logs the CLI version. Daily/weekly counts use `GB_BRIDGE_ANTIGRAVITY_QUOTA_PATH` when set (shared ledger with other workers); otherwise `%USERPROFILE%\.gb-bridge\antigravity-quota.json`.

Startup refuses n8n configs that point at `/webhook/localai/*` — use `/webhook/playtest/*` only.

Before claiming a playtest job, the worker may call `GET GB_BRIDGE_OLLAMA_PS_URL` (default `http://127.0.0.1:11434/api/ps`); when `models` is non-empty it defers the claim and sleeps `GB_BRIDGE_OLLAMA_DEFER_BACKOFF_SEC`. Disable with `GB_BRIDGE_OLLAMA_DEFER_ENABLED=0`.

Holdout rids 55–59 are rejected unless `GB_BRIDGE_HOLDOUT_APPROVAL_ID` matches the job payload.

## Sleep / lease recovery

The laptop sleeps after ~45 minutes. The worker sends heartbeats every `GB_BRIDGE_HEARTBEAT_INTERVAL_SEC` (default 30s) and renews a short lease (`GB_BRIDGE_LEASE_DURATION_SEC`, default 120s). If the process stops (sleep, crash), stale `RUNNING` rows are marked `INTERRUPTED` on next wake, and the worker calls the n8n `interrupted` webhook so the queue can **requeue** the job. No wake timers or power-policy changes are made.

## Optional localhost HTTP (debug only)

```powershell
$env:GB_BRIDGE_HTTP_SERVER_ENABLED="1"
py -3.13 -m pip install -e ".[http]"
py -3.13 -m uvicorn gb_bridge.optional_server:app --host 127.0.0.1 --port 8787
```

## Tests

```powershell
py -3.13 -m pytest
```