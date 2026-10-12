import { analyzeHandLandmarks } from './gesture-math.js';

// IDs locales efímeros. El índice de MediaPipe cambia al entrar otra mano.
export class HandTracking {
  constructor(){this.reset();}
  reset(){this.tracks=[];this.nextId=0;this.ownerIds=[];this.candidate=null;this.zoomCandidate=null;this.selectionCandidate=null;}
  release(){this.ownerIds=[];this.candidate=null;this.zoomCandidate=null;this.selectionCandidate=null;}
  update(collection,handedness,timestamp,{allowSingleHand=false}={}){
    const previous=this.tracks.filter(t=>timestamp-t.seen<1800);
    const raw=collection.map((landmarks,index)=>({landmarks,handedness:handedness?.[index]?.[0]?.categoryName||null,
      center:{x:1-(landmarks[0].x+landmarks[9].x)/2,y:(landmarks[0].y+landmarks[9].y)/2}}));
    const pairs=[];
    raw.forEach((hand,i)=>previous.forEach((track,j)=>{
      const distance=Math.hypot(hand.center.x-track.rawCenter.x,hand.center.y-track.rawCenter.y);
      const cost=distance+(hand.handedness!==track.handedness ? .07:0);
      const fastSingle=raw.length===1&&previous.length===1&&hand.handedness===track.handedness&&timestamp-track.seen<=150;
      if(distance<(fastSingle?.45:.19))pairs.push({i,j,cost});
    }));
    pairs.sort((a,b)=>a.cost-b.cost);
    const used=new Set(),matches=new Map();
    for(const pair of pairs){if(!used.has(pair.j)&&!matches.has(pair.i)){used.add(pair.j);matches.set(pair.i,pair.j);}}
    const visible=raw.map((hand,i)=>{
      const old=matches.has(i)?previous[matches.get(i)]:null;
      const sample=analyzeHandLandmarks(hand.landmarks,{previousPoint:old?.point,previousPointerPoint:old?.pointerPoint,previousCenter:old?.center,wasPinching:old?.pinching,wasClaw:old?.claw});
      return {...sample,landmarks:hand.landmarks,handedness:hand.handedness,handIndex:old?.handIndex??this.nextId++,seen:timestamp,rawCenter:hand.center};
    });
    this.tracks=[...visible,...previous.filter((_,j)=>!used.has(j))];
    // En el mapa se puede retomar tras una pérdida prolongada del seguimiento.
    // La maqueta mantiene su asignación explícita de dos manos.
    if(allowSingleHand && this.ownerIds.length && !this.tracks.some(h=>this.ownerIds.includes(h.handIndex))) this.release();
    if(!this.ownerIds.length || (allowSingleHand && this.ownerIds.length===1)){
      // El mapa acepta directamente un índice o garra estables; no requiere
      // un gesto de activación distinto de los que utiliza la interacción.
      const palms=visible.filter(h=>h.openPalm || h.swipePalm || (allowSingleHand && (h.pointing || h.claw || h.pinching || h.fist || h.peace || h.thumbsUp))).sort((a,b)=>Math.abs(a.center.x-.5)-Math.abs(b.center.x-.5));
      const first=palms[0];
      const second=first?palms.find(h=>h!==first&&h.handedness!==first.handedness&&Math.hypot(h.center.x-first.center.x,h.center.y-first.center.y)<.75):null;
      const ids=[first,second].filter(Boolean).map(h=>h.handIndex).sort((a,b)=>a-b);
      const canAcquire=ids.length===2 || (allowSingleHand && ids.length===1);
      const keepsOwner=!this.ownerIds.length || (ids.length===2 && ids.includes(this.ownerIds[0]));
      const key=canAcquire&&keepsOwner?ids.join(','):'';
      if(!key)this.candidate=null;
      else if(this.candidate?.key!==key)this.candidate={key,since:timestamp};
      else if(timestamp-this.candidate.since>=(allowSingleHand?250:650))this.ownerIds=ids;
    }
    // Una segunda pinza explícita puede completar/reemplazar la pareja de zoom.
    // MediaPipe puede cambiar handedness o asignar otro ID al volver al cuadro.
    let pendingZoom=false;
    const ownerPinches=visible.filter(h=>this.ownerIds.includes(h.handIndex)&&h.pinching);
    const partnerPinches=visible.filter(h=>!this.ownerIds.includes(h.handIndex)&&h.pinching);
    const visibleOwners=visible.filter(h=>this.ownerIds.includes(h.handIndex));
    if(allowSingleHand && visibleOwners.length===1 && ownerPinches.length===1 && partnerPinches.length===1){
      const ids=[ownerPinches[0].handIndex,partnerPinches[0].handIndex].sort((a,b)=>a-b);
      const key=ids.join(',');
      if(this.zoomCandidate?.key!==key)this.zoomCandidate={key,since:timestamp};
      if(timestamp-this.zoomCandidate.since>=120){this.ownerIds=ids;this.zoomCandidate=null;}
      else pendingZoom=true;
    }else this.zoomCandidate=null;
    // Dos índices estables completan la selección múltiple incluso si el
    // detector cambió el ID o la etiqueta de la segunda mano.
    const ownerPointers=visible.filter(h=>this.ownerIds.includes(h.handIndex)&&h.pointing);
    const partnerPointers=visible.filter(h=>!this.ownerIds.includes(h.handIndex)&&h.pointing);
    if(allowSingleHand && visibleOwners.length===1 && ownerPointers.length===1 && partnerPointers.length===1){
      const ids=[ownerPointers[0].handIndex,partnerPointers[0].handIndex].sort((a,b)=>a-b);
      const key=ids.join(',');
      if(this.selectionCandidate?.key!==key)this.selectionCandidate={key,since:timestamp};
      else if(timestamp-this.selectionCandidate.since>=250){this.ownerIds=ids;this.selectionCandidate=null;}
    }else this.selectionCandidate=null;
    const owned=this.ownerIds.map(id=>visible.find(h=>h.handIndex===id));
    // En el mapa, una mano propia basta para seleccionar y arrastrar.
    const missing=owned.some(h=>!h);
    return {pendingZoom,allHands:visible,hands:missing&&!allowSingleHand?[]:owned.filter(Boolean),missingOwner:missing,
      controlStatus:!this.ownerIds.length?(allowSingleHand?(visible.length?'Mano detectada · apunta con el índice o forma una garra':'Sin manos detectadas · muestra una mano completa frente a la cámara'):'Muestra tus dos palmas abiertas para tomar control'):missing?(allowSingleHand?'Seguimiento perdido · vuelve a mostrar la mano para retomar':'Mantén ambas manos visibles · control en pausa; usa Tomar control si cambias de posición'):'Control fijado a tus manos'};
  }
}
