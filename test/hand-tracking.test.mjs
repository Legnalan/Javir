import test from 'node:test';
import assert from 'node:assert/strict';
import {HandTracking} from '../src/hand-tracking.js';
const hand=x=>Array.from({length:21},(_,i)=>({x:x+(i%4)*.008,y:.5+i*.002,z:0}));
const labels=(...names)=>names.map(categoryName=>[{categoryName}]);
test('manos: conserva IDs al reordenar detecciones y entrar terceros',()=>{
 const t=new HandTracking(),a=hand(.2),b=hand(.6),c=hand(.9);
 const first=t.update([a,b],labels('Left','Right'),0);t.ownerIds=first.allHands.map(h=>h.handIndex);
 const next=t.update([c,b,a],labels('Left','Right','Left'),100);
 assert.deepEqual(next.hands.map(h=>h.handIndex),t.ownerIds);assert.equal(next.allHands.length,3);
 assert.equal(next.hands[0].landmarks,a);
});
test('manos: pausa al perder al controlador sin ceder a terceros y recupera IDs',()=>{
 const t=new HandTracking(),a=hand(.2),b=hand(.6),c=hand(.9);
 t.ownerIds=t.update([a,b],labels('Left','Right'),0).allHands.map(h=>h.handIndex);
 assert.equal(t.update([c,b],labels('Left','Right'),100).hands.length,0);
 assert.equal(t.update([b,a,c],labels('Right','Left','Left'),200).hands.length,2);
 t.release();assert.equal(t.ownerIds.length,0);
});
test('manos: no transfiere control tras desaparición prolongada',()=>{
 const t=new HandTracking(),a=hand(.2),b=hand(.6);
 t.ownerIds=t.update([a,b],labels('Left','Right'),0).allHands.map(h=>h.handIndex);
 assert.equal(t.update([a,b],labels('Left','Right'),3000).hands.length,0);
});
