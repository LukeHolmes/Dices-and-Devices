"use strict";
/** Extract inline scripts from index.html → src/ (run from repo root). */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function block(open) {
  const idx = html.indexOf(open);
  if (idx < 0) throw new Error(`Missing ${open}`);
  const start = idx + open.length;
  const end = html.indexOf("</script>", start);
  if (end < 0) throw new Error(`Missing close for ${open}`);
  return html.slice(start, end).replace(/^\n/, "").replace(/\n$/, "");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeSystem(name, body, globalName) {
  const out = `${body}\n\nexport default ${globalName};\nexport { ${globalName} };\n`;
  fs.writeFileSync(path.join(root, "src/systems", `${name}.js`), out);
}

ensureDir(path.join(root, "src/systems"));
ensureDir(path.join(root, "src/data"));
ensureDir(path.join(root, "src/styles"));

writeSystem("rules", block('<script id="gutterbones-rules">'), "GutterbonesRules");
writeSystem(
  "onboarding",
  block('<script id="gutterbones-onboarding">'),
  "GutterbonesOnboarding",
);
writeSystem("story", block('<script id="gutterbones-story">'), "GutterbonesStory");
writeSystem("routes", block('<script id="gutterbones-routes">'), "GutterbonesRoutes");
writeSystem("gamble", block('<script id="gutterbones-gamble">'), "GutterbonesGamble");

const appSource = block('<script type="text/babel">');
const defStart = appSource.indexOf("    const PERSONAS =");
const defEnd = appSource.indexOf("    const CashRain =");
if (defStart < 0 || defEnd < defStart) throw new Error("Catalog boundary changed");

const catalogChunk = appSource
  .slice(defStart, defEnd)
  .split("\n")
  .map((line) => line.replace(/^    /, ""))
  .join("\n");

const catalogBody = catalogChunk.replace(/^const /gm, "export const ");
const catalogImports = `import GutterbonesRules from "../systems/rules.js";
import GutterbonesOnboarding from "../systems/onboarding.js";
import GutterbonesGamble from "../systems/gamble.js";

`;
fs.writeFileSync(
  path.join(root, "src/data/catalog.js"),
  `${catalogImports}${catalogBody}\n`,
);

const exportNames = [...catalogBody.matchAll(/^export const ([A-Za-z0-9_]+)/gm)].map(
  (m) => m[1],
);

const appHead = appSource.slice(0, defStart);
const appTail = appSource.slice(defEnd);
let appFixed = (appHead + appTail)
  .split("\n")
  .map((line) => line.replace(/^    /, ""))
  .join("\n");

const importBlock = `import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ${exportNames.join(",\n  ")},
} from "./data/catalog.js";
import GutterbonesRules from "./systems/rules.js";
import GutterbonesOnboarding from "./systems/onboarding.js";
import GutterbonesStory from "./systems/story.js";
import GutterbonesRoutes from "./systems/routes.js";
import GutterbonesGamble from "./systems/gamble.js";

`;

appFixed = appFixed.replace(
  /const \{ useEffect, useMemo, useRef, useState \} = React;\n\n/,
  importBlock,
);
appFixed = appFixed.replace(
  /\nconst root = ReactDOM\.createRoot[\s\S]*$/m,
  "\nexport default App;\n",
);

fs.writeFileSync(path.join(root, "src/App.jsx"), appFixed);

const styleStart = html.indexOf("<style>");
const styleEnd = html.indexOf("</style>", styleStart);
const styles = html.slice(styleStart + "<style>".length, styleEnd);
fs.writeFileSync(path.join(root, "src/styles/gutterbones.css"), `${styles.trim()}\n`);

console.log("Wrote src/systems (5), catalog.js, App.jsx, gutterbones.css");
