#!/usr/bin/env node
/**
 * Derive runtime WebP assets from approved masters in art-masters/ (gitignored).
 * See scripts/art/README.md
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MASTERS_DIR = process.env.GUTTERBONES_ART_MASTERS || path.join(REPO_ROOT, 'art-masters');
const OUT_ROOT = path.join(REPO_ROOT, 'assets/art');

/** @type {import('sharp')} */
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is required: npm install sharp --no-save');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const scopeItemsOnly = args.has('--items-only');
const scopeSkipItems = args.has('--skip-items');
const scopeShopOnly = args.has('--shop-only');
const scopeSkipShop = args.has('--skip-shop');
const scopeAnyOnly = scopeItemsOnly || scopeShopOnly;

const PORTRAIT_Q = 82;
const SCENE_Q = 78;
const PORTRAIT_W = 600;
const PORTRAIT_H = 800;
const SCENE_W = 1672;
const ICON_Q = 82;
const ICON_1X = 128;
const ICON_2X = 256;

/** master basename → { subdir, out } */
const PORTRAIT_SCENE_RULES = [
  { master: 'character_street-rat_v1.png', subdir: 'personas', out: 'street-rat.webp' },
  { master: 'character_hustler_v1.png', subdir: 'personas', out: 'hustler.webp' },
  { master: 'character_counter_v1.png', subdir: 'personas', out: 'card-counter.webp' },
  { master: 'character_enforcer_v1.png', subdir: 'personas', out: 'enforcer.webp' },
  { master: 'character_grinder_v1.png', subdir: 'personas', out: 'grinder.webp' },
  { master: 'boss_the-bouncer_v1.png', subdir: 'bosses', out: 'bouncer.webp' },
  { master: 'boss_loan-shark_v1.png', subdir: 'bosses', out: 'loan-shark.webp' },
  { master: 'boss_junkie_v1.png', subdir: 'bosses', out: 'junkie.webp' },
  { master: 'boss_crooked-cop_v1.png', subdir: 'bosses', out: 'crooked-cop.webp' },
  { master: 'boss_informant_v1.png', subdir: 'bosses', out: 'informant.webp' },
  { master: 'boss_the-raid_v1.png', subdir: 'bosses', out: 'the-raid.webp' },
  { master: 'background_alley-playfield_v1.png', subdir: 'scenes', out: 'alley-playfield.webp' },
  { master: 'background_stairwell-descent_v1.png', subdir: 'scenes', out: 'stairwell-descent.webp' },
  { master: 'background_counting-cash_v1.png', subdir: 'scenes', out: 'counting-cash.webp' },
  { master: 'background_the-mod-bench_v1.png', subdir: 'scenes', out: 'the-mod-bench.webp' },
  { master: 'background_gamble-double-or-nothing_v1.png', subdir: 'scenes', out: 'gamble-double-or-nothing.webp' },
  { master: 'background_busted_v1.png', subdir: 'scenes', out: 'busted.webp' },
  { master: 'background_the-escape_v1.png', subdir: 'scenes', out: 'the-escape.webp' }
];

