import { analyzeHandLandmarks } from './gesture-math.js';

// IDs locales efímeros. El índice de MediaPipe cambia al entrar otra mano.
export class HandTracking {
  constructor(){this.reset();}
  reset(){this.tracks=[];this.nextId=0;this.ownerIds=[];this.candidate=null;}
  release(){this.ownerIds=[];this.candidate=null;}
  update(collection,handedness,timestamp){
    const previous=this.tracks.filter(t=>timestamp-t.seen<1800);
    const raw=collection.map((landmarks,index)=>({landmarks,handedness:handedness?.[index]?.[0]?.categoryName||null,
      center:{x:1-(landmarks[0].x+landmarks[9].x)/2,y:(landmarks[0].y+landmarks[9].y)/2}}));
    const pairs=[];
    raw.forEach((hand,i)=>previous.forEach((track,j)=>{
      const distance=Math.hypot(hand.center.x-track.rawCenter.x,hand.center.y-track.rawCenter.y);
      const cost=distance+(hand.handedness!==track.handedness ? .07:0);
      if(distance<.19)pairs.push({i,j,cost});
    }));
    pairs.sort((a,b)=>a.cost-b.cost);
    const used=new Set(),matches=new Map();
    for(const pair of pairs){if(!used.has(pair.j)&&!matches.has(pair.i)){used.add(pair.j);matches.set(pair.i,pair.j);}}
    const visible=raw.map((hand,i)=>{
      const old=matches.has(i)?previous[matches.get(i)]:null;
      const sample=analyzeHandLandmarks(hand.landmarks,{previousPoint:old?.point,previousPointerPoint:old?.pointerPoint,previousCenter:old?.center,wasPinching:old?.pinching});
      return {...sample,landmarks:hand.landmarks,handedness:hand.handedness,handIndex:old?.handIndex??this.nextId++,seen:timestamp,rawCenter:hand.center};
    });
    this.tracks=[...visible,...previous.filter((_,j)=>!used.has(j))];
    if(!this.ownerIds.length){
      // Adquirir con palmas abiertas, sin reaccionar a una aparición fugaz.
      const palms=visible.filter(h=>h.openPalm).sort((a,b)=>Math.abs(a.center.x-.5)-Math.abs(b.center.x-.5));
      const first=palms[0];
      const second=first?palms.find(h=>h!==first&&h.handedness!==first.handedness&&Math.hypot(h.center.x-first.center.x,h.center.y-first.center.y)<.75):null;
      const ids=[first,second].filter(Boolean).map(h=>h.handIndex).sort((a,b)=>a-b);
      const key=ids.length===2?ids.join(','):'';
      if(!key)this.candidate=null;
      else if(this.candidate?.key!==key)this.candidate={key,since:timestamp};
      else if(timestamp-this.candidate.since>=650)this.ownerIds=ids;
    }
    const owned=this.ownerIds.map(id=>visible.find(h=>h.handIndex===id));
    // Si falta una mano, no convertir un zoom en un arrastre ni ceder a terceros.
    const missing=owned.some(h=>!h);
    return {allHands:visible,hands:missing?[]:owned,
      controlStatus:!this.ownerIds.length?'Muestra tus dos palmas abiertas para tomar control':missing?'Mantén ambas manos visibles · control en pausa; usa Tomar control si cambias de posición':'Control fijado a tus manos'};
  }
}
