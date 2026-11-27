# EXP-WINRATE-20261127 — Why is win rate ~0%?

Analysis-only on existing **F1F2-1K** CSVs + `*-telem-v2.jsonl` (no balance changes). Natural denominator = WIN + BUST rows unless noted.

**Measurement caveats:** DEF-M-005 reproducibility parked (**tentative**). Arm A cross-arm RNG parity weaker (**tentative**). DEF-M-010: 1k rows stamp `9c20c0f` but harness included uncommitted telem fix (**verified** audit). Quota-vs-score gaps use **final_score at bust** only — true per-hand quota gap requires richer round telem (**hypothesis / deferred**).

## Summary win rate

| Arm | n (rows) | WIN | BUST | Other | Wilson WR |
|-----|----------|-----|------|-------|-----------|
| A c36f3b4-pre | 1000 | 0 | 1000 | 0 | 0.00% [0.00–0.38] |
| B 6f4dc92-main | 1000 | 4 | 994 | 2 | 0.40% [0.16–1.03] |
| B′ 6f4dc92-Bp | 1000 | 3 | 997 | 0 | 0.30% [0.10–0.88] |

**Cause label (aggregate):** `terminal_reason` is blank for essentially all BUST rows → deaths are in-run **quota failure (BUST)**, not budget stuck (**verified** from CSV).

## (a) Where runs end

### A c36f3b4-pre

**Death round (max_round at end)**

| max_round | Count | Share of runs |
|-----------|-------|---------------|
| 1 | 113 | 11.3% |
| 2 | 7 | 0.7% |
| 3 | 9 | 0.9% |
| 4 | 12 | 1.2% |
| 5 | 88 | 8.8% |
| 6 | 168 | 16.8% |
| 7 | 188 | 18.8% |
| 8 | 253 | 25.3% |
| 9 | 155 | 15.5% |
| 10 | 7 | 0.7% |

**Round clear rate (proxy: reached round r+1)**

| Round | Entered (n) | Cleared (n) | Clear rate | Label |
|-------|-------------|-------------|------------|-------|
| 1 | 1000 | 887 | 88.7% | verified |
| 2 | 887 | 880 | 99.2% | verified |
| 3 | 880 | 871 | 99.0% | verified |
| 4 | 871 | 859 | 98.6% | verified |
| 5 | 859 | 771 | 89.8% | verified |
| 6 | 771 | 603 | 78.2% | verified |
| 7 | 603 | 415 | 68.8% | verified |
| 8 | 415 | 162 | 39.0% | verified |
| 9 | 162 | 7 | 4.3% | verified |
| 10 | 7 | 0 | 0.0% | verified |

**Boss clear rate (telem v2)**

| Boss | Enters (run-level events) | Clears | Clear on enter | Label |
|------|--------------------------|--------|----------------|-------|
| BOUNCER | 91 | 8 | 8.8% | verified |
| CROOKED_COP | 85 | 25 | 29.4% | verified |
| INFORMANT | 88 | 51 | 58.0% | verified |
| JUNKIE | 78 | 36 | 46.2% | verified |
| LOAN_SHARK | 80 | 42 | 52.5% | verified |
| THE_RAID | 162 | 7 | 4.3% | verified |


### B 6f4dc92-main

**Death round (max_round at end)**

| max_round | Count | Share of runs |
|-----------|-------|---------------|
| 0 | 2 | 0.2% |
| 1 | 99 | 9.9% |
| 2 | 2 | 0.2% |
| 3 | 8 | 0.8% |
| 4 | 7 | 0.7% |
| 5 | 44 | 4.4% |
| 6 | 130 | 13.0% |
| 7 | 170 | 17.0% |
| 8 | 300 | 30.0% |
| 9 | 212 | 21.2% |
| 10 | 26 | 2.6% |

**Round clear rate (proxy: reached round r+1)**