/** Approved S3 item icons — expectedSha256 from manifest.csv (APPROVED rows only). */
const ITEM_ICON_RULES = [
  { master: 'contraband_mult_v1.png', subdir: 'contraband', base: 'mult-face', expectedSha256: '2f92fba0cac524ce901c2906382935dad66dd451796cf493896fe007958ad2d9' },
  { master: 'contraband_cash_v1.png', subdir: 'contraband', base: 'gold-face', expectedSha256: '6ba8f0c53de7b4a31b0a8d3753311745da8c36d875112ae17193b25769ca2a22' },
  { master: 'contraband_wild_v1.png', subdir: 'contraband', base: 'wild-face', expectedSha256: '2a87061b9eafec381531815ee00acf44128b41e52b23c42827d5ed0f0c6a752f' },
  { master: 'contraband_blood-6_v1.png', subdir: 'contraband', base: 'blood-6', expectedSha256: 'f44d116b664127c4ea555f834b4786fb9ec20391d3c5326703fa4b3b8cefab21' },
  { master: 'contraband_echo_v1.png', subdir: 'contraband', base: 'echo-face', expectedSha256: '4ba9a6ba46274dafc63cc7251e0b28035ca247f9e08b024fedd5384e61e75cc3' },
  { master: 'contraband_shiv_v1.png', subdir: 'contraband', base: 'shiv-face', expectedSha256: 'c4aaaa3d68fbf8279725013d297b78ff4a1c17a8cfb121a39e973eee76f48efe' },
  { master: 'contraband_wirebag_v1.png', subdir: 'contraband', base: 'wirebag-face', expectedSha256: '6a0d7eb473608a7607ac97a74b6ef4a0022b752bc092f5f97c60895454baec31' },
  { master: 'contraband_ghost_v1.png', subdir: 'contraband', base: 'ghost-face', expectedSha256: '8e0519e345194181cdea96e7a2fb0df8f4f6d31273df684965b5133f56a2d33d' },
  { master: 'contraband_fuse_v1.png', subdir: 'contraband', base: 'fuse-face', expectedSha256: '027eb3597a3ed5678ec8743e2e1b662b119e69f348297d2f60e4c20c5f1139db' },
  { master: 'contraband_magnet_v1.png', subdir: 'contraband', base: 'magnet-face', expectedSha256: 'f0c2b6a57f1788a3caee0ffd8597eadbcf2691bcb4fed73a2ea79f78f48b6fa6' },
  { master: 'contraband_mark_v1.png', subdir: 'contraband', base: 'mark-face', expectedSha256: '2ab63bdc21a6d880436e72a787ae50bf9d1edeb3e986db7be8b61e73bce32c49' },
  { master: 'contraband_double-down_v1.png', subdir: 'contraband', base: 'double-down-face', expectedSha256: '88dae3d3b760537c33bdbe8c3769f8b8309497f045f0b70217e96335c8ef1b55' },
  { master: 'hardware_01-centerpiece_v1.png', subdir: 'hardware', base: 'centerpiece', expectedSha256: '08461b5c0308cb46caa7e7f2800475d1ef60495d688821ff1b053140f260669f' },
  { master: 'hardware_02-bookends_v1.png', subdir: 'hardware', base: 'bookends', expectedSha256: 'fb93b9050a2a830c3e814e1179639a198d2aaac6f2671ef6c64696c7a646492f' },
  { master: 'hardware_03-engine_v1.png', subdir: 'hardware', base: 'engine', expectedSha256: 'b3062226318554716b630d73b5c7159032d3cc644d7380bed08aaf55755c7c2c' },
  { master: 'hardware_04-weighted-core_v1.png', subdir: 'hardware', base: 'loaded-die', expectedSha256: 'b46a1ceb289b200e4db7a44539dd900a51c32b3dc13a08b6852ca785b06c53c3' },
  { master: 'hardware_05-blood-pact_v1.png', subdir: 'hardware', base: 'blood-pact', expectedSha256: 'b5344e92a4ff59b113b6a9f78ea23e218c5ac1dabb5aa4195d7cf23a3e3df050' },
  { master: 'hardware_07-black-book_v1.png', subdir: 'hardware', base: 'black-book', expectedSha256: '846d2997eb4c0d3ad69d811024ed7d58a4fb7e9c036588bd086228fc5675d563' },
  { master: 'hardware_08-burner-phone_v1.png', subdir: 'hardware', base: 'burner-phone', expectedSha256: 'b66ac36b31bcb1528ede38c7d79a38edd567dafcecccf72d68b8cfd72d598e72' },
  { master: 'hardware_09-shady-ledger_v1.png', subdir: 'hardware', base: 'shady-ledger', expectedSha256: '5ae623767d4e9b1db4e167a0bd5100f8dd1ce255f83088d1fe4f98cd6dffd71e' },
  { master: 'hardware_10-crowbar_v1.png', subdir: 'hardware', base: 'crowbar', expectedSha256: 'a4e26d4e37fa813d33d5844c27cc2eb94e58e2dc6e071486d8c590f4e140564d' },
  { master: 'hardware_11-fuse-box_v1.png', subdir: 'hardware', base: 'fuse-box', expectedSha256: '3e13be51cf2313146fe883d8ff4b70f6b74752529c717e4ccdc89611ef74e93e' },
  { master: 'hardware_12-mirror-rig_v1.png', subdir: 'hardware', base: 'mirror-rig', expectedSha256: '3472f0d62289ccef0290c05a86423f33e7d84ece1951667211e06b8ac74bc9c7' },
  { master: 'hardware_13-debt-collector_v1.png', subdir: 'hardware', base: 'debt-collector', expectedSha256: '200e630d3524e0993fbec417f25eb7f8a59508ef75aa29a75586e9997e8edf17' },
  { master: 'hardware_14-hot-streak-coil_v1.png', subdir: 'hardware', base: 'hot-streak-coil', expectedSha256: '701576e6e090d64029e0d9708403662584d58af42c9572ae7a89c10755d9fa26' },
  { master: 'consumable_15-second-wind_v1.png', subdir: 'consumables', base: 'second-wind', expectedSha256: 'f77d14498865bdcc73adfb58ab83f8a66c8a54e19c2613d8d5a896b87bbfa647' },
  { master: 'consumable_16-smelling-salts_v1.png', subdir: 'consumables', base: 'smelling-salts', expectedSha256: '78ab140fb3a16aad4bc73a94033af6e842c8973a2a4411b71ca2fc04e103d401' },
  { master: 'consumable_17-dirty-wad_v1.png', subdir: 'consumables', base: 'dirty-wad', expectedSha256: 'ae7c034bf7abb899bb5c7517819bd2882f5e713304f5e068b51756138844e370' }
];

