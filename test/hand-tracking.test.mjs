import test from 'node:test';
import assert from 'node:assert/strict';
import {HandTracking} from '../src/hand-tracking.js';
const hand=x=>Array.from({length:21},(_,i)=>({x:x+(i%4)*.008,y:.5+i*.002,z:0}));
const labels=(...names)=>names.map(categoryName=>[{categoryName}]);
function openHand(){
 const points=hand(.5);
 points[0]={x:.5,y:.8,z:0};
 for(const [base,joint,tip,x] of [[5,7,8,.35],[9,11,12,.5],[13,15,16,.65],[17,19,20,.8]]){
  points[base]={x,y:.5,z:0};points[joint]={x,y:.3,z:0};points[tip]={x,y:.1,z:0};
 }
 points[4]={x:.2,y:.55,z:0};
 return points;
}
test('mapa: una palma estable habilita índice y pinza con una sola mano',()=>{
 const t=new HandTracking(),palm=openHand(),options={allowSingleHand:true};
 assert.equal(t.update([palm],labels('Left'),0,options).hands.length,0);
 assert.equal(t.update([palm],labels('Left'),700,options).hands.length,1);
 const pointing=structuredClone(palm);
 for(const index of [12,16,20])pointing[index].y=.65;
 const selected=t.update([pointing],labels('Left'),800,options);
 assert.equal(selected.hands[0].pointing,true);
 const pinching=structuredClone(palm);
 pinching[4]={...pinching[8],x:pinching[8].x+.02};
 const dragged=t.update([pinching],labels('Left'),900,options);
 assert.equal(dragged.hands[0].pinching,true);
 assert.equal(dragged.hands[0].handIndex,selected.hands[0].handIndex);
});
test('mapa: puede comenzar con el índice sin activar con palma abierta',()=>{
 const t=new HandTracking(),pointing=openHand(),options={allowSingleHand:true};
 for(const index of [12,16,20])pointing[index].y=.65;
 assert.equal(t.update([pointing],labels('Left'),0,options).hands.length,0);
 const acquired=t.update([pointing],labels('Left'),300,options);
 assert.equal(acquired.hands.length,1);assert.equal(acquired.hands[0].pointing,true);
});
test('mapa: toma control con puño y adquiere el segundo para zoom',()=>{
 const t=new HandTracking(),fist=openHand(),options={allowSingleHand:true};
 for(const [base,tip] of [[5,8],[9,12],[13,16],[17,20]])fist[tip]={...fist[base],y:fist[base].y+.02};
 fist[4]={x:.5,y:.55,z:0};
 t.update([fist],labels('Left'),0,options);
 assert.equal(t.update([fist],labels('Left'),300,options).hands[0].fist,true);
 const second=fist.map(p=>({...p,x:p.x+.25}));
 t.update([fist,second],labels('Left','Right'),400,options);
 const both=t.update([second,fist],labels('Right','Left'),700,options);
 assert.equal(both.hands.length,2);assert.ok(both.hands.every(h=>h.fist));
});
test('mapa: retoma el índice después de perder su ID por salir del encuadre',()=>{
 const t=new HandTracking(),pointing=openHand(),options={allowSingleHand:true};
 for(const index of [12,16,20])pointing[index].y=.65;
 t.update([pointing],labels('Left'),0,options);
 const original=t.update([pointing],labels('Left'),300,options).hands[0].handIndex;
 assert.equal(t.update([],[],3000,options).hands.length,0);
 t.update([pointing],labels('Left'),3100,options);
 const recovered=t.update([pointing],labels('Left'),3400,options);
 assert.equal(recovered.hands.length,1);assert.notEqual(recovered.hands[0].handIndex,original);
});
test('mapa: conserva la mano propia visible sin dar control a terceros',()=>{
 const t=new HandTracking(),a=hand(.2),b=hand(.6),c=hand(.9);
 t.ownerIds=t.update([a,b],labels('Left','Right'),0).allHands.map(h=>h.handIndex);
 const next=t.update([c,b],labels('Left','Right'),100,{allowSingleHand:true});
 assert.equal(next.missingOwner,true);assert.equal(next.hands.length,1);
 assert.equal(next.hands[0].handIndex,t.ownerIds[1]);
});
test('maqueta: mantiene la adquisición obligatoria con dos palmas',()=>{
 const t=new HandTracking(),palm=openHand();
 t.update([palm],labels('Left'),0);
 assert.equal(t.update([palm],labels('Left'),700).hands.length,0);
});
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

test('zoom: segunda pinza reemplaza ID perdido aunque handedness coincida',()=>{
 const t=new HandTracking(),first=openHand(),options={allowSingleHand:true};
 first[4]={...first[8],x:first[8].x+.02};
 const id=t.update([first],labels('Left'),0,options).allHands[0].handIndex;
 t.ownerIds=[id,999];
 const second=first.map(p=>({...p,x:p.x+.3}));
 const pending=t.update([first,second],labels('Left','Left'),100,options);
 assert.equal(pending.pendingZoom,true);assert.equal(pending.hands.length,1);
 const acquired=t.update([second,first],labels('Left','Left'),230,options);
 assert.equal(acquired.pendingZoom,false);assert.equal(acquired.hands.length,2);
 assert.ok(acquired.hands.every(h=>h.pinching));assert.ok(!t.ownerIds.includes(999));
});

test('zoom: una sola pinza o una segunda mano sin pinza no reasignan IDs',()=>{
 const t=new HandTracking(),first=openHand(),options={allowSingleHand:true};
 first[4]={...first[8],x:first[8].x+.02};
 const id=t.update([first],labels('Left'),0,options).allHands[0].handIndex;
 t.ownerIds=[id,999];
 const second=openHand().map(p=>({...p,x:p.x+.3}));
 for(const timestamp of [100,500]){
  const sample=t.update([first,second],labels('Left','Right'),timestamp,options);
  assert.equal(sample.pendingZoom,false);assert.deepEqual(t.ownerIds,[id,999]);
 }
});

test('selección múltiple: segundo índice recupera pareja con ID perdido y etiqueta coincidente',()=>{
 const t=new HandTracking(),first=openHand(),options={allowSingleHand:true};
 for(const index of [12,16,20])first[index].y=.65;
 const id=t.update([first],labels('Left'),0,options).allHands[0].handIndex;
 t.ownerIds=[id,999];
 const second=first.map(p=>({...p,x:p.x+.3}));
 t.update([first,second],labels('Left','Left'),100,options);
 const acquired=t.update([second,first],labels('Left','Left'),400,options);
 assert.equal(acquired.hands.length,2);
 assert.ok(acquired.hands.every(h=>h.pointing));
 assert.ok(!t.ownerIds.includes(999));
 assert.equal(acquired.pendingZoom,false);
});
