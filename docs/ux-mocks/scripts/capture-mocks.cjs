"use strict";
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "../../..");
const OUT = path.join(ROOT, "docs/ux-mocks/mock-screenshots");

const MOCKS = [
  { file: "option-a-tray-plus-strip.html", prefix: "option-a" },
  { file: "option-b-split-panel.html", prefix: "option-b" },
  { file: "option-c-phase-aware.html", prefix: "option-c" },
];

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844, vp: "" },
  { id: "1366x768", width: 1366, height: 768, vp: "1366" },
  { id: "1920x1080", width: 1920, height: 1080, vp: "1920" },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".css": "text/css" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ headless: true });
  try {
    for (const mock of MOCKS) {
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const q = vp.vp ? `?vp=${vp.vp}` : "";
          await page.goto(`${baseUrl}/docs/ux-mocks/${mock.file}${q}`, {
            waitUntil: "networkidle",
            timeout: 60_000,
          });
          await page.waitForTimeout(250);
          const out = path.join(OUT, `${mock.prefix}_${vp.id}.png`);
          await page.screenshot({ path: out, scale: "css" });
          console.log("OK", out);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
