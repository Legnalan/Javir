import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { clampScenePosition, distance2D } from '../src/gesture-math.js';
import { MapHandControls } from '../src/map-hand-controls.js';

// Ejecutar los handlers reales con detecciones controladas, sin cámara física.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function harness() {
  const object = { id: 'card', title: 'Card', x: 40, y: 40 };
  const noop = () => {};
  const context = {
    interactionAudio: { play: noop, command: noop }, mapHandControls: null, graphView: null, solarDemo: null, gestureEngine: { active: true }, gestureUiFrame: 0,
    gestureMissingFrames: 0, gestureTwoHandState: null, gestureRotationState: null,
    gestureMoveState: null, gestureSelectionIds: [], gestureSelectionId: null,
    selectedId: null, selectedIds: new Set(), scene: { objects: [object] }, sceneSpatialState: null,
    sceneRotation: { x: 0, y: 0, z: 0 }, sceneSpatialTransform: { x: 0, y: 0, z: 0 },
    spatialCalibrationVersion: 0, zoom: 100, CSS: { escape: x => x },
    elements: { manualMenu: { hidden: true }, nodes: { querySelector: () => ({ classList: { add: noop, remove: noop } }) }, viewport: { getBoundingClientRect: () => ({ width: 1000, height: 800 }) } },
    sceneSwitching: false, handleModelSwipe: () => false, handleSceneInvocation: () => false, drawHandOverlay: noop, hasTwoHandPinch: () => false,
    updateManualMenuGestureTarget: () => false, findGestureTarget: () => object,
    selectObject: id => { context.selectedId = id; context.selectedIds = new Set([id]); },
    findObject: (_scene, id) => _scene.objects.find(item => item.id === id),
    cloneScene: value => structuredClone(value), clampScenePosition, distance2D,
    angleDifference: (a, b) => a - b,
    renderNodes: noop, updateVisualPositions: noop, renderInspector: noop, updateSceneRotation: noop,
    pushHistory: noop, updateSceneSummary: noop, showToast: noop,
    trackGestureDismiss: () => ({ detected: false }),
    setGestureUi: (_mode, status) => { context.status = status; }
  };
  for (const name of ['finalizeGestureMove', 'finalizeTwoHandGesture', 'finalizeGestureRotation', 'resetGestureDismiss', 'setGestureHoverTarget', 'clearManualMenuGestureTarget', 'setGestureDetailTarget']) context[name] = noop;
  vm.createContext(context);
  for (const name of ['selectObjects', 'objectDragPosition', 'clampSceneSpatialTransform', 'spatialGripPose', 'smoothSpatialGripPose', 'calibrateSceneSpatialState', 'updateSceneSpatialManipulator', 'finalizeSceneSpatialManipulation', 'handleGestureFrame']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\n}\n', start) + 2;
    vm.runInContext(source.slice(start, end), context);
  }
  return { context, object };
}
const pinch = { detected: true, handIndex: 5, pinching: true, point: { x: .4, y: .4 } };

test('pellizco sin selección previa no mueve un objeto bajo el cursor', () => {
  const { context, object } = harness();
  context.handleGestureFrame({ hands: [pinch] });
  context.handleGestureFrame({ hands: [{ ...pinch, point: { x: .6, y: .6 } }] });
  assert.equal(context.gestureMoveState, null);
  assert.equal(object.x, 40);
  assert.equal(context.status, 'Pinza sin selección');
});
test('índice selecciona y pellizco arrastra solo esa selección aunque otra mano apunte', () => {
  const { context, object } = harness();
  const index = { detected: true, handIndex: 5, pointing: true, pointerPoint: { x: .4, y: .4 } };
  context.handleGestureFrame({ hands: [index] });
  assert.equal(context.selectedId, 'card');
  context.handleGestureFrame({ hands: [pinch, { ...index, handIndex: 6 }] });
  context.handleGestureFrame({ hands: [{ ...pinch, point: { x: .5, y: .5 } }, { ...index, handIndex: 6 }] });
  assert.equal(object.x, 50);
  assert.equal(object.y, 50);
  assert.equal(context.sceneSpatialTransform.x, 0);
});
test('garra mueve todo el modelo, conserva objetos y suelta al abrir la mano', () => {
  const { context, object } = harness();
  const claw = { detected: true, handIndex: 5, claw: true, center: { x: .4, y: .4 }, palmScale: .2 };
  context.handleGestureFrame({ hands: [claw] });
  assert.equal(context.sceneSpatialState.active, true);
  context.handleGestureFrame({ hands: [{ ...claw, center: { x: .5, y: .5 } }] });
  assert.ok(context.sceneSpatialTransform.x > 0);
  assert.ok(context.sceneSpatialTransform.y > 0);
  assert.equal(object.x, 40);
  assert.equal(context.sceneRotation.z, 0);
  context.handleGestureFrame({ hands: [{ ...claw, claw: false, openPalm: true, point: claw.center }] });
  assert.equal(context.sceneSpatialState, null);
});
test('puño cerrado no toma ni mueve el modelo', () => {
  const { context } = harness();
  for (const x of [.4, .6]) context.handleGestureFrame({ hands: [{ detected: true, handIndex: 5, fist: true, center: { x, y: .4 }, point: { x, y: .4 } }] });
  assert.equal(context.sceneSpatialState, null);
  assert.equal(context.sceneSpatialTransform.x, 0);
});