/** Approved shop UI masters (1024×512 frames / overlays; divider trimmed). */
const SHOP_CARD_RULES = [
  { master: 'shopcard_standard-frame_v1.png', subdir: 'shop', out: 'standard-frame.webp', trim: false, expectedSha256: '61d10a0cd8c80dbfcac4ebd00f8a18d2a3f6fc2d4297050b66f1ac716b15357e' },
  { master: 'shopcard_rare-frame_v1.png', subdir: 'shop', out: 'rare-frame.webp', trim: false, expectedSha256: 'f28c5252cd3716be3ca283bc33cb1f65ebe9d597d290c2b6f6b4ac6b60a31bda' },
  { master: 'shopcard_dangerous-frame_v1.png', subdir: 'shop', out: 'dangerous-frame.webp', trim: false, expectedSha256: '624ddc238ce55c1248a7565838e5c46f34c8ad9cf716fcb5fcc010fee76c7390' },
  { master: 'shopcard_price-tag-blank_v1.png', subdir: 'shop', out: 'price-tag-blank.webp', trim: false, expectedSha256: 'e898ca57a7373b98123dce5f2265ac6dae8b22fbf5a04a9c17500430b245624f' },
  { master: 'shopcard_selected-overlay_v1.png', subdir: 'shop', out: 'selected-overlay.webp', trim: false, expectedSha256: 'f10ac9f57aeb70c0f1db74405813fb56fae8cc9abf4242d250e79c8693bd149f' },
  { master: 'shopcard_sold-unavailable-overlay_v1.png', subdir: 'shop', out: 'sold-unavailable-overlay.webp', trim: false, expectedSha256: 'fb5b27e88bcf8744ba52c9dbc432d71ffe9949424b876b3138b8f33c18b4aa77' },
  { master: 'ui-header_section-header-blank_v1.png', subdir: 'shop', out: 'section-header-blank.webp', trim: false, expectedSha256: 'aec624cd6bc0df3290ee962f01136d1989131d335677d46531348eaf724c40a1' },
  { master: 'ui-divider_shop-divider-blank_v1.png', subdir: 'shop', out: 'shop-divider-blank.webp', trim: true, expectedSha256: 'f541f0dd71d8d650430d69575201c5b7672aadfabe3123a8000168cc031c5d93' }
];

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

