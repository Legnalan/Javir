// Palma abierta: cambia de modelo. Garra: desplazamiento con inercia al soltar.
export class ModelSwipe {
  constructor() { this.reset(); }
  reset() { this.stroke=null;this.grabStroke=null;this.latched=false;this.cooldownUntil=0;this.released=null; }
  update(hands,now) {
    this.released=null;
    const claw=hands.length===1&&hands[0].claw&&!hands[0].pinching&&hands[0].center?hands[0]:null;
    if(claw){
      const previous=this.grabStroke;
      if(!previous||previous.id!==claw.handIndex||now-previous.lastAt>300)this.grabStroke={id:claw.handIndex,points:[],lastAt:now};
      this.grabStroke.points.push({...claw.center,time:now});
      this.grabStroke.points=this.grabStroke.points.filter(p=>now-p.time<=220);this.grabStroke.lastAt=now;
    }else{
      const grab=this.grabStroke,owner=grab&&hands.find(h=>h.handIndex===grab.id&&h.openPalm&&h.center&&!h.pinching);
      if(owner&&now-grab.lastAt<=180){
        const points=[...grab.points,{...owner.center,time:now}].filter(p=>now-p.time<=220),first=points[0],last=points.at(-1),elapsed=(last.time-first.time)/1000;
        if(elapsed>=.08)this.released={vx:(last.x-first.x)/elapsed,vy:(last.y-first.y)/elapsed};
      }
      this.grabStroke=null;
    }
    const palms=hands.filter(h=>(h.openPalm||h.swipePalm)&&h.center&&!h.claw&&!h.pinching&&!h.fist&&!h.pointing);
    if(palms.length!==1||hands.length!==1){
      this.stroke=null;
      // Una pérdida de tracking no rearma el carrusel.
      if(hands.length)this.latched=false;
      return 0;
    }
    if(this.latched||now<this.cooldownUntil){this.stroke=null;return 0;}
    const hand=palms[0],point=hand.rawCenter||hand.center;
    if(!this.stroke||this.stroke.id!==hand.handIndex||now-this.stroke.lastAt>250){
      this.stroke={id:hand.handIndex,x:point.x,y:point.y,since:now,lastAt:now,samples:1};return 0;
    }
    const stroke=this.stroke;stroke.lastAt=now;stroke.samples++;
    const dx=point.x-stroke.x,dy=Math.abs(point.y-stroke.y),elapsed=now-stroke.since;
    if(elapsed>750||dy>.18){this.stroke=null;return 0;}
    if(stroke.samples>=2&&elapsed>=60&&Math.abs(dx)>=.18&&Math.abs(dx)/(elapsed/1000)>=.65&&Math.abs(dx)>dy*2){
      this.stroke=null;this.latched=true;this.cooldownUntil=now+900;this.released=null;return Math.sign(dx);
    }
    return 0;
  }
}
