# Presentation timing audit

Central tuning lives in `GutterbonesPresentation` (`index.html`, script `gutterbones-presentation`).

| Surface | Control | Normal (approx.) | Continue rule |
| --- | --- | --- | --- |
| Round cleared card | `GATE_MIN_MS.roundClear` | 2800ms scaled | TAP TO CONTINUE after min hold |
| Boss intro | `GATE_MIN_MS.bossIntro` | 3200ms scaled | TAP / Space / Enter after min hold |
| Score resolution + breakdown | `GATE_MIN_MS.scoreOverlay` + synergy lifetime | 2600ms+ scaled | TAP TO CONTINUE after min; auto cap 12s |
| Synergy chain stagger | `synergySequenceTailMs` | stepMs × events + hold | Feeds breakdown reveal before juice |
| Unlock / mechanic toasts | `TOAST_MIN_MS` | 3200ms scaled | Stack (max 5); no replace |
| Rap sheet reveal gate | `GATE_MIN_MS.rapReveal` | 2800ms scaled | TAP TO CONTINUE after stamp sequence |
| Story panel | existing caption timing | `readableMs(caption)` | Tap / skip (unchanged) |

**Pacing setting:** Settings → PACING cycles Fast (0.78×), Normal (1×), Relaxed (1.32×). Reduced motion uses the smaller of 1× and the pacing scale.

**Phase queue:** Shop/gamble transitions wait until score overlays and boss intro finish; round-clear card queues after that.

**Tests:** `npm run test:presentation` (Playwright + module floors). Layout audit unchanged: `npm run test:layout`.