/** Resolve manifest basename; upload copies may include a `_abcd` suffix before `.png`. */
async function resolveMasterPath(basename) {
  const entries = await readdir(MASTERS_DIR);
  if (entries.includes(basename)) return path.join(MASTERS_DIR, basename);
  const stem = basename.replace(/\.png$/i, '');
  const match = entries.find((e) => e.startsWith(stem) && /\.png$/i.test(e));
  if (match) return path.join(MASTERS_DIR, match);
  throw new Error(`Missing master for ${basename} in ${MASTERS_DIR}`);
}

async function derivePortrait(masterPath, outPath) {
  await sharp(masterPath)
    .resize(PORTRAIT_W, PORTRAIT_H, { fit: 'cover', position: 'top' })
    .webp({ quality: PORTRAIT_Q, alphaQuality: 100 })
    .toFile(outPath);
}

async function deriveScene(masterPath, outPath) {
  await sharp(masterPath)
    .resize({ width: SCENE_W, withoutEnlargement: false })
    .webp({ quality: SCENE_Q })
    .toFile(outPath);
}

async function deriveIconSquare(masterPath, outPath, size) {
  await sharp(masterPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: ICON_Q, alphaQuality: 100 })
    .toFile(outPath);
}

const SHOP_Q = 86;
async function deriveShopAsset(masterPath, outPath, { trim = false } = {}) {
  let pipe = sharp(masterPath);
  if (trim) pipe = pipe.trim({ threshold: 12 });
  await pipe.webp({ quality: SHOP_Q, alphaQuality: 100 }).toFile(outPath);
}

let priorProvenance = null;
const provPath = path.join(OUT_ROOT, 'RUNTIME-PROVENANCE.json');
if (scopeAnyOnly) {
  try {
    priorProvenance = JSON.parse(await readFile(provPath, 'utf8'));
  } catch {
    priorProvenance = null;
  }
}

const provenance = {
  generatedAt: new Date().toISOString(),
  mastersDir: MASTERS_DIR,
  portrait: { width: PORTRAIT_W, height: PORTRAIT_H, webpQuality: PORTRAIT_Q },
  scene: { width: SCENE_W, webpQuality: SCENE_Q },
  itemIcon: { size1x: ICON_1X, size2x: ICON_2X, webpQuality: ICON_Q },
  shopCard: { webpQuality: SHOP_Q, nineSlicePx: 112, dividerTrim: true },
  assets: []
};

let itemIconBytesTotal = 0;
let shopCardBytesTotal = 0;

async function recordAsset(entry) {
  provenance.assets.push(entry);
  if (entry.kind === 'itemIcon') itemIconBytesTotal += entry.bytes || 0;
  if (entry.kind === 'shopCard') shopCardBytesTotal += entry.bytes || 0;
  console.log(`${entry.output} (${entry.bytes} B) ← ${entry.masterManifestName || entry.master}`);
}

const runPortraits = !scopeAnyOnly;
const runItems = !scopeSkipItems && (!scopeShopOnly || scopeItemsOnly);
const runShop = !scopeSkipShop && (!scopeItemsOnly || scopeShopOnly);

if (runPortraits) {
  for (const rule of PORTRAIT_SCENE_RULES) {
    const masterPath = await resolveMasterPath(rule.master);
    const outDir = path.join(OUT_ROOT, rule.subdir);
    const outPath = path.join(outDir, rule.out);
    await mkdir(outDir, { recursive: true });
    const masterSha = await sha256File(masterPath);
    const kind = rule.subdir === 'scenes' ? 'scene' : 'portrait';
    if (kind === 'portrait') await derivePortrait(masterPath, outPath);
    else await deriveScene(masterPath, outPath);
    const outSha = await sha256File(outPath);
    const relOut = path.relative(REPO_ROOT, outPath).replace(/\\/g, '/');
    await recordAsset({
      kind,
      output: relOut,
      master: path.basename(masterPath),
      masterManifestName: rule.master,
      masterSha256: masterSha,
      outputSha256: outSha,
      bytes: (await readFile(outPath)).length
    });
  }
}

