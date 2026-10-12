// Dos pellizcos controlan zoom; un pellizco y garra manipulan objetos/modelo.
export class MapHandControls {
  constructor(view, { onReset, hasSelection = () => true } = {}) {
    Object.assign(this, { view, onReset, hasSelection });
    this.reset();
  }

  reset() { this.motion = null; this.hold = null; this.waitPinchRelease = false; }

  update(hands, now) {
    const visible = hands.filter(hand => hand.detected);
    const pinches = visible.filter(hand => hand.pinching && hand.point).sort((a, b) => a.handIndex - b.handIndex);
    if (pinches.length >= 2) {
      this.hold = null; this.waitPinchRelease = false;
      const key = `pinch-zoom:${pinches.map(hand => hand.handIndex).join(',')}`;
      const separation = Math.hypot(pinches[0].point.x - pinches[1].point.x, pinches[0].point.y - pinches[1].point.y);
      if (this.motion?.key !== key || this.motion.separation <= .02) {
        this.view.stopInertia();
        this.motion = { key, separation, distance: this.view.controls.getDistance() };
      } else if (separation > .02) this.view.dollyTo(this.motion.distance * this.motion.separation / separation);
      return { mode: 'pinch-zoom' };
    }
    if (this.motion?.key.startsWith('pinch-zoom:')) { this.motion = null; this.waitPinchRelease = true; }
    if (this.waitPinchRelease && pinches.length) return { mode: 'zoom-release' };
    this.waitPinchRelease = false;
    if (!visible.length || visible.some(hand => hand.pinching || hand.claw)) {
      this.reset(); return null;
    }
    const command = visible.find(hand => hand.thumbsUp) || visible.find(hand => hand.peace);
    if (command?.center) {
      this.motion = null;
      const action = command.thumbsUp ? 'reset' : 'focus';
      const key = `${action}:${command.handIndex}`;
      const duration = action === 'reset' ? 1100 : 750;
      if (this.hold?.key !== key || (!this.hold.fired && Math.hypot(command.center.x - this.hold.point.x, command.center.y - this.hold.point.y) > .04)) {
        this.hold = { key, since: now, point: { ...command.center }, fired: false };
      }
      const progress = Math.min(1, (now - this.hold.since) / duration);
      if (progress >= 1 && !this.hold.fired) {
        this.hold.fired = true;
        if (action === 'reset') this.onReset?.();
        else if (this.hasSelection()) this.view.focusSelected();
      }
      return { mode: action, progress, done: this.hold.fired, available: action === 'reset' || this.hasSelection() };
    }
    this.hold = null;
    const fists = visible.filter(hand => hand.fist && hand.center).sort((a, b) => a.handIndex - b.handIndex);
    if (!fists.length) { this.motion = null; return null; }
    const mode = fists.length >= 2 ? 'zoom' : 'orbit';
    const key = `${mode}:${fists.map(hand => hand.handIndex).join(',')}`;
    const separation = mode === 'zoom' ? Math.hypot(fists[0].center.x - fists[1].center.x, fists[0].center.y - fists[1].center.y) : 0;
    if (this.motion?.key !== key) {
      this.view.stopInertia();
      this.motion = { key, point: { ...fists[0].center }, separation, distance: this.view.controls.getDistance() };
      return { mode };
    }
    if (mode === 'zoom') {
      if (this.motion.separation > .06 && separation > .06) this.view.dollyTo(this.motion.distance * this.motion.separation / separation);
    } else {
      const dx = fists[0].center.x - this.motion.point.x;
      const dy = fists[0].center.y - this.motion.point.y;
      if (Math.hypot(dx, dy) < .18) this.view.orbitBy(Math.max(-.04, Math.min(.04, dx)), Math.max(-.04, Math.min(.04, dy)));
      this.motion.point = { ...fists[0].center };
    }
    return { mode };
  }
}
