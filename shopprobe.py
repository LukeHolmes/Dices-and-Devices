#!/usr/bin/env python3
"""Probe Back Alley shop layout: no sub-0.6 scale, readable cards/buttons, in viewport."""
from __future__ import annotations

import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent

VIEWPORTS = [
    ("360x640", 360, 640),
    ("390x844", 390, 844),
    ("412x915", 412, 915),
    ("844x390", 844, 390),
    ("768x1024", 768, 1024),
    ("1024x768", 1024, 768),
    ("1366x768", 1366, 768),
    ("1920x1080", 1920, 1080),
]


def start_server() -> tuple[str, ThreadingHTTPServer]:
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = httpd.server_address[1]
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return f"http://127.0.0.1:{port}", httpd


def probe_viewport(page, base_url: str, name: str, width: int, height: int) -> dict:
    page.set_viewport_size({"width": width, "height": height})
    page.goto(f"{base_url}/index.html?layoutAudit=1", wait_until="domcontentloaded")
    page.wait_for_timeout(350)
    page.wait_for_function("() => window.__GB_LAYOUT_AUDIT__", timeout=45_000)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("() => window.__GB_LAYOUT_AUDIT__", timeout=45_000)
    page.evaluate("() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun()")
    page.wait_for_function("() => window.__GB_LAYOUT_AUDIT__.getPhase() === 'SHOP'", timeout=12_000)
    page.wait_for_selector('[data-layout-key="shop-route-card"]', timeout=12_000)
    page.wait_for_timeout(400)
    return page.evaluate(
        """() => {
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const body = document.querySelector('.shop-routes-body');
        const tr = body ? getComputedStyle(body).transform : 'none';
        const scaleMatch = tr && tr !== 'none' && tr.startsWith('matrix')
            ? parseFloat(tr.split('(')[1].split(',')[0])
            : 1;
        const minFont = 11;
        const minTap = 32;
        const selectors = [
            '[data-layout-key="shop-route-card"]',
            'button:has-text("REFRESH STOCK")',
            'button:has-text("HIT THE STREETS")',
        ];
        const bad = [];
        document.querySelectorAll('[data-layout-key="shop-route-card"]').forEach((card, idx) => {
            const r = card.getBoundingClientRect();
            if (r.width < minTap || r.height < minTap) bad.push({ kind: 'route-card-size', idx, w: r.width, h: r.height });
            if (r.bottom > vh + 1) bad.push({ kind: 'route-offscreen', idx, bottom: r.bottom, vh });
            const fs = parseFloat(getComputedStyle(card).fontSize);
            if (fs > 0 && fs < minFont - 0.5) bad.push({ kind: 'route-font', idx, fs });
        });
        ['REFRESH STOCK', 'PAY $', 'CLEAR $', 'HIT THE STREETS'].forEach((label) => {
            const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes(label));
            if (!btn) return;
            const style = getComputedStyle(btn);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            const r = btn.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return;
            if (r.height < minTap || r.width < minTap) bad.push({ kind: 'btn-size', label, w: r.width, h: r.height });
            if (r.bottom > vh + 1 || r.top < -1 || r.left < -1 || r.right > vw + 1) {
                bad.push({ kind: 'btn-clipped', label, rect: { top: r.top, left: r.left, bottom: r.bottom, right: r.right } });
            }
        });
        const buy = document.querySelector('.gb-btn-shop');
        if (buy) {
            const r = buy.getBoundingClientRect();
            if (r.bottom > vh + 1) bad.push({ kind: 'buy-below-fold', bottom: r.bottom, vh });
        }
        return { ok: bad.length === 0 && scaleMatch >= 0.59, scaleMatch, bad, cardCount: document.querySelectorAll('[data-layout-key="shop-route-card"]').length };
    }"""
    )


def load_shop_fixture() -> dict:
    import subprocess

    script = """
const { createGame, plain } = require('./tests/helpers/game.cjs');
const fixtures = require('./tests/fixtures/runs.cjs');
process.stdout.write(JSON.stringify(plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()))));
"""
    raw = subprocess.check_output(["node", "-e", script], cwd=ROOT, text=True)
    return json.loads(raw)


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    base_url, httpd = start_server()
    results = []
    try:
        fixture = load_shop_fixture()
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{base_url}/index.html?layoutAudit=1", wait_until="domcontentloaded")
            page.wait_for_function("() => window.__GB_LAYOUT_AUDIT__", timeout=45_000)
            page.evaluate(
                """({ key, data }) => localStorage.setItem(key, JSON.stringify(data))""",
                {"key": "gutterbones1977:run:v1", "data": fixture},
            )
            for name, w, h in VIEWPORTS:
                try:
                    row = probe_viewport(page, base_url, name, w, h)
                    row["viewport"] = name
                    results.append(row)
                except Exception as exc:  # noqa: BLE001
                    results.append({"viewport": name, "ok": False, "error": str(exc)})
            browser.close()
    finally:
        httpd.shutdown()

    failed = [r for r in results if not r.get("ok")]
    print(json.dumps(results, indent=2))
    if failed:
        print(f"\n{len(failed)} viewport(s) failed shop probe", file=sys.stderr)
        return 1
    print("\nAll viewports passed shop probe")
    return 0


if __name__ == "__main__":
    sys.exit(main())
