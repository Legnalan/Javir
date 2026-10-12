// La invocación no forma parte de la escena guardada: cada escenario empieza oculto.
export class SceneInvocation {
  constructor() { this.reset(); }

  reset() {
    this.visible = false;
    this.awaitingRelease = false;
    this.hold = null;
  }

  cancelHold() { this.hold = null; }

  update(hands, now) {
    if (this.visible) {
      if (this.awaitingRelease) {
        // Perder la mano no cuenta como cambiar de postura.
        const owner = hands.find(hand => hand.handIndex === this.invoker);
        if (owner && !owner.openPalm) this.awaitingRelease = false;
        else if (!owner && hands.length && hands.every(hand => !hand.openPalm)) {
          // Un ID nuevo tras recuperar el seguimiento también puede cambiar de postura.
          this.awaitingRelease = false;
        }
      }
      return { visible: true, blocked: this.awaitingRelease, progress: 0 };
    }
    const palm = hands.find(hand => hand.openPalm && !hand.thumbIsCurled && hand.center);
    if (!palm) {
      this.cancelHold();
      return { visible: false, blocked: true, progress: 0 };
    }
    const moved = this.hold && Math.hypot(palm.center.x - this.hold.center.x, palm.center.y - this.hold.center.y) > .08;
    if (!this.hold || this.hold.id !== palm.handIndex || moved || now - this.hold.lastAt > 250) {
      this.hold = { id: palm.handIndex, center: { ...palm.center }, since: now, lastAt: now };
    }
    this.hold.lastAt = now;
    const progress = Math.min(1, (now - this.hold.since) / 1000);
    if (progress === 1) {
      this.visible = true;
      this.awaitingRelease = true;
      this.invoker = palm.handIndex;
      this.cancelHold();
    }
    return { visible: this.visible, blocked: true, progress, center: palm.center, revealed: this.visible };
  }
}