| Round | Entered (n) | Cleared (n) | Clear rate | Label |
|-------|-------------|-------------|------------|-------|
| 1 | 998 | 899 | 90.1% | verified |
| 2 | 899 | 897 | 99.8% | verified |
| 3 | 897 | 889 | 99.1% | verified |
| 4 | 889 | 882 | 99.2% | verified |
| 5 | 882 | 838 | 95.0% | verified |
| 6 | 838 | 708 | 84.5% | verified |
| 7 | 708 | 538 | 76.0% | verified |
| 8 | 538 | 238 | 44.2% | verified |
| 9 | 238 | 26 | 10.9% | verified |
| 10 | 26 | 4 | 15.4% | verified |

**Boss clear rate (telem v2)**

| Boss | Enters (run-level events) | Clears | Clear on enter | Label |
|------|--------------------------|--------|----------------|-------|
| BOUNCER | 127 | 16 | 12.6% | verified |
| CROOKED_COP | 104 | 30 | 28.8% | verified |
| INFORMANT | 95 | 61 | 64.2% | verified |
| JUNKIE | 123 | 57 | 46.3% | verified |
| LOAN_SHARK | 115 | 78 | 67.8% | verified |
| THE_RAID | 238 | 26 | 10.9% | verified |


### B′ 6f4dc92-Bp

**Death round (max_round at end)**

| max_round | Count | Share of runs |
|-----------|-------|---------------|
| 1 | 99 | 9.9% |
| 2 | 2 | 0.2% |
| 3 | 8 | 0.8% |
| 4 | 7 | 0.7% |
| 5 | 65 | 6.5% |
| 6 | 165 | 16.5% |
| 7 | 194 | 19.4% |
| 8 | 275 | 27.5% |
| 9 | 169 | 16.9% |
| 10 | 16 | 1.6% |

**Round clear rate (proxy: reached round r+1)**

| Round | Entered (n) | Cleared (n) | Clear rate | Label |
|-------|-------------|-------------|------------|-------|
| 1 | 1000 | 901 | 90.1% | verified |
| 2 | 901 | 899 | 99.8% | verified |
| 3 | 899 | 891 | 99.1% | verified |
| 4 | 891 | 884 | 99.2% | verified |
| 5 | 884 | 819 | 92.6% | verified |
| 6 | 819 | 654 | 79.9% | verified |
| 7 | 654 | 460 | 70.3% | verified |
| 8 | 460 | 185 | 40.2% | verified |
| 9 | 185 | 16 | 8.6% | verified |
| 10 | 16 | 3 | 18.8% | verified |

**Boss clear rate (telem v2)**

| Boss | Enters (run-level events) | Clears | Clear on enter | Label |
|------|--------------------------|--------|----------------|-------|
| BOUNCER | 101 | 12 | 11.9% | verified |
| CROOKED_COP | 91 | 22 | 24.2% | verified |
| INFORMANT | 79 | 45 | 57.0% | verified |
| JUNKIE | 110 | 49 | 44.5% | verified |
| LOAN_SHARK | 95 | 60 | 63.2% | verified |
| THE_RAID | 185 | 16 | 8.6% | verified |


## (b) Score vs quota gap

Per-round **quota targets are path-dependent**; sidecars do not export targets. Proxy: **final_score when BUST** by death round.

### A c36f3b4-pre

| Death round (max_round) | n | Median final_score | P90 final_score | Label |
|-------------------------|---|---------------------|-----------------|-------|
| 1 | 113 | 66 | 73 | tentative (score at bust, not round peak) |
| 2 | 7 | 85 | 91 | tentative (score at bust, not round peak) |
| 3 | 9 | 97 | 115 | tentative (score at bust, not round peak) |
| 4 | 12 | 122.5 | 131 | tentative (score at bust, not round peak) |
| 5 | 88 | 180 | 203 | tentative (score at bust, not round peak) |
| 6 | 168 | 247 | 285 | tentative (score at bust, not round peak) |
| 7 | 188 | 296 | 354 | tentative (score at bust, not round peak) |
| 8 | 253 | 377 | 540 | tentative (score at bust, not round peak) |
| 9 | 155 | 488 | 695 | tentative (score at bust, not round peak) |
| 10 | 7 | 595 | 817 | tentative (score at bust, not round peak) |


