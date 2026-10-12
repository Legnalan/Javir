import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GraphThree } from '../src/graph-three.js';

function view() {
  const graph = Object.create(GraphThree.prototype);
  graph.root = new THREE.Group();
  graph.root.rotation.set(.3, -.5, .1);
  graph.root.position.set(80, -30, 12);
  graph.root.scale.setScalar(1.4);
  graph.camera = new THREE.PerspectiveCamera(45, 16 / 9, 1, 18000);
  graph.camera.position.set(400, 250, 1700);
  graph.camera.lookAt(0, 0, 0);
  graph.camera.updateMatrixWorld();
  graph.root.updateMatrixWorld(true);
  graph.depth = object => object.z;
  return graph;
}
function screen(graph, local) {
  const projected = graph.root.localToWorld(local.clone()).project(graph.camera);
  return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
}

test('arrastre 3D conserva el plano y sigue el cursor con cámara girada y modelo escalado', () => {
  const graph = view();
  const object = { x: 40, y: 35, z: 80 };
  const local = graph.localPosition(object);
  const start = screen(graph, local);
  const end = screen(graph, local.clone().add(new THREE.Vector3(160, -70, 0)));
  const result = graph.dragPosition(object, start, end);
  assert.ok(Math.abs(result.x - 50) < 1e-8);
  assert.ok(Math.abs(result.y - 45) < 1e-8);
  assert.equal(object.z, 80);
});

test('enfocar mueve cámara y objetivo sin cambiar posiciones del modelo', () => {
  const graph = view();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(148, 96, 22));
  mesh.position.set(100, 200, 80);
  graph.root.add(mesh);
  graph.records = new Map([['chosen', { mesh }]]);
  graph.selectedId = 'chosen';
  graph.controls = { target: new THREE.Vector3(), update() {} };
  graph.focusSelected();
  assert.ok(Math.abs(graph.camera.position.distanceTo(graph.controls.target) - 500) < 1e-8);
  assert.deepEqual(mesh.position.toArray(), [100, 200, 80]);
});

test('navegación WASD traslada cámara y objetivo juntos sin alterar el modelo', () => {
  const graph = view();
  graph.keys = new Set(['w']);
  graph.controls = { target: new THREE.Vector3(), getDistance: () => 1000 };
  const cameraStart = graph.camera.position.clone();
  const targetStart = graph.controls.target.clone();
  const rootStart = graph.root.position.clone();
  graph.navigate(.05);
  const cameraDelta = graph.camera.position.clone().sub(cameraStart);
  const targetDelta = graph.controls.target.clone().sub(targetStart);
  assert.ok(cameraDelta.length() > 0);
  assert.ok(cameraDelta.distanceTo(targetDelta) < 1e-8);
  assert.deepEqual(graph.root.position.toArray(), rootStart.toArray());
});

test('órbita gestual cambia solo la cámara y mantiene distancia al objetivo', () => {
  const graph = view();
  graph.controls = { target: new THREE.Vector3(), update() {} };
  const distance = graph.camera.position.length();
  const cameraStart = graph.camera.position.clone();
  const rootStart = graph.root.matrixWorld.clone();
  graph.orbitBy(.04, .03);
  assert.ok(graph.camera.position.distanceTo(cameraStart) > 1);
  assert.ok(Math.abs(graph.camera.position.length() - distance) < 1e-8);
  assert.deepEqual(graph.root.matrixWorld.elements, rootStart.elements);
});

test('zoom gestual limita distancia de cámara sin escalar el modelo', () => {
  const graph = view();
  graph.controls = { target: new THREE.Vector3(), minDistance: 180, maxDistance: 12000, update() {} };
  graph.dollyTo(10);
  assert.ok(Math.abs(graph.camera.position.length() - 180) < 1e-8);
  graph.dollyTo(90000);
  assert.ok(Math.abs(graph.camera.position.length() - 12000) < 1e-8);
  assert.equal(graph.root.scale.x, 1.4);
});

test('enfocar una selección múltiple encuadra el grupo sin mover sus objetos', () => {
  const graph = view();
  const left = new THREE.Mesh(new THREE.BoxGeometry(148, 96, 22));
  const right = left.clone();
  left.position.set(-600, 100, 0); right.position.set(600, -100, 0);
  graph.root.add(left, right);
  graph.records = new Map([['left', { mesh: left }], ['right', { mesh: right }]]);
  graph.selectedIds = new Set(['left', 'right']);
  graph.controls = { target: new THREE.Vector3(), update() {} };
  graph.focusSelected();
  const center = graph.root.localToWorld(new THREE.Vector3());
  assert.ok(graph.controls.target.distanceTo(center) < 1e-8);
  assert.ok(graph.camera.position.distanceTo(center) > 500);
  assert.deepEqual(left.position.toArray(), [-600, 100, 0]);
  assert.deepEqual(right.position.toArray(), [600, -100, 0]);
});
