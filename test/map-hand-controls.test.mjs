import test from 'node:test';
import assert from 'node:assert/strict';
import { MapHandControls } from '../src/map-hand-controls.js';

const hand = (id, x, pose) => ({ detected: true, handIndex: id, center: { x, y: .5 }, [pose]: true });
const pinch = (id, x) => ({ ...hand(id, x, 'pinching'), point: { x, y: .5 } });
function fixture() {
  const calls = { orbit: [], zoom: [], focus: 0, reset: 0 };
  const view = { controls: { getDistance: () => 1000 }, stopInertia() {},
    orbitBy: (...delta) => calls.orbit.push(delta), dollyTo: distance => calls.zoom.push(distance),
    focusSelected: () => calls.focus++ };
  const controls = new MapHandControls(view, { onReset: () => calls.reset++ });
  return { controls, calls };
}

test('puño orbita desde su punto inicial y abrir la mano suelta sin saltos al retomar', () => {
  const { controls, calls } = fixture();
  controls.update([hand(2, .4, 'fist')], 0);
  controls.update([hand(2, .43, 'fist')], 100);
  assert.ok(Math.abs(calls.orbit[0][0] - .03) < 1e-8);
  controls.update([hand(2, .6, 'openPalm')], 200);
  controls.update([hand(2, .7, 'fist')], 300);
  assert.equal(calls.orbit.length, 1);
});
test('dos puños hacen zoom proporcional aunque las detecciones cambien de orden', () => {
  const { controls, calls } = fixture();
  controls.update([hand(2, .3, 'fist'), hand(5, .5, 'fist')], 0);
  controls.update([hand(5, .6, 'fist'), hand(2, .2, 'fist')], 100);
  assert.ok(Math.abs(calls.zoom[0] - 500) < 1e-8);
  assert.equal(calls.orbit.length, 0);
  controls.update([hand(2, .2, 'fist')], 200);
  assert.equal(calls.orbit.length, 0);
});
test('pellizco y garra tienen prioridad sobre la cámara y los comandos de otra mano', () => {
  const { controls, calls } = fixture();
  for (const pose of ['pinching', 'claw']) {
    controls.update([hand(1, .4, 'thumbsUp'), hand(2, .7, pose)], 0);
    assert.equal(controls.update([hand(1, .4, 'thumbsUp'), hand(2, .7, pose)], 2000), null);
    assert.equal(controls.update([hand(1, .4, 'fist'), hand(2, .7, pose)], 2200), null);
  }
  assert.equal(calls.reset, 0); assert.equal(calls.orbit.length, 0);
});
test('V exige 750 ms estable y enfoca solo una vez hasta cambiar de postura', () => {
  const { controls, calls } = fixture();
  controls.update([hand(3, .5, 'peace')], 0);
  controls.update([hand(3, .5, 'peace')], 749);
  assert.equal(calls.focus, 0);
  controls.update([hand(3, .5, 'peace')], 750);
  controls.update([hand(3, .5, 'peace')], 3000);
  assert.equal(calls.focus, 1);
  controls.update([hand(3, .5, 'openPalm')], 3100);
  controls.update([hand(3, .5, 'peace')], 3200);
  controls.update([hand(3, .5, 'peace')], 3950);
  assert.equal(calls.focus, 2);
});
test('pulgar arriba exige 1100 ms y no repite el recentrado mientras se mantiene', () => {
  const { controls, calls } = fixture();
  controls.update([hand(3, .5, 'thumbsUp')], 0);
  controls.update([hand(3, .5, 'thumbsUp')], 1099);
  assert.equal(calls.reset, 0);
  controls.update([hand(3, .5, 'thumbsUp')], 1100);
  controls.update([hand(3, .6, 'thumbsUp')], 3000);
  assert.equal(calls.reset, 1);
});
test('movimiento, pérdida o cambio de ID cancelan el progreso del comando', () => {
  const { controls, calls } = fixture();
  controls.update([hand(3, .4, 'peace')], 0);
  controls.update([hand(3, .6, 'peace')], 700);
  controls.update([hand(3, .6, 'peace')], 800);
  assert.equal(calls.focus, 0);
  controls.update([], 900);
  controls.update([hand(3, .6, 'peace')], 1000);
  controls.update([hand(4, .6, 'peace')], 1700);
  assert.equal(calls.focus, 0);
});
test('V sin selección no enfoca ni modifica la cámara', () => {
  const { controls, calls } = fixture();
  controls.hasSelection = () => false;
  controls.update([hand(3, .5, 'peace')], 0);
  assert.equal(controls.update([hand(3, .5, 'peace')], 800).available, false);
  assert.equal(calls.focus, 0);
});

test('dos pellizcos acercan y alejan proporcionalmente, independientemente del orden', () => {
  const { controls, calls } = fixture();
  controls.update([pinch(1, .3), pinch(2, .5)], 0);
  controls.update([pinch(2, .6), pinch(1, .2)], 100);
  assert.ok(Math.abs(calls.zoom[0] - 500) < 1e-8);
  controls.update([pinch(1, .3), pinch(2, .4)], 200);
  assert.ok(Math.abs(calls.zoom[1] - 2000) < 1e-8);
  assert.equal(calls.orbit.length, 0);
});

test('salir del zoom bloquea el arrastre individual hasta abrir ambos pellizcos', () => {
  const { controls } = fixture();
  controls.update([pinch(1, .3), pinch(2, .5)], 0);
  assert.equal(controls.update([pinch(1, .3)], 100).mode, 'zoom-release');
  assert.equal(controls.update([pinch(1, .4), hand(2, .5, 'openPalm')], 200).mode, 'zoom-release');
  controls.update([hand(1, .4, 'openPalm'), hand(2, .5, 'openPalm')], 300);
  assert.equal(controls.update([pinch(1, .4)], 400), null);
});

test('pellizcos coincidentes esperan separación válida sin inventar zoom infinito', () => {
  const { controls, calls } = fixture();
  controls.update([pinch(1, .3), pinch(2, .3)], 0);
  controls.update([pinch(1, .3), pinch(2, .5)], 100);
  assert.equal(calls.zoom.length, 0);
  controls.update([pinch(1, .2), pinch(2, .6)], 200);
  assert.ok(Math.abs(calls.zoom[0] - 500) < 1e-8);
});