test('handler del mapa dirige puño y V a cámara y conserva objetos y selección', () => {
  const { context, object } = harness();
  let now = 0, orbit = 0, focused = 0;
  context.performance = { now: () => now };
  context.mapHandControls = new MapHandControls({ controls: { getDistance: () => 1000 }, stopInertia() {}, orbitBy() { orbit++; }, focusSelected() { focused++; } });
  context.handleGestureFrame({ hands: [{ detected: true, handIndex: 5, fist: true, center: { x: .4, y: .4 } }] });
  now = 100;
  context.handleGestureFrame({ hands: [{ detected: true, handIndex: 5, fist: true, center: { x: .43, y: .4 } }] });
  assert.equal(orbit, 1); assert.equal(context.status, 'Puño: girando la vista');
  context.handleGestureFrame({ hands: [{ detected: true, handIndex: 5, peace: true, center: { x: .43, y: .4 } }] });
  now = 850;
  context.handleGestureFrame({ hands: [{ detected: true, handIndex: 5, peace: true, center: { x: .43, y: .4 } }] });
  assert.equal(focused, 1); assert.equal(context.status, 'Selección enfocada');
  assert.equal(object.x, 40); assert.equal(context.gestureMoveState, null);
});

test('selección en arrastre se detiene al adquirir segunda pinza y cambia a zoom', () => {
  const { context, object } = harness();
  const zooms = [];
  context.performance = { now: () => 1000 };
  context.mapHandControls = new MapHandControls({ controls: { getDistance: () => 1000 }, stopInertia() {}, dollyTo: value => zooms.push(value) });
  context.selectedId = 'card'; context.gestureSelectionIds[5] = 'card';
  context.gestureMoveState = { objectId: 'card', startX: 40, startY: 40, startPoint: { x: .4, y: .4 } };
  context.finalizeGestureMove = () => { context.gestureMoveState = null; };
  context.handleGestureFrame({ pendingZoom: true, hands: [{ ...pinch, point: { x: .5, y: .4 } }] });
  assert.equal(object.x, 40); assert.equal(context.gestureMoveState, null);
  const second = { ...pinch, handIndex: 6, point: { x: .6, y: .4 } };
  context.handleGestureFrame({ hands: [pinch, second] });
  context.handleGestureFrame({ hands: [{ ...second, point: { x: .7, y: .4 } }, { ...pinch, point: { x: .3, y: .4 } }] });
  assert.ok(Math.abs(zooms[0] - 500) < 1e-8);
  assert.equal(object.x, 40); assert.equal(context.status, 'Dos pellizcos: zoom');
});

const indexHand = (handIndex, x) => ({ detected: true, handIndex, pointing: true, pointerPoint: { x, y: .4 } });
function multipleHarness() {
  const result = harness();
  result.second = { id: 'second', title: 'Second', x: 70, y: 40 };
  result.context.scene.objects.push(result.second);
  result.context.findGestureTarget = point => point.x < .5 ? result.object : result.second;
  return result;
}
test('dos índices seleccionan objetos distintos juntos y cada mano conserva su objetivo', () => {
  const { context, object, second } = multipleHarness();
  context.handleGestureFrame({ hands: [indexHand(5, .4), indexHand(6, .7)] });
  assert.deepEqual([...context.selectedIds].sort(), ['card', 'second']);
  assert.equal(context.gestureSelectionIds[5], 'card');
  assert.equal(context.gestureSelectionIds[6], 'second');
  assert.equal(context.status, 'Selección múltiple: 2 objetos');
  const primary = context.selectedId;
  context.handleGestureFrame({ hands: [indexHand(6, .7), indexHand(5, .4)] });
  assert.equal(context.selectedId, primary);
  context.handleGestureFrame({ hands: [{ ...pinch, handIndex: 6, point: { x: .7, y: .4 } }] });
  context.handleGestureFrame({ hands: [{ ...pinch, handIndex: 6, point: { x: .8, y: .4 } }] });
  assert.equal(object.x, 40);
  assert.ok(Math.abs(second.x - 80) < 1e-8);
});
test('apuntar al mismo objeto no duplica selección; un índice regresa a selección individual', () => {
  const { context } = multipleHarness();
  context.handleGestureFrame({ hands: [indexHand(5, .4), indexHand(6, .4)] });
  assert.equal(context.selectedIds.size, 1);
  context.handleGestureFrame({ hands: [indexHand(5, .4), indexHand(6, .7)] });
  context.handleGestureFrame({ hands: [indexHand(5, .4)] });
  assert.deepEqual([...context.selectedIds], ['card']);
});
test('selección múltiple conserva ambas posiciones cuando dos pellizcos hacen zoom', () => {
  const { context, object, second } = multipleHarness();
  const zooms = [];
  context.performance = { now: () => 1000 };
  context.mapHandControls = new MapHandControls({ controls: { getDistance: () => 1000 }, stopInertia() {}, dollyTo: value => zooms.push(value) });
  context.handleGestureFrame({ hands: [indexHand(5, .4), indexHand(6, .7)] });
  const other = { ...pinch, handIndex: 6, point: { x: .6, y: .4 } };
  context.handleGestureFrame({ hands: [pinch, other] });
  context.handleGestureFrame({ hands: [{ ...pinch, point: { x: .3, y: .4 } }, { ...other, point: { x: .7, y: .4 } }] });
  assert.ok(Math.abs(zooms[0] - 500) < 1e-8);
  assert.equal(object.x, 40); assert.equal(second.x, 70);
  assert.equal(context.selectedIds.size, 2);
});
