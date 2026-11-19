#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const html = fs.readFileSync(INDEX, "utf8");
const patterns = [
    /url\(\s*["']?((?:assets\/|\.?\/)?[^"')]+)["']?\s*\)/gi,
    /(?:src|href)=["']((assets\/[^"']+))["']/gi,
];
const found = new Set();
for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
        let rel = m[1].replace(/^\//, "").replace(/^\.\//, "");
        if (!rel.startsWith("assets/")) continue;
        if (rel.includes("${")) continue;
        found.add(rel.split("?")[0].split("#")[0]);
    }
}
const missing = [];
for (const rel of [...found].sort()) {
    const filePath = path.join(ROOT, rel);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
        missing.push(rel);
    }
}
if (missing.length) {
    console.error("Missing assets referenced in index.html:");
    missing.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
}
console.log(`check-index-assets: ok (${found.size} paths)`);
process.exit(0);