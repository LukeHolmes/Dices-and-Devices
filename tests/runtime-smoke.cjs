const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
assert.ok(
  process.env.GUTTERBONES_TEST_DEPS,
  "Set GUTTERBONES_TEST_DEPS to optional dependency node_modules directory",
);
const deps = path.resolve(process.env.GUTTERBONES_TEST_DEPS) + "/";
const { JSDOM, VirtualConsole } = require(deps + "jsdom");
const Babel = require(deps + "@babel/standalone");
const root = path.resolve(__dirname, "..") + "/";
const { sharedSource, appSource } = require(root + "tests/helpers/game.cjs");
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push(e));
vc.on("error", (e) => errors.push(e));
const dom = new JSDOM('<div id="root-gutterbones"></div>', {
  url: "http://localhost:8080",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const w = dom.window;
w.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
w.eval(fs.readFileSync(deps + "react/umd/react.development.js", "utf8"));
w.eval(
  fs.readFileSync(deps + "react-dom/umd/react-dom.development.js", "utf8"),
);
new (require("node:vm").Script)(sharedSource).runInContext(
  dom.getInternalVMContext(),
);
w.eval(Babel.transform(appSource, { presets: ["react"] }).code);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try {
    await wait(100);
    assert.ok(
      w.document.querySelector("#root-gutterbones").textContent.length > 100,
    );
    const click = (text) => {
      const b = [...w.document.querySelectorAll("button")].find((b) =>
        b.textContent.includes(text),
      );
      assert.ok(b, text);
      b.click();
    };
    click("OFFER CONTRACT");
    await wait(100);
    click("SKIP");
    await wait(40);
    click("ROLL 'EM");
    await wait(1300);
    const saved = JSON.parse(w.localStorage.getItem("gutterbones1977:run:v1"));
    assert.equal(saved.phase, "PLAY");
    assert.equal(saved.hasRolled, true);
    assert.equal(saved.dice.length, 5);
    assert.equal(saved.discards, 2);
    console.log(
      "Contract, tutorial skip, roll settlement and autosave passed.",
    );
    assert.deepEqual(errors, []);
    console.log("Full JSX compiled and React mounted without errors.");
  } finally {
    w.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
