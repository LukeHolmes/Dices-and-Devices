"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice } = require("./fixtures/runs.cjs");

// Condition on exactly one visible Ghost and Echo. Enumerate every ordered
// placement and the six possible faces of each of the other three dice.
function enumerate(api, carveBloodSix) {
  const counts = { hands: 0, ghostEcho: 0, both: 0, linked: 0 };
  for (let ghost = 0; ghost < 5; ghost++) {
    for (let echo = 0; echo < 5; echo++) {
      if (echo === ghost) continue;
      const bones = dice([1, 1, 1, 1, 1]);
      bones[ghost].faces[4] = api.FACE_DATABASE.GHOST_FACE;
      bones[echo].faces[4] = api.FACE_DATABASE.ECHO_FACE;
      if (carveBloodSix) bones[0].faces[5] = api.FACE_DATABASE.BLOOD_6;
      for (let roll = 0; roll < 216; roll++) {
        let remaining = roll;
        const lane = bones.map((bone, slot) => {
          let face = 4;
          if (slot !== ghost && slot !== echo) {
            face = remaining % 6;
            remaining = Math.floor(remaining / 6);
          }
          return api.resolveDieAfterRoll(bone, slot, { runRandomFn: () => (face + 0.5) / 6 });
        });
        const result = api.calculateScore("C", lane);
        assert.ok(result.valid);
        const events = new Set(result.synergyEvents.map(event => event.id));
        counts.hands++;
        if (events.has("ghost_echo")) counts.ghostEcho++;
        if (events.has("ghost_echo") && events.has("bookends_retrigger")) counts.both++;
        if (result.chainLinks.some(link => link.from === "ghost_echo" && link.to === "bookends_retrigger")) counts.linked++;
      }
    }
  }
  return counts;
}

test("one Blood 6 on an end opens the Ghost Echo to Bookends link under current rules", t => {
  const { api } = createGame(snapshot({ inventory: [{ id: "BOOKENDS" }] }));
  const control = enumerate(api, false);
  const bloodSix = enumerate(api, true);
  t.diagnostic(JSON.stringify({ control, bloodSix }));
  assert.deepEqual(control, { hands: 4320, ghostEcho: 1728, both: 144, linked: 0 });
  assert.deepEqual(bloodSix, { hands: 4320, ghostEcho: 1728, both: 144, linked: 24 });
});
