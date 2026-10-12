import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ModelSwipe } from '../src/model-swipe.js';
const claw = x => ({ detected: true, handIndex: 1, claw: true, center: { x, y: .45 } });
const palm=x=>({...claw(x),claw:false,openPalm:true});
const drag=(detector,xs,start=0)=>xs.map((x,i)=>detector.update([palm(x)],start+i*100));
test('palma: barrido lateral cambia en ambos sentidos sin llegar al extremo',()=>{
 assert.deepEqual(drag(new ModelSwipe(),[.35,.5,.65]),[0,0,1]);
 assert.deepEqual(drag(new ModelSwipe(),[.65,.5,.35]),[0,0,-1]);
});
test('palma: rechaza movimiento lento, vertical, pequeño, varias manos y salto de tracking',()=>{
 assert.equal(drag(new ModelSwipe(),[.5,.55,.6]).some(Boolean),false);
 for(const hand of [{...palm(.8),center:{x:.8,y:.8}},{...palm(.8),pinching:true},{...palm(.8),handIndex:2}]){
 const d=new ModelSwipe();d.update([palm(.5)],0);assert.equal(d.update([hand],200),0);
 }
 const d=new ModelSwipe();d.update([palm(.3)],0);d.update([palm(.4)],400);assert.equal(d.update([palm(.65)],800),0);
 const gap=new ModelSwipe();gap.update([palm(.3)],0);assert.equal(gap.update([palm(.8)],1000),0);
 const multi=new ModelSwipe();multi.update([palm(.3)],0);assert.equal(multi.update([palm(.7),{...palm(.7),handIndex:2}],200),0);
});
test('palma: un cambio por barrido; tracking perdido no rearma y cerrar dedos sí',()=>{
 const d=new ModelSwipe();assert.equal(drag(d,[.35,.5,.65]).at(-1),1);
 d.update([],1500);assert.equal(drag(d,[.35,.5,.65],1600).some(Boolean),false);
 d.update([claw(.5)],2000);assert.equal(drag(d,[.35,.5,.65],2100).at(-1),1);
});
test('garra: mover hasta el borde nunca cambia modelo',()=>{
 const d=new ModelSwipe();for(let i=0;i<5;i++)assert.equal(d.update([claw(.2+i*.17)],i*100),0);
});

// Prueba el cambio real de modos con el renderizador y DOM sustituidos.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function harness() {
  const noop = () => {}, button = {}, classes = new Set(['scene-invoked']);
  let resets = 0;
  const context = {
    stopModelGlide: () => {}, sceneSpatialState: null, animateModelChange: async () => [], sceneDemos: new Map(), sceneSwitching: false, solarDemo: null, gestureSelectionIds: [], gestureSelectionId: null,
    sceneInvocation: { visible: true, awaitingRelease: false },
    document: { querySelector: id => id === '#solar-launcher' ? button : {} },
    elements: { viewport: { classList: { remove: value => classes.delete(value) } }, sceneStage: { inert: false } },
    graphView: { enabled: true, setEnabled(value) { this.enabled = value; } },
    mapHandControls: { reset: noop }, interactionAudio: { stop: noop, play: noop },
    resetSceneInvocation: () => { resets++; context.sceneInvocation.visible = false; },
    setManualMenuOpen: noop, showToast: noop, startGestureControl: noop,
    SolarDemo: class {
      constructor(options) { Object.assign(this, options); this.active = false; this.position = 'preserved'; }
      handleHands() {}
      async open() { this.active = true; this.renderer = {}; }
      close() { this.active = false; this.onExit(); }
      status() {}
    }
  };
  for (const name of ['finalizeGestureMove','finalizeSceneSpatialManipulation','finalizeTwoHandGesture','finalizeGestureRotation','setGestureDetailTarget','setGestureHoverTarget','clearManualMenuGestureTarget']) context[name] = noop;
  const start = source.indexOf('async function switchSceneModel(');
  const code = source.slice(start, source.indexOf('\n}\n', start) + 2)
    .replace("const { SolarDemo } = await import('/public/generated/solar-demo.js');", 'const SolarDemo = globalSolar;')
    .replace("const { CarDemo } = mode === \"car\" ? await import('/public/generated/car-demo.js') : { CarDemo: null };", 'const CarDemo = globalCar;');
  context.globalSolar = context.SolarDemo; context.globalCar = context.SolarDemo;
  vm.createContext(context); vm.runInContext(code, context);
  return { context, resets: () => resets, button };
}
test('carrusel: grafo → solar → grafo → solar conserva visibilidad y reutiliza maqueta', async () => {
  const h = harness(), c = h.context;
  await c.switchSceneModel(true, { invoked: true });
  const solar = c.solarDemo;
  assert.equal(solar.active, true); assert.equal(c.graphView.enabled, false);
  await c.switchSceneModel(false, { invoked: true });
  assert.equal(solar.active, false); assert.equal(c.graphView.enabled, true);
  await c.switchSceneModel(true, { invoked: true });
  assert.equal(c.solarDemo, solar); assert.equal(solar.position, 'preserved');
  assert.equal(h.resets(), 0); assert.equal(c.sceneInvocation.visible, true);
  assert.equal(c.sceneSwitching, false);
});
test('carrusel: falla de renderizador recupera el grafo visible y desbloquea controles', async () => {
  const h = harness(), c = h.context;
  c.globalSolar.prototype.open = async function () { this.active = true; throw Error('GPU'); };
  await c.switchSceneModel(true, { invoked: true });
  assert.equal(c.solarDemo.active, false); assert.equal(c.graphView.enabled, true);
  assert.equal(c.sceneSwitching, false); assert.equal(h.button.disabled, false);
});

