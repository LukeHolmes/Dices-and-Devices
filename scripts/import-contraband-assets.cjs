#!/usr/bin/env node
'use strict';
/* Copy approved sheets from an extracted release archive into production.
 * Never mutates dice faces or game code; validates before copying.
 * Usage: node scripts/import-contraband-assets.cjs /path/to/extracted-zip [--dry-run]
 */
const fs=require('node:fs');
const path=require('node:path');
const {inspectAll,EFFECTS}=require('./validate-contraband-assets.cjs');
const input=process.argv.find((s,i)=>i>1 && !s.startsWith('--'));
const dryRun=process.argv.includes('--dry-run');
if(!input){console.error('Usage: node scripts/import-contraband-assets.cjs <extracted-ZIP-directory> [--dry-run]');process.exit(2);}
const source=path.resolve(input);
const destination=path.resolve(__dirname,'../assets/animations/contraband');
const result=inspectAll(source);
if(result.status!=='PASS'){
  for(const r of result.checks.filter(r=>r.status==='FAIL')) console.error(`${r.effect}: ${r.errors.join('; ')}`);
  console.error('Import aborted: invalid spritesheet inputs');process.exit(1);
}
for(const effect of EFFECTS){
  const name=`${effect}-8frame-spritesheet.png`;
  const target=path.join(destination,name);
  if(fs.existsSync(target)&&!process.argv.includes('--overwrite')){
    console.error(`Asset exists: ${target}. Re-run with --overwrite only after reviewing changes.`);process.exit(1);
  }
}
if(!dryRun){
  fs.mkdirSync(destination,{recursive:true});
  for(const effect of EFFECTS){
    const name=`${effect}-8frame-spritesheet.png`;
    fs.copyFileSync(path.join(source,name),path.join(destination,name));
  }
  fs.writeFileSync(path.join(destination,'asset-qa.json'),JSON.stringify(result,null,2)+'\n');
}
console.log(`${dryRun?'DRY RUN valid':'Copied'} ${EFFECTS.length} approved spritesheets to ${destination}`);
