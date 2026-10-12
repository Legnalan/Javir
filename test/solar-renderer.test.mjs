import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SolarRenderer } from '../src/solar-renderer.js';
import { PLANETS, planetPositions, projectPoint, rotate3 } from '../src/solar-math.js';
function frame(time=0,angles=[.55,.3,-.15],scale=1){
  const center=[1,.5,18];const values=Array.from({length:32},()=>[0,0,0,0]);
  values[0]=[1280,720,1280,720];values[1]=[...center,scale];values[2]=[...angles,0];values[3]=[time,1,0,0];
  planetPositions(time,angles,scale,center).forEach((p,i)=>values[4+i]=p);
  return values;
}
test('solar Three.js: nueve mallas esféricas, ocho órbitas y anillos con volumen y luz',()=>{
  const view=new SolarRenderer();
  assert.equal(view.planets.length,9);assert.equal(view.orbits.children.length,8);
  assert.equal(view.rings.children.length,3);assert.ok(view.sunLight.isPointLight);
  view.planets.forEach((mesh,i)=>{
    assert.ok(mesh.isMesh);assert.equal(mesh.geometry.type,'SphereGeometry');
    assert.equal(mesh.name,PLANETS[i][0]);assert.ok(mesh.material.map.isDataTexture);
  });
  view.destroy();
});
test('solar Three.js: proyección coincide con cursor y máscara del video al girar y escalar',()=>{
  const view=new SolarRenderer(),values=frame(7,[.8,.4,.2],1.5);
  view.update(values,1280,720,new Set([3,6]));
  view.planets.forEach((mesh,i)=>{
    const expected=projectPoint(values[4+i],1280,720);
    const p=mesh.position.clone().project(view.camera);
    assert.ok(Math.abs((p.x+1)*640-expected.x)<1e-8);
    assert.ok(Math.abs((1-p.y)*360-expected.y)<1e-8);
    assert.equal(mesh.children[0].visible,i===3||i===6);
  });
  const local=new THREE.Vector3(2,0,0).applyMatrix4(view.orbits.matrix);
  const expected=rotate3([2,0,0],values[2]).map((v,i)=>v*1.5+values[1][i]);
  assert.ok(local.distanceTo(new THREE.Vector3(expected[0],expected[1],-expected[2]))<1e-8);
  view.destroy();
});
test('solar Three.js: raycast elige el planeta visible más cercano y respeta ocultos',()=>{
  const view=new SolarRenderer(),values=frame();
  for(let i=0;i<9;i++)values[4+i]=[20,0,18,.5];
  values[4]=[0,0,15,.55];values[7]=[0,0,12,.19];
  view.update(values,1280,720);
  assert.equal(view.pick({x:.5,y:.5}),3);
  view.planets[3].visible=false;
  assert.equal(view.pick({x:.5,y:.5}),0);
  view.destroy();
});