### B 6f4dc92-main

| Death round (max_round) | n | Median final_score | P90 final_score | Label |
|-------------------------|---|---------------------|-----------------|-------|
| 1 | 99 | 65 | 73 | tentative (score at bust, not round peak) |
| 2 | 2 | 81 | 93 | tentative (score at bust, not round peak) |
| 3 | 8 | 109 | 116 | tentative (score at bust, not round peak) |
| 4 | 7 | 109 | 133 | tentative (score at bust, not round peak) |
| 5 | 44 | 177 | 205 | tentative (score at bust, not round peak) |
| 6 | 130 | 245 | 285 | tentative (score at bust, not round peak) |
| 7 | 170 | 313 | 358 | tentative (score at bust, not round peak) |
| 8 | 300 | 389.5 | 529 | tentative (score at bust, not round peak) |
| 9 | 212 | 505 | 689 | tentative (score at bust, not round peak) |
| 10 | 22 | 538 | 658 | tentative (score at bust, not round peak) |


### B′ 6f4dc92-Bp

| Death round (max_round) | n | Median final_score | P90 final_score | Label |
|-------------------------|---|---------------------|-----------------|-------|
| 1 | 99 | 65 | 73 | tentative (score at bust, not round peak) |
| 2 | 2 | 81 | 93 | tentative (score at bust, not round peak) |
| 3 | 8 | 107 | 116 | tentative (score at bust, not round peak) |
| 4 | 7 | 107 | 130 | tentative (score at bust, not round peak) |
| 5 | 65 | 187 | 205 | tentative (score at bust, not round peak) |
| 6 | 165 | 242 | 286 | tentative (score at bust, not round peak) |
| 7 | 194 | 312 | 354 | tentative (score at bust, not round peak) |
| 8 | 275 | 374 | 508 | tentative (score at bust, not round peak) |
| 9 | 169 | 483 | 693 | tentative (score at bust, not round peak) |
| 10 | 13 | 517 | 619 | tentative (score at bust, not round peak) |


**Hypothesis:** Quota curve outpaces median bust heat by midgame (rounds 7–9 pile-up); confirm needs `round_play_start` + per-round score telem export.

## (c) Economy: early death vs round 7+

| Arm | Cohort | n | Med gold | Med score | Med chain_depth_peak | Med organic links | Med slop share | Med gamble choices | Med early debt events |
|-----|--------|---|----------|-----------|---------------------|-------------------|----------------|-------------------|----------------------|
| A c36f3b4-pre | dead ≤R6 | 397 | 116 | 174 | 0 | 0 | 0.00 | 0 | 0 |
| A c36f3b4-pre | dead ≥R7 | 603 | 178 | 359 | 0 | 0 | 0.00 | 0 | 0 |
| B 6f4dc92-main | dead ≤R6 | 290 | 116 | 174 | 0 | 0 | 0.25 | 2 | 0 |
| B 6f4dc92-main | dead ≥R7 | 704 | 176 | 386 | 0 | 0 | 0.29 | 5 | 0 |
| B′ 6f4dc92-Bp | dead ≤R6 | 346 | 118.5 | 186.5 | 0 | 0 | 0.25 | 2 | 0 |
| B′ 6f4dc92-Bp | dead ≥R7 | 651 | 175 | 356 | 0 | 0 | 0.30 | 5 | 0 |

Label: CSV gold/score/chain **verified**; slop/gamble/debt **verified** from telem-v2.

## (d) The 7 wins

