import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SceneInvocation } from '../src/scene-invocation.js';
const palm = { detected: true, handIndex: 4, openPalm: true, thumbIsCurled: false, center: { x: .5, y: .4 } };
function hold(gate, hand = palm, from = 0) {
  let state;
  for (let now = from; now <= from + 1000; now += 100) state = gate.update([hand], now);
  return state;
}
test('invocación: un segundo continuo revela una sola vez y exige cambiar de postura', () => {
  const gate = new SceneInvocation();
  assert.equal(gate.update([], 0).visible, false);
  gate.update([palm], 0);
  assert.equal(gate.update([palm], 100).progress, .1);
  assert.equal(hold(gate).revealed, true);
  assert.equal(gate.update([palm], 1100).revealed, undefined);
  assert.equal(gate.update([], 1200).blocked, true);
  assert.equal(gate.update([{ ...palm, openPalm: false, pointing: true }], 1300).blocked, false);
  assert.equal(gate.update([palm], 1400).visible, true);
});
test('invocación: pérdida, movimiento, cambio de mano o pausa cancelan la cuenta', () => {
  for (const interruption of [[], [{ ...palm, center: { x: .7, y: .4 } }], [{ ...palm, handIndex: 5 }]]) {
    const gate = new SceneInvocation();
    gate.update([palm], 0); gate.update([palm], 100);
    assert.equal(gate.update(interruption, 200).progress, 0);
    assert.equal(gate.update([palm], 300).visible, false);
  }
  const gate = new SceneInvocation();
  gate.update([palm], 0);
  assert.equal(gate.update([palm], 1500).progress, 0);
});
test('invocación: índice, pinza, garra y pulgar recogido no invocan; reset oculta otra vez', () => {
  for (const hand of [{ ...palm, thumbIsCurled: true }, ...['pointing', 'pinching', 'claw'].map(gesture => ({ ...palm, openPalm: false, [gesture]: true }))]) {
    assert.equal(hold(new SceneInvocation(), hand).visible, false);
  }
  const gate = new SceneInvocation(); hold(gate); gate.reset();
  assert.equal(gate.update([], 2000).visible, false);
});

// Ejecuta la integración real que bloquea los handlers del grafo y de la maqueta.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
for (const solar of [false, true]) test(`invocación: handler real bloquea ${solar ? 'solar' : 'grafo'} antes de invocar`, () => {
  let now = 0, calls = 0;
  const noop = () => {};
  const nodes = new Map();
  const classes = new Set(['scene-awaiting-invocation']);
  const context = {
    interactionAudio: { charge: noop, play: noop }, performance: { now: () => now },
    document: { querySelector: selector => {
      if (!nodes.has(selector)) nodes.set(selector, { hidden: true, style: { setProperty: noop } });
      return nodes.get(selector);
    } },
    sceneInvocation: new SceneInvocation(),
    elements: { viewport: { classList: { add: x => classes.add(x), remove: x => classes.delete(x) } }, sceneStage: { inert: true } },
    solarDemo: solar ? { active: true, status: noop, trackingStatus: noop, handleHands: () => calls++ } : null,
    graphView: { setEnabled: noop }, mapHandControls: { reset: noop },
    sceneSwitching: false, handleModelSwipe: () => false, gestureEngine: { active: true }, gestureUiFrame: 0, drawHandOverlay: noop, setGestureUi: noop
  };
  vm.createContext(context);
  for (const name of ['handleSceneInvocation', 'handleGestureFrame']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), context);
  }
  context.handleGestureFrame({ hands: [{ ...palm, openPalm: false, pointing: true }] });
  for (now = 0; now <= 1000; now += 100) context.handleGestureFrame({ hands: [palm] });
  assert.equal(context.sceneInvocation.visible, true);
  assert.equal(calls, 0);
  assert.equal(classes.has('scene-awaiting-invocation'), false);
  assert.equal(context.elements.sceneStage.inert, false);
  assert.equal(nodes.get('#invocation-prompt').hidden, true);
});

test('invocación: recuperar el seguimiento con ID nuevo no bloquea la escena para siempre', () => {
  const gate = new SceneInvocation(); hold(gate);
  assert.equal(gate.update([], 1200).blocked, true);
  assert.equal(gate.update([{ ...palm, handIndex: 9 }], 1300).blocked, true);
  assert.equal(gate.update([{ ...palm, handIndex: 9, openPalm: false, pointing: true }], 1400).blocked, false);
});
