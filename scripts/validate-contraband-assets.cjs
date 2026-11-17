#!/usr/bin/env node
'use strict';
/** Dependency-free PNG spritesheet inspection (Node 22+, RGBA/8bpp only).
 * Example: node scripts/validate-contraband-assets.cjs --root=/tmp/gutterbones-art --report=/tmp/qa.json
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const EFFECTS = ['mult','cash','wild','blood-6','echo','shiv','wirebag','ghost','fuse','magnet','mark','double-down'];
const SHEET_WIDTH = 1024, SHEET_HEIGHT = 512, CELL = 256;
const args = Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(arg=>{const i=arg.indexOf('=');return i<0?[arg.slice(2),true]:[arg.slice(2,i),arg.slice(i+1)];}));
const ROOT = path.resolve(String(args.root || path.join(__dirname,'../assets/animations/contraband')));
const REPORT = args.report && path.resolve(String(args.report));
const SIG = Buffer.from('89504e470d0a1a0a','hex');

function decodeAlpha(file) {
  const b = fs.readFileSync(file);
  if (!b.subarray(0,8).equals(SIG)) throw Error('invalid PNG header');
  let offset=8,width,height,depth,color,interlace,idat=[];
  while (offset < b.length) {
    if (offset+12>b.length) throw Error('truncated chunk');
    const len=b.readUInt32BE(offset), name=b.toString('ascii',offset+4,offset+8);
    const end=offset+12+len;
    if (end>b.length) throw Error('invalid chunk length');
    const bytes=b.subarray(offset+8,offset+8+len);
    if(name==='IHDR'){
      width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);
      depth=bytes[8];color=bytes[9];interlace=bytes[12];
    }
    if(name==='IDAT') idat.push(bytes);
    offset=end;
    if(name==='IEND') break;
  }
  if(width!==SHEET_WIDTH || height!==SHEET_HEIGHT || depth!==8 || color!==6 || interlace!==0)
    throw Error(`expected 1024x512 RGBA8 noninterlaced; got ${width}x${height} depth=${depth} colour=${color} interlace=${interlace}`);
  const inflated=zlib.inflateSync(Buffer.concat(idat));
  const stride=width*4;
  if(inflated.length!==height*(stride+1)) throw Error('unexpected scanline bytes');
  let prev=Buffer.alloc(stride,0), src=0;
  const alphaSums=Array(8).fill(0), edgeMax=Array(8).fill(0);
  for(let y=0;y<height;y++){
    const filter=inflated[src++];
    if(filter>4)throw Error('unsupported PNG filter '+filter);
    const scan=Buffer.allocUnsafe(stride);
    for(let i=0;i<stride;i++){
      const cur=inflated[src++],left=i>=4?scan[i-4]:0,up=prev[i],upperLeft=i>=4?prev[i-4]:0;
      let delta=0;
      if(filter===1)delta=left;
      else if(filter===2)delta=up;
      else if(filter===3)delta=Math.floor((left+up)/2);
      else if(filter===4){
        const p=left+up-upperLeft,da=Math.abs(p-left),db=Math.abs(p-up),dc=Math.abs(p-upperLeft);
        delta=(da<=db&&da<=dc)?left:(db<=dc?up:upperLeft);
      }
      scan[i]=(cur+delta)&255;
    }
    const row=Math.floor(y/CELL), localY=y%CELL;
    for(let x=0;x<width;x++){
      const idx=row*4+Math.floor(x/CELL),localX=x%CELL,a=scan[x*4+3];
      alphaSums[idx]+=a;
      if(localX===0||localX===CELL-1||localY===0||localY===CELL-1)
        edgeMax[idx]=Math.max(edgeMax[idx],a);
    }
    prev=scan;
  }
  return {width,height,alphaSums,edgeMax,sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};
}

function inspectAll(root=ROOT){
  const records=[];
  for(const effect of EFFECTS){
    const filename=`${effect}-8frame-spritesheet.png`;
    const entry={effect,filename,status:'PASS',errors:[]};
    try{
      const data=decodeAlpha(path.join(root,filename));
      entry.sha256=data.sha256;entry.bytes=data.bytes;
      entry.frameOpacity=data.alphaSums.map(x=>+(x/(CELL*CELL*255)).toFixed(5));
      entry.maxCellEdgeAlpha=data.edgeMax;
      if(data.edgeMax.some(a=>a>2))entry.errors.push('visible pixel touches cell edge');
      if(entry.frameOpacity[0]>0.08||entry.frameOpacity[7]>0.08)entry.errors.push('first/last frame not sufficiently faint');
      if(Math.max(...entry.frameOpacity)<0.04)entry.errors.push('effect peak too faint');
    }catch(e){entry.errors.push(e.message);}
    if(entry.errors.length)entry.status='FAIL';
    records.push(entry);
  }
  return {status:records.every(r=>r.status==='PASS')?'PASS':'FAIL',checkedAt:new Date().toISOString(),schema:'gutterbones/batch4-animation-assets/v1',root,checks:records};
}

if(require.main===module){
  const r=inspectAll(ROOT);
  if(REPORT)fs.writeFileSync(REPORT,JSON.stringify(r,null,2)+'\n');
  for(const e of r.checks)console.log(`${e.status.padEnd(4)}  ${e.effect.padEnd(12)} ${e.bytes||0} bytes ${e.errors.join('; ')}`);
  console.log(`Batch 4 assets: ${r.status}; ${r.checks.length} sheets checked`);
  if(r.status!=='PASS')process.exitCode=1;
}
module.exports={inspectAll,decodeAlpha,EFFECTS};
