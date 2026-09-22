import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, rotate3, planetPositions, projectPoint, cameraUV, estimateBodyDepth, isOccluded, bodyFacing, updateBodyOccluders, composeBodyDepth } from '../src/solar-math.js';

test('solar: ocho planetas y Sol conservan profundidad durante la órbita',()=>{
  assert.equal(PLANETS.length,9);
  const a=planetPositions(0,[.5,0,0],1,[0,0,18]);
  const b=planetPositions(10,[.5,0,0],1,[0,0,18]);
  assert.deepEqual(a[0],b[0]);assert.notEqual(a[3][2],b[3][2]);
  assert.ok(a.every(p=>p[2]>0));
});

function pose(facing='front',center=.5) {
  const points=Array.from({length:33},()=>({x:center,y:.5,z:0,visibility:1}));
  const sign=facing==='front'?1:-1;
  points[11].x=center+.12*sign;points[12].x=center-.12*sign;
  points[23].x=center+.09*sign;points[24].x=center-.09*sign;
  points[23].y=.8;points[24].y=.8;
  return points;
}
test('solar: de frente, perfil o postura ambigua no tapan; espalda requiere torso consistente',()=>{
  assert.equal(bodyFacing(pose()),'front');assert.equal(bodyFacing(pose('back')),'back');
  const partial=pose('back');partial[11].visibility=.3;assert.equal(bodyFacing(partial),'unknown');
  const twist=pose('back');[twist[23].x,twist[24].x]=[twist[24].x,twist[23].x];assert.equal(bodyFacing(twist),'unknown');
});
test('solar: estabiliza espalda y deja de ocultar al volver de frente o perder una persona',()=>{
  let tracks=updateBodyOccluders([pose('back')],[],0);
  assert.equal(tracks[0].occludes,false);
  tracks=updateBodyOccluders([pose('back')],tracks,250);assert.equal(tracks[0].occludes,false);
  tracks=updateBodyOccluders([pose('back')],tracks,500);assert.equal(tracks[0].occludes,true);
  tracks=updateBodyOccluders([pose()],tracks,550);assert.equal(tracks[0].occludes,false);
  tracks=updateBodyOccluders([pose('back')],tracks,1200);assert.equal(tracks[0].occludes,false);
});
test('solar: cada persona conserva su regla aunque el detector cambie el orden',()=>{
  let tracks=updateBodyOccluders([pose('back',.2),pose('front',.8)],[],0);
  tracks=updateBodyOccluders([pose('front',.8),pose('back',.2)],tracks,500);
  assert.deepEqual(tracks.map(t=>t.occludes),[false,true]);
});
test('solar: mantiene máscara de diagnóstico pero no profundidad oclusora cuando está de frente',()=>{
  const mask={width:2,height:2,data:new Float32Array([1,1,1,1])};
  const foreground=composeBodyDepth([pose()],[mask],1,1.25,1,[false]);
  assert.equal(foreground.data[0],0);assert.equal(foreground.data[1],1);
  const back=composeBodyDepth([pose('back')],[mask],1,1.25,1,[true]);
  assert.ok(back.data[0]>0);
});
test('solar: girar en tres ejes conserva distancias y perspectiva reduce objetos lejanos',()=>{
  const p=rotate3([1,2,3],[1,2,3]);assert.ok(Math.abs(Math.hypot(...p)-Math.sqrt(14))<1e-10);
  assert.equal(projectPoint([0,0,-1,1],100,100),null);
  assert.ok(projectPoint([0,0,10,1],100,100).radius>projectPoint([0,0,20,1],100,100).radius);
});
test('solar: la máscara coincide con video reflejado y recorte cover',()=>{
  assert.deepEqual(cameraUV(800,450,1600,900,1280,720),[.5,.5]);
  assert.deepEqual(cameraUV(0,0,1600,900,1280,720),[1,0]);
  const [u,v]=cameraUV(0,0,900,900,1600,900);
  assert.ok(u<1 && u>.5);assert.equal(v,0);
});
test('solar: la oclusión respeta delante/detrás y confianza',()=>{
  assert.equal(isOccluded(18,12,.9),true);
  assert.equal(isOccluded(10,20,.9),false);
  assert.equal(isOccluded(18,12,.2),false);
  assert.equal(isOccluded(18,0,.9),false);
});
test('solar: hombros pequeños implican distancia mayor, sin visibilidad no inventa profundidad',()=>{
  const l=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}));
  l[11].x=.4;l[12].x=.6;const near=estimateBodyDepth(l,16/9);
  l[11].x=.45;l[12].x=.55;assert.ok(estimateBodyDepth(l,16/9)>near);
  l[11].visibility=.1;assert.equal(estimateBodyDepth(l,16/9),null);
});
