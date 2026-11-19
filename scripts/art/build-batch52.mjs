#!/usr/bin/env node
/**
 * Derive Batch 5.2 runtime WebP assets (approved production art only).
 * Masters stay in art-production/; output under assets/art/batch-5-2/
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const REVIEW = path.join(REPO, 'art-production/batch-5-2/review/review-candidates');
const APPROVED = path.join(REPO, 'art-production/batch-5-2/approved-sources');
const OUT = path.join(REPO, 'assets/art/batch-5-2');
const Q = 85;

const sharp = (await import('sharp')).default;

async function sha256File(fp) {
  const buf = await readFile(fp);
  return createHash('sha256').update(buf).digest('hex');
}

async function toWebp(masterPath, outPath, { width, height, trim = false, cropTop = 0 } = {}) {
  await mkdir(path.dirname(outPath), { recursive: true });
  let intermediate = masterPath;
  if (cropTop > 0) {
    const meta = await sharp(masterPath).metadata();
    const ht = meta.height - cropTop;
    if (ht < 8) throw new Error(`cropTop ${cropTop} too large for ${masterPath}`);
    const cropped = await sharp(masterPath)
      .extract({ left: 0, top: cropTop, width: meta.width, height: ht })
      .png()
      .toBuffer();
    intermediate = cropped;
  }
  let pipe = sharp(intermediate);
  if (trim) pipe = pipe.trim({ threshold: 12 });
  const resize = {};
  if (width) resize.width = width;
  if (height) resize.height = height;
  if (width || height) pipe = pipe.resize({ ...resize, fit: 'inside', withoutEnlargement: false });
  await pipe.webp({ quality: Q, alphaQuality: 100 }).toFile(outPath);
  const bytes = (await readFile(outPath)).length;
  const sha = await sha256File(outPath);
  return { bytes, sha, out: path.relative(REPO, outPath) };
}

const log = [];

const brassMaster = path.join(REVIEW, 'hardware/hardware_brass-knuckles_v1_REVIEW.png');
log.push(await toWebp(brassMaster, path.join(OUT, 'hardware/brass-knuckles.webp'), { width: 128, height: 128 }));
log.push(await toWebp(brassMaster, path.join(OUT, 'hardware/brass-knuckles@2x.webp'), { width: 256, height: 256 }));

const ashtrayMaster = path.join(REVIEW, 'ambient/ambient_cigarette-ashtray_v1_REVIEW.png');
log.push(
  await toWebp(ashtrayMaster, path.join(OUT, 'ambient/cigarette-ashtray.webp'), {
    cropTop: 540,
    trim: true,
    width: 280,
  })
);

const ledgerMaster = process.env.BATCH52_LEDGER_MASTER
  || path.join(REPO, 'art-production/batch-5-2/approved-sources/ui_matchbook_blank-ledger_v1.png');
await mkdir(APPROVED, { recursive: true });
if (!process.env.BATCH52_LEDGER_MASTER) {
  const srcLedger = process.argv[2]
    ? path.resolve(process.argv[2])
    : '/tmp/batch52-drive/candidates/new-matchbook-ledger/ui_matchbook_blank-ledger_v1.png';
  await copyFile(srcLedger, ledgerMaster);
}
const ledgerSha = await sha256File(ledgerMaster);
if (ledgerSha !== '1ff8ca45781cb11dbf21b2b0b93e4e5b431f7b8fdd404a071e21bebea9b075ea') {
  throw new Error(`Ledger master sha256 mismatch: ${ledgerSha}`);
}
log.push(await toWebp(ledgerMaster, path.join(OUT, 'ui/matchbook-blank-ledger.webp'), { width: 820 }));

const hudRules = [
  { master: 'hud/hud_control-face_red-enamel-blank_v1.png', out: 'hud/control-face-red-enamel.webp', width: 512 },
  { master: 'hud/hud_plays-counter_six-slot_v1.png', out: 'hud/plays-counter-six-slot.webp', width: 640 },
  { master: 'hud/hud_status-chip_paper-blank_v1.png', out: 'hud/status-chip-paper.webp', width: 480 },
  { master: 'hud/hud_status-gauge_split-blank_v1.png', out: 'hud/status-gauge-split.webp', width: 760 },
  { master: 'hud/hud_socket-square_ink_v1.png', out: 'hud/socket-square-ink.webp', width: 128, height: 128 },
  { master: 'hud/hud_socket-ring_brass_v1.png', out: 'hud/socket-ring-brass.webp', width: 128, height: 128 },
  { master: 'hud/hud_socket-arch_brass_v1.png', out: 'hud/socket-arch-brass.webp', width: 128, height: 128 },
  { master: 'hud/hud_label-backing_paper_v1.png', out: 'hud/label-backing-paper.webp', width: 420 },
];

for (const rule of hudRules) {
  log.push(await toWebp(path.join(REVIEW, rule.master), path.join(OUT, rule.out), { width: rule.width, height: rule.height }));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  webpQuality: Q,
  ledgerMasterSha256: ledgerSha,
  assets: log,
  totalBytes: log.reduce((s, e) => s + e.bytes, 0),
};
await writeFile(path.join(OUT, 'RUNTIME-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));