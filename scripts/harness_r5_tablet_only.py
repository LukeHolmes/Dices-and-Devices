#!/usr/bin/env python3
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import harness_r5_batch as batch

batch.VPS_R5 = {"tablet_landscape": (1024, 768)}
batch.OUT = "/opt/cursor/artifacts/gb-playtest-r5-tablet"
os.makedirs(batch.OUT + "/runs", exist_ok=True)
os.environ["RUNS_PER_VP"] = "10"
raise SystemExit(batch.main())