test('carrusel: la animación respeta dirección y movimiento reducido', async () => {
  const calls = [], cancelled = [];
  const layer = { animate(frames, options) {
    calls.push({ frames, options });
    return { finished: Promise.resolve(), cancel: () => cancelled.push(true) };
  } };
  let reduced = false;
  const context = { window: { matchMedia: () => ({ matches: reduced }) }, solarDemo: null, graphView: { canvas: layer }, elements: { sceneStage: layer } };
  const start = source.indexOf('async function animateModelChange(');
  vm.createContext(context);
  vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), context);
  await context.animateModelChange(1);
  assert.equal(calls[0].frames[1].translate, '100% 0');
  await context.animateModelChange(1, true);
  assert.equal(calls[2].frames[0].translate, '-100% 0');
  reduced = true;
  await context.animateModelChange(-1);
  assert.equal(calls.length, 4);
});
test('palma: handler cambia el modelo y exige recoger dedos antes de otro barrido', () => {
  let now = 0;
  const switches = [], noop = () => {};
  const context = {
    stopModelGlide: () => {}, startModelGlide: () => {}, modelSwipe: new ModelSwipe(), performance: { now: () => now },
    elements: { manualMenu: { hidden: true } }, sceneInvocation: { visible: true }, solarDemo: null,
    setGestureUi: noop, switchSceneModel: (solar, options) => switches.push({ solar, options })
  };
  const start = source.indexOf('function handleModelSwipe(');
  vm.createContext(context);
  vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), context);
  assert.equal(context.handleModelSwipe([palm(.35)]), false);
  now = 100; assert.equal(context.handleModelSwipe([palm(.5)]), false);
  now = 200; assert.equal(context.handleModelSwipe([palm(.65)]), true);
  assert.equal(switches.length, 1); assert.equal(switches[0].options.direction, 1);
  now = 1200; assert.equal(context.handleModelSwipe([palm(.35)]), true);
  assert.equal(switches.length, 1);
  now = 1300; assert.equal(context.handleModelSwipe([claw(.5)]), false);
});
test('garra: lanzamiento conserva inercia pero no cambia modelo al abrir',()=>{
 for(const direction of [-1,1]){const d=new ModelSwipe();d.update([claw(.5)],0);d.update([claw(.5+direction*.06)],70);d.update([claw(.5+direction*.14)],140);
 assert.equal(d.update([palm(.5+direction*.16)],180),0);assert.ok(Math.abs(d.released.vx)>.7);}
});
test('lanzamiento: soltar despacio conserva velocidad para inercia y no cambia modelo', () => {
  const detector = new ModelSwipe();
  detector.update([claw(.5)], 0); detector.update([claw(.52)], 100);
  assert.equal(detector.update([{ ...claw(.53), claw: false, openPalm: true }], 200), 0);
  assert.ok(detector.released.vx > 0 && detector.released.vx < .7);
});
test('lanzamiento: perder tracking, cambiar de ID o mover en vertical no dispara cambio', () => {
  for (const release of [[], [{ ...claw(.66), handIndex: 2, claw: false, openPalm: true }], [{ ...claw(.66), claw: false, pinching: true }]]) {
    const detector = new ModelSwipe(); detector.update([claw(.5)], 0); detector.update([claw(.64)], 140);
    assert.equal(detector.update(release, 180), 0); assert.equal(detector.released, null);
  }
  const detector = new ModelSwipe(); detector.update([claw(.5)], 0);
  detector.update([{ ...claw(.53), center: { x: .53, y: .64 } }], 140);
  assert.equal(detector.update([{ ...claw(.54), claw: false, openPalm: true, center: { x: .54, y: .7 } }], 180), 0);
});
for (const solar of [false, true]) test(`inercia: ${solar ? 'solar' : 'diagrama'} se desliza, frena y termina`, () => {
  const callbacks = new Map(); let next = 0, finalized = 0;
  const context = {
    modelGlideFrame: null, performance: { now: () => 0 },
    window: { matchMedia: () => ({ matches: false }) },
    requestAnimationFrame: callback => { callbacks.set(++next, callback); return next; },
    cancelAnimationFrame: id => callbacks.delete(id),
    finalizeSceneSpatialManipulation: () => { finalized++; }, updateSceneRotation: () => {},
    solarDemo: solar ? { active: true, anchor: { x: .5, y: .5 }, handleHands() {}, screenPoint: p => p } : null,
    sceneSpatialTransform: { x: 0, y: 0, z: 0 }, clampSceneSpatialTransform: p => p,
    elements: { viewport: { getBoundingClientRect: () => ({ width: 1000, height: 800 }) } }
  };
  vm.createContext(context);
  for (const name of ['stopModelGlide', 'startModelGlide']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), context);
  }
  context.startModelGlide({ vx: .4, vy: .1 });
  let time = 0;
  while (callbacks.size && time < 1000) {
    time += 50; const [id, callback] = callbacks.entries().next().value; callbacks.delete(id); callback(time);
  }
  assert.equal(context.modelGlideFrame, null); assert.equal(finalized, 1);
  const distance = solar ? context.solarDemo.anchor.x - .5 : context.sceneSpatialTransform.x / 1000;
  assert.ok(distance > .04 && distance < .06);
  context.startModelGlide({ vx: .4, vy: 0 }); context.stopModelGlide();
  assert.equal(callbacks.size, 0);
});
test('carrusel: diagrama → solar → deportivo → diagrama, reutiliza modelos y cierra anterior', async () => {
 const h=harness(),c=h.context;
 await c.switchSceneModel('solar',{invoked:true});const solar=c.solarDemo;
 await c.switchSceneModel('car',{invoked:true});const car=c.solarDemo;
 assert.notEqual(car,solar);assert.equal(solar.active,false);assert.equal(car.active,true);assert.equal(car.kind,'car');
 await c.switchSceneModel('graph',{invoked:true});assert.equal(car.active,false);assert.equal(c.graphView.enabled,true);
 await c.switchSceneModel('car',{invoked:true});assert.equal(c.solarDemo,car);assert.equal(h.resets(),0);
});
test('barrido rápido: acepta mano de canto y centro sin suavizar en 80 ms',()=>{
 for(const direction of [-1,1]){
 const d=new ModelSwipe();const hand=x=>({...palm(.5),openPalm:false,swipePalm:true,rawCenter:{x,y:.45}});
 assert.equal(d.update([hand(.5)],0),0);assert.equal(d.update([hand(.5+direction*.2)],80),direction);
 }
});
test('barrido: la garra sigue sin cambiar aunque se mueva rápido',()=>{
 const d=new ModelSwipe();d.update([claw(.3)],0);assert.equal(d.update([claw(.7)],80),0);
});
