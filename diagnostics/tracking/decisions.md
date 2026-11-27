# Diagnostics decisions log

## 2026-11-18 — Luke approved feasibility plan (Grok assessment)

- **D1 baselines:** R-main = `main` @ `7d649ef`; R78 = PR #78 head `59e11dc` (`cursor/sim-win-rate-f4c3`).
- **D2 holdouts:** Nightly `sim:nightly` on main already executed rids 55–59 eight times after the 11 Nov lock. Logged as **EXPOSED**; runner guard added on diagnostics harness only (nightly workflow unchanged).
- **D4 policy:** Fixed `2026-11-11-phase-b-v1` for both baselines.
- **D5 profile:** Harness forces Street Rat + safe cut on both baselines.
- **D6 bridge path:** `tools/playtest-bridge/` in this repo.
- **Bridge transport (Home Lab):** Outbound-only worker polls n8n @ `http://homeassistant.tailde272c.ts.net:5678` (`/webhook/playtest/*`, Header Auth). No inbound listener on the laptop; optional localhost HTTP off by default. Python **3.13** via `py -3.13` on Windows 11 (`holme`).
- **D7 pilot seeds:** `0-49` and `60-109` (100 runs per baseline); reproducibility reruns separate.
- **D8 Antigravity budget:** 3 calls/day, 10/week; `investigate_defect` disabled by default.
- **D10 harness:** Reimplement PR #89 runner fixes minimally off `main` (offset + seeded game RNG); no PR #89 balance changes.