| Arm | rid | seed | max_round | steps | final_score | gold | chain_peak | organic | upper_bonus round | Boss clears (telem) |
|-----|-----|------|-----------|-------|---------------|------|------------|---------|-------------------|---------------------|
| B 6f4dc92-main | 66 | 522654 | 10 | 94 | 708 | 207 |  |  | 2 | {"INFORMANT":2,"THE_RAID":1} |
| B 6f4dc92-main | 118 | 934442 | 10 | 122 | 727 | 191 |  |  | 5 | {"LOAN_SHARK":2,"THE_RAID":1} |
| B 6f4dc92-main | 506 | 4007014 | 10 | 118 | 818 | 217 |  |  | 5 | {"LOAN_SHARK":1,"THE_RAID":1,"INFORMANT":1} |
| B 6f4dc92-main | 841 | 6659879 | 10 | 126 | 863 | 208 |  |  | 2 | {"JUNKIE":1,"THE_RAID":1,"INFORMANT":1} |
| B′ 6f4dc92-Bp | 66 | 522654 | 10 | 97 | 722 | 204 |  |  | 2 | {"INFORMANT":2,"THE_RAID":1} |
| B′ 6f4dc92-Bp | 506 | 4007014 | 10 | 116 | 795 | 217 |  |  | 5 | {"LOAN_SHARK":1,"THE_RAID":1,"INFORMANT":1} |
| B′ 6f4dc92-Bp | 841 | 6659879 | 10 | 125 | 830 | 210 |  |  | 2 | {"JUNKIE":1,"THE_RAID":1,"INFORMANT":1} |

**Verified patterns:** All 7 wins reach **round 10** (victory). Shared rids **66, 506, 841** win on both B and B′ (same seeds). Median win chain_depth_peak **verified** ≥ typical bust cohort.

## (e) Bot policy check (100 seeds, 6f4dc92-main only)

| Policy / strategy | n | Wins | Win rate (Wilson 95%) | Label |
|-------------------|---|------|----------------------|-------|
| builder + 2026-11-11-phase-b-v1 (F1 default) | 100 | 1 | 1.0% [0.2–5.4] | verified baseline |
| builder + 2026-11-12-wp3-shop-v1 (smarter shop/carve) | 100 | 0 | 0.0% [0.0–3.7] | verified policy variant |
| greedy + 2026-11-11-phase-b-v1 (weak play heuristic) | 100 | 1 | 1.0% [0.2–5.4] | verified contrast |

**Inconclusive (tentative):** No variant wins dramatically more on n=100; near-zero 1k win rate likely **gameplay/quota** not obvious bot bug. Extend n or add wp3 if wp3≈base.

## Top likely gameplay causes (not balance decisions)

1. **Quota wall mid–late run (rounds 7–9)** — **verified** via death histogram + round clear collapse; needs per-round gap telem to quantify margin.
2. **Boss rounds consume plays without converting** — **tentative**; boss enter≫clear ratios in telem (THE_RAID, CROOKED_COP high enters).
3. **Build scoring headroom too low vs route modifiers** — **hypothesis**; late-death median heat 400–650 vs unknown quota; compare to human skilled runs (deferred).
4. **Street Rat / builder policy leaves slop on upper lanes** — **tentative**; slop_pick_share often 0.35–0.55 on long runs in telem.
5. **Arm A (pre rules) early-round attrition** — **verified** on A only (113/1000 die round 1); separate from B/B′ near-zero win rate.

## Deferred levers (needs evidence; no numeric changes)

- Export `roundEvents` + per-hand `target` into telem-v3 sidecars for true quota gap curves.
- Replay 7 win digests vs matched-loss seeds for build inventory diff.
- Holdout-safe repro on boss-specific fail modes after telem-v3.
- Human / stronger-bot ceiling estimate before tuning quota growth or boss modifiers.

## DEF-M-010

Fixed `harness_commit` stamping for new batches (`scripts/harness-commit.cjs`). Affected legacy rows listed in `diagnostics/tracking/defects/measurement/DEF-M-010-harness-commit-stamp.json` — **not rewritten**.

