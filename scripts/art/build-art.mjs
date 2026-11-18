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

const PORTRAIT_Q = 82;
const SCENE_Q = 78;
const PORTRAIT_W = 600;
const PORTRAIT_H = 800;
const SCENE_W = 1672;

/** master basename → { subdir, outName } */
const RULES = [
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

const provenance = {
  generatedAt: new Date().toISOString(),
  mastersDir: MASTERS_DIR,
  portrait: { width: PORTRAIT_W, height: PORTRAIT_H, webpQuality: PORTRAIT_Q },
  scene: { width: SCENE_W, webpQuality: SCENE_Q },
  assets: []
};

for (const rule of RULES) {
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
  provenance.assets.push({
    output: relOut,
    master: path.basename(masterPath),
    masterManifestName: rule.master,
    masterSha256: masterSha,
    outputSha256: outSha,
    bytes: (await readFile(outPath)).length
  });
  console.log(`${relOut} ← ${rule.master}`);
}

const provPath = path.join(OUT_ROOT, 'RUNTIME-PROVENANCE.json');
await writeFile(provPath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Wrote ${path.relative(REPO_ROOT, provPath)} (${provenance.assets.length} assets)`);