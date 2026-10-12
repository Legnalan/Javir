import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/solar-demo.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  handleHands(hands){'),source.lastIndexOf('\n}'));
function solar(){
  const context={clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),performance:{now:()=>1000},PLANETS:[['Sol'],['Mercurio']],distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)};
  vm.createContext(context);
  const handler=vm.runInContext(`({${method}}).handleHands`,context);
  return {anchor:{x:.5,y:.5},scale:1,selected:null,selectedIds:new Set(),gestureSelections:{},gesture:null,placing:false,moves:[],
    screenPoint:p=>({...p}),pick:p=>p.x<.5?0:1,
    movePlanet(id,dx,dy){this.moves.push({id,dx,dy});},status(value){this.message=value;},handleHands:handler};
}
const pinch={handIndex:1,pinching:true,point:{x:.2,y:.3}};
test('solar: pellizco sin selección no toma el planeta debajo',()=>{
  const s=solar();s.handleHands([pinch]);s.handleHands([{...pinch,point:{x:.6,y:.3}}]);
  assert.equal(s.moves.length,0);assert.equal(s.anchor.x,.5);assert.equal(s.scale,1);
});
test('solar: pellizco mueve solo la selección previa aunque cruce otro planeta',()=>{
  const s=solar();s.handleHands([{handIndex:1,pointing:true,pointerPoint:{x:.2,y:.3}}]);
  s.handleHands([pinch]);s.handleHands([{...pinch,point:{x:.6,y:.3}}]);
  assert.equal(s.moves.at(-1).id,0);assert.ok(s.moves.at(-1).dx>0);
  assert.equal(s.anchor.x,.5);assert.equal(s.scale,1);
});
test('solar: garra mueve todo el sistema sin cambiar posiciones individuales',()=>{
  const s=solar(),claw={handIndex:1,claw:true,center:{x:.2,y:.3}};
  s.handleHands([claw]);s.handleHands([{...claw,center:{x:.4,y:.5}}]);
  assert.ok(s.anchor.x>.5);assert.ok(s.anchor.y>.5);assert.equal(s.moves.length,0);
  s.handleHands([{handIndex:1,openPalm:true}]);assert.equal(s.gesture,null);
});
test('solar: dos pellizcos hacen zoom sin mover planetas, incluso con dos selecciones',()=>{
  const s=solar();s.gestureSelections={1:0,2:1};
  const second={...pinch,handIndex:2,point:{x:.4,y:.3}};
  s.handleHands([pinch,second]);s.handleHands([{...pinch,point:{x:.1,y:.3}},{...second,point:{x:.5,y:.3}}]);
  assert.equal(s.scale,2);assert.equal(s.anchor.x,.5);assert.equal(s.moves.length,0);
  s.handleHands([{...second,point:{x:.3,y:.3}},pinch]);
  assert.ok(Math.abs(s.scale-.5)<1e-8);
  s.handleHands([pinch]);assert.equal(s.moves.length,0);
  s.handleHands([]);s.handleHands([pinch]);s.handleHands([{...pinch,point:{x:.25,y:.3}}]);
  assert.ok(s.moves.length>0);
});

test('solar: dos índices seleccionan ambos planetas y un índice vuelve a selección individual',()=>{
  const s=solar();
  const first={handIndex:1,pointing:true,pointerPoint:{x:.2,y:.3}};
  const second={handIndex:2,pointing:true,pointerPoint:{x:.7,y:.3}};
  s.handleHands([first,second]);
  assert.deepEqual([...s.selectedIds].sort(),[0,1]);
  assert.equal(s.gestureSelections[1],0);assert.equal(s.gestureSelections[2],1);
  assert.equal(s.moves.length,0);
  s.handleHands([first]);assert.deepEqual([...s.selectedIds],[0]);
  s.handleHands([first,{...second,pointerPoint:first.pointerPoint}]);
  assert.equal(s.selectedIds.size,1);
});
test('deportivo: selección usa nombres de piezas y dos pellizcos cruzan el umbral de despiece',()=>{
 const s=solar();s.names=Array.from({length:22},(_,i)=>`Pieza ${i}`);s.pick=()=>13;
 s.handleHands([{handIndex:1,pointing:true,pointerPoint:{x:.2,y:.3}}]);assert.match(s.message,/Pieza 13/);
 const second={...pinch,handIndex:2,point:{x:.4,y:.3}};
 s.handleHands([pinch,second]);s.handleHands([{...pinch,point:{x:.05,y:.3}},{...second,point:{x:.65,y:.3}}]);
 assert.ok(s.scale>2.85);assert.equal(s.selected,13);assert.equal(s.moves.length,0);
});