if (runItems) {
  for (const rule of ITEM_ICON_RULES) {
    const masterPath = await resolveMasterPath(rule.master);
    const masterSha = await sha256File(masterPath);
    if (rule.expectedSha256 && masterSha !== rule.expectedSha256) {
      throw new Error(`SHA256 mismatch for ${rule.master}: got ${masterSha}, expected ${rule.expectedSha256}`);
    }
    const outDir = path.join(OUT_ROOT, rule.subdir);
    await mkdir(outDir, { recursive: true });
    const out1 = path.join(outDir, `${rule.base}.webp`);
    const out2 = path.join(outDir, `${rule.base}@2x.webp`);
    await deriveIconSquare(masterPath, out1, ICON_1X);
    await deriveIconSquare(masterPath, out2, ICON_2X);
    for (const outPath of [out1, out2]) {
      const outSha = await sha256File(outPath);
      const relOut = path.relative(REPO_ROOT, outPath).replace(/\\/g, '/');
      await recordAsset({
        kind: 'itemIcon',
        output: relOut,
        master: path.basename(masterPath),
        masterManifestName: rule.master,
        masterSha256: masterSha,
        outputSha256: outSha,
        bytes: (await readFile(outPath)).length
      });
    }
  }
  console.log(`Item icon WebP total: ${itemIconBytesTotal} bytes (${ITEM_ICON_RULES.length} masters × 2 sizes)`);
}

if (runShop) {
  for (const rule of SHOP_CARD_RULES) {
    const masterPath = await resolveMasterPath(rule.master);
    const masterSha = await sha256File(masterPath);
    if (rule.expectedSha256 && masterSha !== rule.expectedSha256) {
      throw new Error(`SHA256 mismatch for ${rule.master}: got ${masterSha}, expected ${rule.expectedSha256}`);
    }
    const outDir = path.join(OUT_ROOT, rule.subdir);
    const outPath = path.join(outDir, rule.out);
    await mkdir(outDir, { recursive: true });
    await deriveShopAsset(masterPath, outPath, { trim: !!rule.trim });
    const outSha = await sha256File(outPath);
    const relOut = path.relative(REPO_ROOT, outPath).replace(/\\/g, '/');
    await recordAsset({
      kind: 'shopCard',
      output: relOut,
      master: path.basename(masterPath),
      masterManifestName: rule.master,
      masterSha256: masterSha,
      outputSha256: outSha,
      bytes: (await readFile(outPath)).length,
      trim: !!rule.trim
    });
  }
  console.log(`Shop card WebP total: ${shopCardBytesTotal} bytes (${SHOP_CARD_RULES.length} assets)`);
}

if (scopeAnyOnly && priorProvenance?.assets?.length) {
  const freshOutputs = new Set(provenance.assets.map((a) => a.output));
  const dropKinds = new Set();
  if (scopeItemsOnly) dropKinds.add('itemIcon');
  if (scopeShopOnly) dropKinds.add('shopCard');
  const kept = priorProvenance.assets.filter((a) => !freshOutputs.has(a.output) && !dropKinds.has(a.kind));
  provenance.assets = [...kept, ...provenance.assets];
  if (priorProvenance.portrait) provenance.portrait = priorProvenance.portrait;
  if (priorProvenance.scene) provenance.scene = priorProvenance.scene;
  if (priorProvenance.itemIcon) provenance.itemIcon = priorProvenance.itemIcon;
}

await writeFile(provPath, `${JSON.stringify(provenance, null, 2)}\n`);
const totalBytes = provenance.assets.reduce((sum, a) => sum + (a.bytes || 0), 0);
console.log(`Wrote ${path.relative(REPO_ROOT, provPath)} (${provenance.assets.length} assets, ${totalBytes} bytes total)`);