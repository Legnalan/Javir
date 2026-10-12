import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const bytes=readFileSync(new URL('../public/models/aventador.glb',import.meta.url));
const jsonLength=bytes.readUInt32LE(12),asset=JSON.parse(bytes.subarray(20,20+jsonLength));
assert.equal(asset.asset.extras.license.split(' ')[0],'CC-BY-4.0');
// Node verifica la geometría real; las texturas se verifican en el navegador.
asset.images=[];asset.textures=[];asset.materials=asset.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}));
asset.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+jsonLength).toString('base64');
globalThis.ProgressEvent ||= class {};
const model=(await new GLTFLoader().parseAsync(JSON.stringify(asset),'')).scene;
import {createSportsCar,CarRenderer} from '../src/car-renderer.js';
const dispose=car=>car.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
test('deportivo: cuatro ruedas con neumático, rin y freno; geometría finita y piezas seleccionables',()=>{
 const car=createSportsCar(model);assert.equal(car.parts.filter(p=>p.kind==='tire').length,4);
 for(const wheel of new Set(car.parts.filter(p=>p.wheel).map(p=>p.wheel))){assert.deepEqual(car.parts.filter(p=>p.wheel===wheel).map(p=>p.kind),['tire','rim','brake']);}
 const bounds=new THREE.Box3().setFromObject(car.root);assert.ok(bounds.min.toArray().every(Number.isFinite));assert.ok(bounds.max.x-bounds.min.x>4);
 car.parts.forEach((p,i)=>assert.equal(p.group.userData.part,i));dispose(car);
});
test('deportivo: despiece progresivo separa primero carrocería y luego ruedas; alejar recupera posiciones',()=>{
 const car=createSportsCar(model);car.update(1);car.parts.forEach(p=>assert.ok(p.group.position.equals(p.base)));
 car.update(1.8);assert.ok(car.parts[1].group.position.distanceTo(car.parts[1].base)>0);
 const tire=car.parts.find(p=>p.kind==='tire');assert.ok(tire.group.position.equals(tire.base));
 car.update(3);const rim=car.parts.find(p=>p.wheel===tire.wheel&&p.kind==='rim');assert.ok(rim.group.position.distanceTo(tire.group.position)>.4);
 car.update(1);car.parts.forEach(p=>assert.ok(p.group.position.equals(p.base)));dispose(car);
});
test('deportivo: acercar rueda elegida aísla sus tres componentes; alejar restaura coche completo',()=>{
 const car=createSportsCar(model),index=car.parts.findIndex(p=>p.kind==='tire');
 assert.equal(car.update(3,{},index).focus,car.parts[index].wheel);assert.equal(car.parts.filter(p=>p.group.visible).length,3);
 car.update(1,{},index);assert.ok(car.parts.every(p=>p.group.visible));dispose(car);
});
test('deportivo: raycast usa rueda completa antes del despiece y piezas individuales después',()=>{
 const r=new CarRenderer();r.car=createSportsCar(model);r.camera=new THREE.PerspectiveCamera();
 const rimId=r.car.parts.findIndex(p=>p.kind==='rim'),mesh=r.car.parts[rimId].group.children[0];
 r.raycaster={setFromCamera(){},intersectObjects(){return [{object:mesh}];}};
 r.zoom=1;assert.equal(r.pick({x:.5,y:.5}),r.car.parts[rimId].tireIndex);
 r.zoom=3;assert.equal(r.pick({x:.5,y:.5}),rimId);dispose(r.car);
});

test('Aventador: conserva todos los triángulos originales y sus UV al agrupar superficies',()=>{
 const car=createSportsCar(model);let source=0,split=0;
 model.traverse(m=>{if(m.isMesh)source+=m.geometry.index?.count||m.geometry.attributes.position.count;});
 car.root.traverse(m=>{if(m.isMesh&&m.material.name.startsWith('Lamborginhi')){split+=m.geometry.attributes.position.count;assert.ok(m.geometry.attributes.uv);}});
 assert.equal(split,source);assert.ok(car.parts.every(p=>p.group.children.length>0));dispose(car);
});
test('Aventador: neumáticos quedan huecos al separar el rin; no contienen tapas centrales',()=>{
 const car=createSportsCar(model);
 for(const p of car.parts.filter(p=>p.kind==='tire'))p.group.traverse(m=>{if(!m.isMesh)return;const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i++)assert.ok(Math.hypot(pos.getX(i),pos.getY(i))>=.1);});
 dispose(car);
});
