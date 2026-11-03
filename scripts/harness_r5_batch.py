#!/usr/bin/env python3
"""Round 5 playthrough harness: 5 full runs per required viewport."""
import json
import os
import sys
import time

# Import harness from uploaded copy
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import harness_r2_6113 as h2

VPS_R5 = {
    "phone_small": (360, 640),
    "phone_portrait": (390, 844),
    "phone_tall": (412, 915),
    "phone_landscape": (844, 390),
    "tablet_portrait": (768, 1024),
    "tablet_landscape": (1024, 768),
    "laptop": (1366, 768),
    "desktop_fhd": (1920, 1080),
}

OUT = "/opt/cursor/artifacts/gb-playtest-r5"
os.makedirs(f"{OUT}/runs", exist_ok=True)
os.makedirs(f"{OUT}/shots", exist_ok=True)

RUNS_PER_VP = int(os.environ.get("RUNS_PER_VP", "5"))


def main():
    h2.OUT = OUT
    h2.VPS = VPS_R5
    from playwright.sync_api import sync_playwright

    summary = {}
    rid = 0
    p = sync_playwright().start()
    br = p.chromium.launch()
    shots = [200]
    t0 = time.time()
    for vp_name in VPS_R5:
        vp_stats = {
            "runs": 0,
            "stuck": 0,
            "api_fallback": 0,
            "false_round_clear": 0,
            "outcomes": {},
            "issues": [],
        }
        for i in range(RUNS_PER_VP):
            rid += 1
            strat = ["random", "greedy", "edge", "rapid"][rid % 4]
            log = h2.run_one(br, rid, strat, vp_name, rid * 7919 + i, shots)
            path = f"{OUT}/runs/run_{rid:03d}.json"
            with open(path, "w") as f:
                json.dump(log, f, default=str)
            vp_stats["runs"] += 1
            oc = log.get("outcome", "?")
            vp_stats["outcomes"][oc] = vp_stats["outcomes"].get(oc, 0) + 1
            kinds = [x["kind"] for x in log.get("issues", [])]
            if any(k.startswith("softlock") for k in kinds):
                vp_stats["stuck"] += 1
            if any(k == "api_fallback_needed" for k in kinds):
                vp_stats["api_fallback"] += log.get("fallbacks", 0) or sum(
                    1 for k in kinds if k == "api_fallback_needed"
                )
            if any(
                "round" in iss.get("kind", "").lower()
                and "clear" in str(iss.get("detail", "")).lower()
                for iss in log.get("issues", [])
            ):
                vp_stats["false_round_clear"] += 1
            for iss in log.get("issues", []):
                if iss["kind"] in (
                    "softlock_no_buttons",
                    "softlock_no_progress",
                    "api_fallback_needed",
                    "layout_out_of_bounds",
                    "clipped_button",
                ):
                    vp_stats["issues"].append(
                        {"rid": rid, "kind": iss["kind"], "detail": iss.get("detail", "")[:120]}
                    )
            print(
                f"run {rid} {vp_name} {strat} -> {oc} steps={log.get('steps')} iss={kinds[:4]}",
                flush=True,
            )
        summary[vp_name] = vp_stats
    br.close()
    p.stop()
    summary["_meta"] = {
        "total_runs": rid,
        "elapsed_s": round(time.time() - t0, 1),
        "runs_per_vp": RUNS_PER_VP,
    }
    table_path = f"{OUT}/harness-summary.json"
    with open(table_path, "w") as f:
        json.dump(summary, f, indent=2)
    print("\n=== PER-VIEWPORT TABLE ===")
    for vp, st in summary.items():
        if vp.startswith("_"):
            continue
        print(
            f"{vp}: runs={st['runs']} stuck={st['stuck']} api_fallback={st['api_fallback']} false_rc={st['false_round_clear']} outcomes={st['outcomes']}"
        )
    return 0 if all(st["stuck"] == 0 and st["api_fallback"] == 0 for k, st in summary.items() if not k.startswith("_")) else 1


if __name__ == "__main__":
    raise SystemExit(main())
