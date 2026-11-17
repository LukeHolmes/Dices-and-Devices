#!/usr/bin/env node
'use strict';
// Dependency-free integrity check for an extracted Gutterbones art QA package.
// Usage: node scripts/verify-art-asset-package.cjs /absolute/path/to/Production
// No filesystem mutation; no gameplay dependencies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2] ? path.resolve(process.argv[2]) : null;
const manifestPath = path.join(__dirname, '..', 'docs', 'art-validation-batch1-4', 'production-asset-manifest.json');
if (!root || !fs.existsSync(root) || !fs.existsSync(manifestPath)) {
  console.error('Usage: node scripts/verify-art-asset-package.cjs /path/to/unzipped/Production');
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
let errors=[], scanned=0;
for (const file of manifest.assets) {
  const abs = path.resolve(root, file.path);
  if (!abs.startsWith(root + path.sep) || !fs.existsSync(abs)) { errors.push('MISSING '+file.path);continue; }
  const data = fs.readFileSync(abs);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  if (hash !== file.sha256) errors.push('HASH '+file.path);
  if (data.length !== file.bytes) errors.push('SIZE '+file.path);
  if (file.format === 'png') {
    if (data.toString('ascii', 1,4) !== 'PNG') errors.push('PNG signature '+file.path);
    else if (file.dimensions && (data.readUInt32BE(16)!==file.dimensions[0]||data.readUInt32BE(20)!==file.dimensions[1])) errors.push('PNG dimensions '+file.path);
  }
  if (file.format === 'webp' && (data.toString('ascii',0,4)!=='RIFF' || data.toString('ascii',8,12)!=='WEBP')) errors.push('WEBP signature '+file.path);
  if (/05_Animations\/.*-8frame-spritesheet\.png$/.test(file.path) && file.dimensions && (file.dimensions[0]!==1024 || file.dimensions[1]!==512)) errors.push('SPRITE dimensions '+file.path);
  scanned++;
}
const a = JSON.parse(fs.readFileSync(path.join(root,'05_Animations','animation-manifest.json'),'utf8'));
if (a.effects?.length!==12) errors.push('Expected 12 animations, got '+a.effects?.length);
console.log(JSON.stringify({scanned,expected:manifest.assets.length,effects:a.effects?.length,errors},null,2));
if (errors.length) process.exit(1);
