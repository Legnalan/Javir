// Señales digitales cortas y servomotores; la aparición combina motor + HUD.
const CUES = {
  charge: [[110, 460, .19, .032]],
  reveal: [[65, 530, .55, .048], [1480, 980, .26, .027, .34]],
  select: [[1650, 1120, .095, .026]],
  grab: [[85, 245, .20, .034]],
  release: [[310, 90, .17, .028]],
  zoom: [[130, 680, .28, .032]],
  orbit: [[210, 115, .24, .031]],
  confirm: [[1180, 1180, .075, .026], [1760, 1760, .10, .022, .11]],
  menu: [[920, 1380, .095, .025]],
  error: [[180, 95, .16, .025]]
};
const MOTOR_CUES = new Set(['charge', 'grab', 'release', 'zoom', 'orbit']);

export class InteractionAudio {
  constructor({ createContext = () => {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
  }, storage = globalThis.localStorage, now = () => performance.now() } = {}) {
    Object.assign(this, { createContext, storage, now });
    try { this.enabled = storage?.getItem('javir-sound-enabled') !== 'false'; } catch { this.enabled = true; }
    this.context = null;
    this.voices = new Set();
    this.lastCue = new Map();
    this.moving = null;
    this.chargeStep = -1;
  }

  // Debe llamarse desde un clic/tecla reales, antes de los permisos de cámara.
  async unlock() {
    if (!this.enabled) return false;
    try {
      this.context ||= this.createContext();
      if (this.context?.state === 'suspended') await this.context.resume();
      return this.context?.state === 'running';
    } catch { return false; }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try { this.storage?.setItem('javir-sound-enabled', String(enabled)); } catch { /* Almacenamiento opcional. */ }
    if (!enabled) this.stop();
  }

  play(cue, pitch = 1) {
    if (!this.enabled || this.context?.state !== 'running' || !CUES[cue]) return;
    const now = this.now();
    if (now - (this.lastCue.get(cue) ?? -Infinity) < 140 || this.voices.size >= 8) return;
    this.lastCue.set(cue, now);
    try {
      for (const [from, to, duration, volume, delay = 0] of CUES[cue]) {
        if (this.voices.size >= 8) break;
        const motor = MOTOR_CUES.has(cue) || (cue === "reveal" && delay === 0);
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const start = this.context.currentTime + delay;
        // Armónicos densos de motor y pulsos cuadrados del HUD.
        if (this.context.createPeriodicWave) {
          const real = new Float32Array(9);
          const imaginary = new Float32Array(motor
            ? [0, .6, .44, .3, .23, .18, .13, .10, .07]
            : [0, .7, 0, .24, 0, .14, 0, .08, 0]);
          oscillator.setPeriodicWave(this.context.createPeriodicWave(real, imaginary));
        } else oscillator.type = motor ? 'sawtooth' : 'square';
        // Microvariaciones escalonadas aportan vibración mecánica.
        oscillator.detune?.setValueAtTime(0, start);
        if (motor) for (let tick = .025; tick < duration; tick += .025) {
          oscillator.detune?.setValueAtTime(Math.round(tick / .025) % 2 ? 32 : -32, start + tick);
        }
        oscillator.frequency.setValueAtTime(from * pitch, start);
        oscillator.frequency.exponentialRampToValueAtTime(to * pitch, start + duration);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + .004);
        // Pulsación de servo, con rampas breves para evitar clics bruscos.
        if (motor) for (let tick = .045; tick + .018 < duration; tick += .045) {
          const fade = 1 - tick / duration;
          gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * fade * .12), start + tick);
          gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * fade), start + tick + .012);
        }
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        const nodes = [oscillator, gain];
        oscillator.connect(gain);
        if (this.context.createBiquadFilter) {
          const filter = this.context.createBiquadFilter();
          filter.type = motor ? 'bandpass' : 'lowpass';
          filter.Q.setValueAtTime(motor ? 1.8 : .8, start);
          filter.frequency.setValueAtTime(Math.max(500, from * (motor ? 5 : 3)), start);
          filter.frequency.exponentialRampToValueAtTime(Math.max(450, to * (motor ? 4 : 2)), start + duration);
          gain.connect(filter); filter.connect(this.context.destination);
          nodes.push(filter);
          // Eco único y corto: sensación espacial sin una cola que se acumule.
          if (this.context.createDelay) {
            const delay = this.context.createDelay(.2);
            const echo = this.context.createGain();
            delay.delayTime.setValueAtTime(.038, start);
            echo.gain.setValueAtTime(.12, start);
            filter.connect(delay); delay.connect(echo); echo.connect(this.context.destination);
            nodes.push(delay, echo);
          }
        } else gain.connect(this.context.destination);
        const voice = { oscillator, gain, nodes };
        this.voices.add(voice);
        oscillator.onended = () => { this.voices.delete(voice); nodes.forEach(node => node.disconnect()); };
        oscillator.start(start); oscillator.stop(start + duration + .12);
      }
    } catch { /* El audio nunca interrumpe la interacción. */ }
  }

  charge(progress, active) {
    if (!active) { this.chargeStep = -1; return; }
    const step = Math.min(3, Math.floor(progress * 4));
    if (step !== this.chargeStep) { this.chargeStep = step; this.play('charge', 1 + step * .18); }
  }

  motion(kind) {
    if (kind === this.moving) return;
    const previous = this.moving;
    this.moving = kind;
    if (kind) this.play(kind);
    else if (previous) this.play('release');
  }

  command(key, done) {
    if (key !== this.commandKey) { this.commandKey = key; this.commandDone = false; }
    if (done && !this.commandDone) { this.commandDone = true; this.play('confirm'); }
  }

  stop() {
    for (const { oscillator } of this.voices) { try { oscillator.stop(); } catch { /* Ya terminó. */ } }
    this.moving = null; this.chargeStep = -1; this.commandKey = null; this.commandDone = false;
  }

  close() { this.stop(); this.context?.close()?.catch(() => {}); }
}
