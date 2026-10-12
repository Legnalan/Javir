import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractionAudio } from '../src/interaction-audio.js';
function harness() {
  let now = 0, resumes = 0;
  const oscillators = [], gains = [], saved = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const context = { state: 'suspended', currentTime: 0, destination: {},
    resume: async () => { resumes++; context.state = 'running'; },
    createOscillator: () => {
      const oscillator = { frequency: param(), connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; } };
      oscillators.push(oscillator); return oscillator;
    },
    createGain: () => { const gain = { gain: param(), connect(target) { this.target = target; }, disconnect() {} }; gains.push(gain); return gain; }
  };
  const audio = new InteractionAudio({ createContext: () => context, now: () => now,
    storage: { getItem: () => null, setItem: (...value) => saved.push(value) } });
  return { audio, context, oscillators, gains, saved, later: () => { now += 500; }, resumes: () => resumes };
}
test('audio: no reproduce antes de desbloquear; conecta a la salida y libera recursos al terminar', async () => {
  const h = harness(); h.audio.play('reveal'); assert.equal(h.oscillators.length, 0);
  assert.equal(await h.audio.unlock(), true); assert.equal(h.resumes(), 1);
  h.audio.play('select'); assert.equal(h.oscillators.length, 1);
  assert.equal(h.gains[0].target, h.context.destination);
  h.oscillators[0].onended(); assert.equal(h.audio.voices.size, 0);
});
test('audio: gesto sostenido y comando completado solo suenan una vez; soltar tiene señal propia', async () => {
  const h = harness(); await h.audio.unlock();
  h.audio.motion('grab'); h.later(); h.audio.motion('grab');
  assert.equal(h.oscillators.length, 1);
  h.audio.motion(null); assert.equal(h.oscillators.length, 2);
  h.audio.command('focus', true); h.later(); h.audio.command('focus', true);
  assert.equal(h.oscillators.length, 4);
});
test('audio: carga por etapas y límite de voces evitan saturar el seguimiento', async () => {
  const h = harness(); await h.audio.unlock();
  h.audio.charge(.1, true); h.later(); h.audio.charge(.15, true);
  assert.equal(h.oscillators.length, 1);
  h.audio.charge(.3, true); assert.equal(h.oscillators.length, 2);
  for (let i = 0; i < 20; i++) { h.later(); h.audio.play('select'); }
  assert.ok(h.audio.voices.size <= 8);
});
test('audio: silenciar detiene voces activas, recuerda preferencia y bloquea sonidos nuevos', async () => {
  const h = harness(); await h.audio.unlock(); h.audio.play('reveal');
  h.audio.setEnabled(false); h.later(); h.audio.play('select');
  assert.equal(h.oscillators.length, 2);
  assert.ok(h.oscillators.every(voice => voice.stopped));
  assert.deepEqual(h.saved, [['javir-sound-enabled', 'false']]);
  assert.equal(await h.audio.unlock(), false);
});
test('audio: fallos de almacenamiento y audio ausente no impiden interactuar', async () => {
  const audio = new InteractionAudio({ storage: { getItem() { throw Error(); }, setItem() { throw Error(); } }, createContext: () => null });
  assert.equal(await audio.unlock(), false);
  assert.doesNotThrow(() => { audio.play('reveal'); audio.setEnabled(false); audio.close(); });
});
test('audio robótico: combina motor y HUD, filtro y eco; libera toda la cadena', async () => {
  const h = harness(), effects = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => {
    const result = { ...extra, connect() {}, disconnect() { this.disconnected = true; } };
    effects.push(result); return result;
  };
  h.context.createPeriodicWave = (real, imaginary) => ({ real, imaginary });
  const createOscillator = h.context.createOscillator;
  h.context.createOscillator = () => {
    const result = createOscillator();
    result.setPeriodicWave = wave => { result.wave = wave; };
    return result;
  };
  h.context.createBiquadFilter = () => node({ Q: param(), frequency: param() });
  h.context.createDelay = () => node({ delayTime: param() });
  await h.audio.unlock(); h.audio.play('reveal');
  assert.equal(h.oscillators.length, 2);
  assert.ok(h.oscillators.every(oscillator => oscillator.wave.imaginary[3] > 0));
  assert.equal(effects.length, 4);
  assert.equal(effects[0].type, 'bandpass');
  assert.equal(effects[2].type, 'lowpass');
  assert.ok(h.oscillators[0].wave.imaginary[2] > 0);
  assert.equal(h.oscillators[1].wave.imaginary[2], 0);
  h.oscillators.forEach(oscillator => oscillator.onended());
  assert.ok(effects.every(effect => effect.disconnected));
  assert.equal(h.audio.voices.size, 0);
});
