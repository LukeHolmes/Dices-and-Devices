'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EFFECTS, createRenderer } = require('../assets/animations/contraband-fx.js');

function fakeDom(reduced = false) {
  let rafId = 0;
  const queue = new Map();
  const children = [];
  const doc = {
    hidden: false,
    body: {appendChild(node) { node.isConnected = true; children.push(node); }},
    createElement() {
      return { style: {}, dataset: {}, isConnected: false,
        setAttribute() {}, remove() { this.isConnected = false; const idx=children.indexOf(this); if (idx !== -1) children.splice(idx,1); } };
    },
    addEventListener() {}, removeEventListener() {},
  };
  const win = {
    document: doc,
    matchMedia: () => ({matches: reduced}),
    requestAnimationFrame(callback) { const id = ++rafId; queue.set(id, callback); return id; },
    cancelAnimationFrame(id) { queue.delete(id); },
  };
  const anchor = (x=0) => ({isConnected:true, getBoundingClientRect() {return {left:x,top:100,width:64,height:64};}});
  function tick(t) { const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(t)); }
  return {win, doc, anchor, tick, children};
}

test('all twelve approved effect identifiers are supported',()=>{
  assert.equal(EFFECTS.length,12);
  assert.equal(new Set(EFFECTS).size,12);
});
test('8 frames: progresses from sheet first to last cell and cleans up',()=>{
  const d=fakeDom(); const r=createRenderer({window:d.win});
  const a=d.anchor(); const played=r.play('echo',a,{eventId:'score-1'});
  assert.equal(played.played,true);
  assert.equal(r.activeCount(),1);
  d.tick(1000);assert.equal(d.children[0].style.backgroundPosition,'0% 0%');
  d.tick(1000+95*3);assert.equal(d.children[0].style.backgroundPosition,'100% 0%');
  d.tick(1000+95*4);assert.equal(d.children[0].style.backgroundPosition,'0% 100%');
  d.tick(1000+95*7);assert.equal(d.children[0].style.backgroundPosition,'100% 100%');
  d.tick(1000+95*8);assert.equal(r.activeCount(),0);assert.equal(d.children.length,0);
});
test('rerender does not stack on same die; stale RAF is removed',()=>{
  const d=fakeDom();const r=createRenderer({window:d.win});const a=d.anchor();
  r.play('mult',a,{eventId:'a'});r.play('cash',a,{eventId:'b'});
  assert.equal(r.activeCount(),1);assert.equal(d.children.length,1);
  assert.equal(d.children[0].dataset.gbContrabandEffect,'cash');
  assert.equal(r.play('cash',a,{eventId:'b'}).reason,'duplicate-event');
  r.destroy();assert.equal(d.children.length,0);
});
test('reduced motion renders no animation',()=>{
  const d=fakeDom(true);const r=createRenderer({window:d.win});
  assert.equal(r.play('wild',d.anchor()).reason,'reduced-motion');
  assert.equal(d.children.length,0);
});
test('invalid or detached anchors are ignored',()=>{
  const d=fakeDom();const r=createRenderer({window:d.win});
  assert.equal(r.play('unknown',d.anchor()).reason,'unknown-effect');
  assert.equal(r.play('echo',{}).reason,'missing-anchor');
});
test('bounded concurrency limits overlapping effects',()=>{
  const d=fakeDom();const r=createRenderer({window:d.win,maxConcurrent:2});
  r.play('mult',d.anchor(1));r.play('cash',d.anchor(2));r.play('wild',d.anchor(3));
  assert.equal(r.activeCount(),2);assert.equal(d.children.length,2);
  r.cancelAll();assert.equal(d.children.length,0);
});
