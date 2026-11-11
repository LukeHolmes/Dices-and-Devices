"use strict";
/**
 * Production roll resolution: rollBones and rerollBoneSlot use resolveDieAfterRoll in index.html.
 * The face.id || face.faceId change applies to all rolls (not e2e-only).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { appSource } = require("./helpers/game.cjs");

function extractDefinition(name) {
  const marker = `    const ${name} = `;
  const start = appSource.indexOf(marker);
  assert.ok(start >= 0, `missing ${name} in index.html definitions`);
  const nextDef = appSource.indexOf("\n    const ", start + marker.length);
  assert.ok(nextDef > start, `missing end of ${name}`);
  return appSource.slice(start, nextDef);
}

const resolveSource = extractDefinition("resolveDieAfterRoll");
const ctx = { Math };
vm.createContext(ctx);
vm.runInContext(`${resolveSource}\nthis.resolveDieAfterRoll = resolveDieAfterRoll;`, ctx, {
  filename: "resolveDieAfterRoll.js",
});
const resolveDieAfterRoll = ctx.resolveDieAfterRoll;

const standardFace = (value) => ({ id: "standard", value, label: String(value), type: "standard" });

test("resolveDieAfterRoll maps carved face when only faceId is set (legacy face shape)", () => {
  const die = {
    value: 3,
    faceId: null,
    type: "standard",
    faces: [
      standardFace(1),
      standardFace(2),
      standardFace(3),
      standardFace(4),
      standardFace(5),
      { faceId: "GHOST_FACE", value: 0, type: "ethereal", label: "GHOST" },
    ],
  };
  const out = resolveDieAfterRoll(die, 0, {
    runRandomFn: () => 0.99,
  });
  assert.equal(out.faceId, "GHOST_FACE");
  assert.equal(out.type, "ethereal");
});

test("resolveDieAfterRoll keeps standard faces null faceId (seeded index 0)", () => {
  const die = {
    value: 1,
    faceId: null,
    type: "standard",
    faces: [standardFace(1), standardFace(2), standardFace(3), standardFace(4), standardFace(5), standardFace(6)],
  };
  const out = resolveDieAfterRoll(die, 0, { runRandomFn: () => 0 });
  assert.equal(out.faceId, null);
  assert.equal(out.type, "standard");
  assert.equal(out.value, 1);
});

test("resolveDieAfterRoll unchanged for shop faces with id field", () => {
  const die = {
    value: 2,
    faceId: null,
    type: "standard",
    faces: [
      standardFace(1),
      standardFace(2),
      standardFace(3),
      standardFace(4),
      standardFace(5),
      { id: "ECHO_FACE", value: 0, type: "adjacent", label: "ECHO" },
    ],
  };
  const out = resolveDieAfterRoll(die, 0, { runRandomFn: () => 0.99 });
  assert.equal(out.faceId, "ECHO_FACE");
});
