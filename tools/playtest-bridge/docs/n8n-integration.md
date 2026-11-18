# n8n integration (documentation only)

**Do not import this file into n8n from the repo without Luke/Home Lab review.** It describes the contract between:

- **n8n** on Pi 5 (`http://homeassistant.tailde272c.ts.net:5678`, v2.47.3, regular mode, no reverse proxy)
- **Outbound worker** on Windows (`py -3.13 -m gb_bridge.worker`)

Tailscale MagicDNS carries traffic; the laptop initiates all HTTP calls.

## Webhook prefix

Configurable via `GB_BRIDGE_N8N_WEBHOOK_PREFIX` (default `/webhook/playtest`).

| Suffix | Direction | Purpose |
|---|---|---|
| `/poll` | Worker → n8n | Fetch queued jobs + cancel signals |
| `/claim` | Worker → n8n | Lease a job to `worker_id` |
| `/heartbeat` | Worker → n8n | Extend lease; receive `cancel: true` |
| `/status` | Worker → n8n | Progress / terminal status |
| `/results` | Worker → n8n | Summary JSON + CSV pointers |
| `/interrupted` | Worker → n8n | Sleep/crash: requeue hint |

Auth: **Header Auth** — header name `GB_BRIDGE_N8N_HEADER_NAME` (default `X-GB-Bridge-Key`), value in `GB_BRIDGE_N8N_HEADER_VALUE` (env only).

## Poll response shape (example)

```json
{
  "jobs": [
    {
      "job_id": "pt-20261118-001",
      "operation": "start_playtest",
      "payload": {
        "baseline": "R-main",
        "rids": "0-49,60-109",
        "policy_revision": "2026-11-11-phase-b-v1",
        "budget_max_steps": 12000,
        "parallel": 4,
        "replicate": 1
      }
    }
  ],
  "cancel": [
    { "job_id": "pt-20261118-000", "reason": "user_cancel" }
  ]
}
```

## MCP Server Trigger (n8n side)

The MCP Server Trigger workflow exposes tools (`start_playtest`, `get_playtest_status`, …) that **write to the same queue** the worker polls — they do not call the laptop directly. Tool handlers should enqueue rows and return `job_id` immediately.

See `n8n-playtest-queue-example.json` for a **skeletal** workflow (queue + webhook stubs). Wire credentials, Data Store tables, and MCP nodes in the Home Lab UI.

## Sleep / interrupted jobs

If heartbeats stop (laptop sleep ~45 min), n8n should expire leases and mark jobs requeueable. When the worker restarts, it:

1. Marks local stale `RUNNING` rows `INTERRUPTED`
2. POSTs `/interrupted` with `requeue: true`

No inbound port on the laptop is required for recovery.