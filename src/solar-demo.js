import { SolarRenderer } from './solar-renderer.js';
import { PLANETS, planetPositions, projectPoint, cameraUV, isOccluded } from './solar-math.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export class SolarDemo {
  constructor({viewport,video,onCamera,onExit,onClaim}) {
    Object.assign(this,{viewport,video,onCamera,onExit,onClaim});
    this.objectsEnabled=true;
    this.active=false;this.time=0;this.paused=false;this.offsets={};this.hidden=new Set();
    this.anchor={x:.5,y:.48};this.depth=18;this.scale=1;this.angles=[.55,0,0];
    this.bodyEnabled=true;this.bodyScale=1;this.lastBodyAt=0;this.people=0;this.selected=3;
    this.element=document.createElement('section');this.element.className='solar-demo';this.element.hidden=true;
    this.element.innerHTML=`<canvas class="solar-canvas" aria-label="Maqueta tridimensional del sistema solar"></canvas>
      <div class="solar-labels" aria-hidden="true"></div>
      <div class="solar-objects" style="position:absolute;inset:0;pointer-events:none"></div>
      <div class="solar-heading"><span class="solar-kicker">JAVIR LAB · TYPEGPU</span><strong>Sistema solar</strong><span>Escala ilustrativa · profundidad estimada</span></div>
      <div class="solar-dock">
        <div class="solar-actions"><button type="button" data-action="camera">Cámara y gestos</button><button type="button" data-action="place">Colocar en mesa</button><button type="button" data-action="pause">Pausar órbitas</button><button type="button" data-action="exit">Volver al grafo</button></div>
        <p class="solar-status" role="status">Preparando maqueta…</p>
        <p class="solar-hand-status">Muestra tus dos palmas abiertas para tomar control.</p>
        <button type="button" data-action="claim">Tomar control</button>
        <details><summary>Ajustar superficie y cuerpos</summary>
          <p>Mantén la cámara fija. Señala el centro de la mesa con el índice o haz clic en él. Ajusta inclinación y distancia; la cámara no mide un plano físico.</p>
          <label>Inclinación de la mesa <input data-field="tilt" type="range" min="5" max="85" value="32"></label>
          <label>Distancia estimada <input data-field="depth" type="range" min="8" max="40" value="18" step=".1"></label>
          <label>Tamaño <input data-field="scale" type="range" min=".15" max="2" value="1" step=".01"></label>
          <label>Ajuste de profundidad corporal <input data-field="bodyScale" type="range" min=".4" max="2.5" value="1" step=".01"></label>
          <label><input data-field="occlusion" type="checkbox" checked> Ocultar planetas solo al dar la espalda</label>
          <label><input data-field="debug" type="checkbox"> Mostrar siluetas detectadas</label>
          <label><input data-field="objectsEnabled" type="checkbox" checked> Detectar objetos (recuadros, sin profundidad)</label>
          <p class="solar-object-status">Objetos: preparando detector local…</p>
          <button type="button" data-action="reset">Recentrar y recuperar planetas</button>
          <p class="solar-body-status">Cuerpos: cámara apagada</p>
          <p>De frente o de perfil, la maqueta permanece delante. Al dar la espalda, puede quedar detrás tras una breve espera. Postura estimada: no confirma que hayas cruzado la mesa. Desmarca la opción para mantenerla siempre delante.</p>
        </details>
        <p class="solar-help">Puño + palma fija: girar y mover · dos pinzas juntas: zoom · índice y pinza: tomar planeta · dos palmas: desplazar</p>
      </div>`;
    viewport.append(this.element);this.canvas=this.element.querySelector('canvas');this.labels=this.element.querySelector('.solar-labels');
    this.labelElements=PLANETS.map(([name],i)=>{const e=document.createElement('span');e.textContent=name;e.hidden=true;this.labels.append(e);return e;});
    this.element.addEventListener('click',e=>this.click(e));
    this.element.addEventListener('input',e=>{
      const field=e.target.dataset.field;if(!field)return;
      if(field==='tilt')this.angles[0]=Number(e.target.value)*Math.PI/180;
      else if(field==='occlusion')this.bodyEnabled=e.target.checked;
      else if(field==='debug')this.debug=e.target.checked;
      else if(field==='objectsEnabled'){this.objectsEnabled=e.target.checked;this.element.querySelector('.solar-objects').replaceChildren();}
      else this[field]=Number(e.target.value);
    });
    this.canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    const release=()=>{this.drag=null;};
    this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.scale=clamp(this.scale*Math.exp(-e.deltaY*.001),.05,4);},{passive:false});
  }
  status(message){this.element.querySelector('.solar-status').textContent=message;}
  trackingStatus(message,count){this.element.querySelector('.solar-hand-status').textContent=`${count} manos detectadas · ${message||'Muestra tus dos palmas abiertas'}`;}
  showObjects(detections){
    const layer=this.element.querySelector('.solar-objects');layer.replaceChildren();
    if(!this.objectsEnabled)return;
    const names={'dining table':'mesa',chair:'silla',bottle:'botella',cup:'taza',laptop:'portátil','cell phone':'teléfono',book:'libro',couch:'sofá',tv:'pantalla'};
    this.element.querySelector('.solar-object-status').textContent=`${detections.length} objetos reconocidos · ubicación aproximada, sin profundidad`;
    for(const d of detections){
      const a=this.screenPoint(d),b=this.screenPoint({x:d.x+d.width,y:d.y+d.height});
      const box=document.createElement('div');box.textContent=`${names[d.label]||d.label} ${Math.round(d.score*100)}%`;
      Object.assign(box.style,{position:'absolute',left:`${a.x*100}%`,top:`${a.y*100}%`,width:`${(b.x-a.x)*100}%`,height:`${(b.y-a.y)*100}%`,border:'1px dashed #72e4bb',color:'#b7ffe8',fontSize:'12px',textShadow:'0 1px 3px black'});layer.append(box);
    }
    clearTimeout(this.objectsTimer);this.objectsTimer=setTimeout(()=>layer.replaceChildren(),2200);
  }
  bodyStatus(message){this.element.querySelector('.solar-body-status').textContent=message;}
  async open(){
    this.bodyFailed=false;
    this.active=true;this.element.hidden=false;this.viewport.classList.add('solar-active');
    const renderer=new SolarRenderer();this.renderer=renderer;
    try {
      await renderer.initialize(this.canvas,message=>this.status(message));
      if(!this.active || this.renderer!==renderer){renderer.destroy();return;}
      this.status('Maqueta lista. Activa cámara y gestos; después elige «Colocar en mesa».');
      this.lastFrame=performance.now();this.loop(this.lastFrame);
    } catch(error){renderer.destroy();if(this.renderer===renderer){this.status(error.message);this.renderer=null;}}
  }
  close(){
    this.active=false;cancelAnimationFrame(this.frame);this.stopBodies();this.renderer?.destroy();this.renderer=null;
    this.element.hidden=true;this.viewport.classList.remove('solar-active');this.gesture=null;this.drag=null;this.onExit?.();
  }
  stopBodies(){this.worker?.terminate();this.worker=null;this.workerReady=false;this.busy=false;this.bodyData=null;this.people=0;this.bodyEpoch=(this.bodyEpoch||0)+1;this.bodyStatus('Cuerpos: cámara apagada');}
  startBodies(){
    if(this.worker || !this.active || !this.video.srcObject)return;
    this.bodyStatus('Preparando detector local de hasta 4 personas…');
    this.worker=new Worker('/public/generated/body-worker.js');
    this.worker.onmessage=({data})=>{
      if(data.type==='ready'){this.workerReady=true;this.bodyStatus('Detector listo · buscando cuerpos');}
      else if(data.type==='result'){this.busy=false;this.acceptBodies(data);}
      else if(data.type==='objects')this.showObjects(data.detections);
      else if(data.type==='objects-error')this.element.querySelector('.solar-object-status').textContent='Objetos no disponibles: '+data.message;
      else if(data.type==='error'){this.bodyStatus('Detección corporal no disponible: '+data.message);this.worker?.terminate();this.worker=null;this.bodyFailed=true;this.busy=false;}
    };
    this.worker.onerror=()=>{this.bodyStatus('No se pudo cargar el detector corporal. Los gestos y planetas siguen disponibles.');this.worker?.terminate();this.worker=null;this.bodyFailed=true;this.busy=false;};
    this.worker.postMessage({type:'init',origin:location.origin});
  }
  acceptBodies({people,occludingPeople=0,depth,timestamp}){
    this.people=people;this.lastBodyAt=timestamp;
    this.bodyData=depth;this.renderer?.setBodyDepth(depth.data,depth.width,depth.height);
    this.bodyStatus(`${this.people} persona${this.people===1?'':'s'} · ${this.bodyEnabled && occludingPeople ? `${occludingPeople} de espaldas: oclusión habilitada` : 'maqueta delante del cuerpo'} · postura estimada`);
  }
  async captureBody(now){
    if(!this.workerReady || this.busy || now-(this.lastCapture||0)<160 || this.video.readyState<2 || !this.video.srcObject)return;
    this.busy=true;this.lastCapture=now;const epoch=this.bodyEpoch||0;const worker=this.worker;
    try {
      const bitmap=await createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.round(640*this.video.videoHeight/this.video.videoWidth)});
      if(!this.active || this.worker!==worker || (this.bodyEpoch||0)!==epoch){bitmap.close();return;}
      const rect=this.viewport.getBoundingClientRect();const fit=Math.max(rect.width/this.video.videoWidth,rect.height/this.video.videoHeight);
      const focal=rect.height*1.25/(this.video.videoHeight*fit);
      worker.postMessage({type:'frame',frame:bitmap,timestamp:now,focal,bodyScale:this.bodyScale,objects:this.objectsEnabled},[bitmap]);
    }catch{this.busy=false;}
  }
  center(width,height){return [(this.anchor.x-.5)*width/height*this.depth/1.25,(.5-this.anchor.y)*this.depth/1.25,this.depth];}
  loop(now){
    if(!this.active || !this.renderer)return;
    if(now-(this.lastRender||0)<32){this.frame=requestAnimationFrame(t=>this.loop(t));return;}
    this.lastRender=now;
    if(!document.hidden){
      if(!this.paused)this.time+=Math.min((now-this.lastFrame)/1000,.08);
      const {width,height}=this.viewport.getBoundingClientRect();
      const center=this.center(width,height);
      this.positions=planetPositions(this.time,this.angles,this.scale,center,this.offsets);
      const values=Array.from({length:32},()=>[0,0,0,0]);
      // Limitar resolución protege el seguimiento de manos y el consumo de GPU.
      const renderScale=Math.min(1,1280/width);const w=Math.max(1,Math.round(width*renderScale)),h=Math.max(1,Math.round(height*renderScale));
      values[0]=[w,h,this.video.videoWidth||1280,this.video.videoHeight||720];values[1]=[...center,this.scale];values[2]=[...this.angles,0];
      values[3]=[this.time,this.bodyEnabled && now-this.lastBodyAt<650?1:0,this.debug && now-this.lastBodyAt<650?1:0,0];
      this.positions.forEach((p,i)=>{values[4+i]=this.hidden.has(i)?[0,0,-100,0]:p;values[13+i]=[...PLANETS[i][3],1];});
      this.renderer.render(values,w,h);
      this.projected=this.positions.map(p=>projectPoint(p,width,height));
      this.projected.forEach((p,i)=>{const e=this.labelElements[i];e.hidden=!p||this.hidden.has(i)||this.covered(p,now);if(p){e.style.transform=`translate(${p.x}px,${p.y+p.radius+12}px) translateX(-50%)`;e.classList.toggle('selected',i===this.selected);}});
      if(this.video.srcObject && !this.worker && !this.bodyFailed)this.startBodies();
      if(this.bodyEnabled || this.debug || this.objectsEnabled)this.captureBody(now);
    }
    this.lastFrame=now;this.frame=requestAnimationFrame(t=>this.loop(t));
  }
  covered(p,now=performance.now()){
    if(!this.bodyEnabled || !this.bodyData || now-this.lastBodyAt>650)return false;
    const rect=this.viewport.getBoundingClientRect();const [u,v]=cameraUV(p.x,p.y,rect.width,rect.height,this.video.videoWidth,this.video.videoHeight);
    const {data,width,height}=this.bodyData;const index=(clamp(Math.floor(v*height),0,height-1)*width+clamp(Math.floor(u*width),0,width-1))*2;
    return isOccluded(p.depth,data[index],data[index+1]);
  }
  pick(point){
    const r=this.viewport.getBoundingClientRect();const x=point.x*r.width,y=point.y*r.height;
    return (this.projected||[]).map((p,i)=>({p,i})).filter(({p,i})=>p&&!this.hidden.has(i)&&!this.covered(p)&&Math.hypot(x-p.x,y-p.y)<Math.max(22,p.radius+10)).sort((a,b)=>a.p.depth-b.p.depth)[0]?.i ?? null;
  }
  movePlanet(index,dx,dy){
    const r=this.viewport.getBoundingClientRect();const z=this.positions[index][2];const name=PLANETS[index][0];
    const offset=this.offsets[name]||[0,0,0];this.offsets[name]=[offset[0]+dx*r.width*z/(r.height*1.25),offset[1]-dy*z/1.25,offset[2]];
  }
  async click(event){
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action==='exit'){this.close();return;}
    if(action==='claim'){this.onClaim?.();this.gesture=null;this.status('Muestra solo tus dos palmas abiertas durante un segundo para fijar el control.');}
    if(action==='camera'){this.bodyFailed=false;await this.onCamera();this.startBodies();}
    if(action==='place'){this.placing=true;this.gesture=null;this.status('Señala el centro de la mesa durante un segundo o haz clic en la superficie.');}
    if(action==='pause'){this.paused=!this.paused;event.target.textContent=this.paused?'Reanudar órbitas':'Pausar órbitas';}
    if(action==='reset'){this.anchor={x:.5,y:.48};this.angles=[.55,0,0];this.scale=1;this.depth=18;this.offsets={};this.hidden.clear();this.gesture=null;this.status('Maqueta recentrada. Vuelve a colocarla si moviste la cámara.');}
  }
  place(point){this.anchor={...point};this.placing=false;this.gesture=null;this.status('Centro colocado. Ajusta la inclinación para alinear las órbitas con la mesa.');}
  pointerDown(e){const r=this.canvas.getBoundingClientRect();const point={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
    if(this.placing){this.place(point);return;}
    const id=this.pick(point);if(id!==null)this.selected=id;
    this.drag={point,id,orbit:e.shiftKey};this.canvas.setPointerCapture(e.pointerId);
  }
  pointerMove(e){if(!this.drag)return;const r=this.canvas.getBoundingClientRect();const point={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};const dx=point.x-this.drag.point.x,dy=point.y-this.drag.point.y;
    if(this.drag.orbit){this.angles[1]+=dx*4;this.angles[0]+=dy*4;}
    else if(this.drag.id!==null)this.movePlanet(this.drag.id,dx,dy);
    else{this.anchor.x+=dx;this.anchor.y+=dy;}
    this.drag.point=point;
  }
  screenPoint(point){
    const r=this.viewport.getBoundingClientRect(),vw=this.video.videoWidth||r.width,vh=this.video.videoHeight||r.height;const fit=Math.max(r.width/vw,r.height/vh);
    return {x:(point.x*vw*fit-(vw*fit-r.width)/2)/r.width,y:(point.y*vh*fit-(vh*fit-r.height)/2)/r.height};
  }
  handleHands(hands){
    const now=performance.now();
    const fist=hands.find(h=>h.fist),palm=hands.find(h=>h.openPalm);
    if(fist && palm && !this.placing){
      const key=`orbit-${fist.handedness||fist.handIndex}`;
      if(this.gesture?.key!==key){this.gesture={key,since:now,fist:{...fist.center},palm:{...palm.center},orientation:{...fist.orientation},angles:[...this.angles],anchor:{...this.anchor},depth:this.depth,palmScale:fist.palmScale};}
      const g=this.gesture;
      if(distance(palm.center,g.palm)>.05){this.gesture=null;this.status('Mantén la palma abierta fija para reanudar el giro.');return;}
      if(now-g.since<350){g.orientation={...fist.orientation};g.fist={...fist.center};this.status('Preparando órbita: palma abierta quieta…');return;}
      this.angles=g.angles.map((a,i)=>a+angle(fist.orientation[['pitch','yaw','roll'][i]],g.orientation[['pitch','yaw','roll'][i]]));
      this.anchor={x:g.anchor.x+fist.center.x-g.fist.x,y:g.anchor.y+fist.center.y-g.fist.y};
      this.depth=clamp(g.depth*g.palmScale/Math.max(.015,fist.palmScale),8,40);
      this.status('Puño: giro y desplazamiento · palma abierta: referencia fija');return;
    }
    const pinches=hands.filter(h=>h.pinching);
    if(pinches.length===2 && !this.placing){
      const points=pinches.map(h=>this.screenPoint(h.point));const dist=distance(pinches[0].point,pinches[1].point);
      if(!['zoom','double'].includes(this.gesture?.key)){
        this.gesture={key:dist<=.28?'zoom':'double',distance:Math.max(.025,dist),scale:this.scale,points,ids:points.map(p=>this.pick(p))};
      }
      const g=this.gesture;
      if(g.key==='zoom'){this.scale=clamp(g.scale*dist/g.distance,.05,4);this.status('Zoom de la maqueta con dos pinzas');}
      else {g.ids.forEach((id,i)=>{if(id!==null && (i===0||id!==g.ids[0]))this.movePlanet(id,points[i].x-g.points[i].x,points[i].y-g.points[i].y);});g.points=points;this.status('Dos pinzas separadas: mueve un planeta con cada mano');}
      return;
    }
    const palms=hands.filter(h=>h.openPalm);
    if(palms.length===2 && !this.placing){const center={x:(palms[0].center.x+palms[1].center.x)/2,y:(palms[0].center.y+palms[1].center.y)/2};
      if(this.gesture?.key!=='pan')this.gesture={key:'pan',center};
      this.anchor.x+=center.x-this.gesture.center.x;this.anchor.y+=center.y-this.gesture.center.y;this.gesture.center=center;this.status('Desplazando la maqueta con dos palmas');return;
    }
    const pointer=hands.find(h=>h.pointing);
    if(pointer){const point=this.screenPoint(pointer.pointerPoint);
      if(this.placing){if(this.gesture?.key!=='place'||distance(point,this.gesture.point)>.035)this.gesture={key:'place',since:now,point};if(now-this.gesture.since>1000)this.place(point);return;}
      this.gesture=null;const id=this.pick(point);if(id!==null){this.selected=id;this.status(`${PLANETS[id][0]} · une índice y pulgar, con los otros tres dedos arriba, para tomarlo.`);}return;
    }
    if(pinches.length===1 && !this.placing){const point=this.screenPoint(pinches[0].point);
      if(this.gesture?.key!=='grab'){const id=this.pick(point);this.gesture={key:'grab',id,point};if(id!==null)this.selected=id;}
      const g=this.gesture;if(g.id!==null){this.movePlanet(g.id,point.x-g.point.x,point.y-g.point.y);this.status(`Moviendo ${PLANETS[g.id][0]}`);}g.point=point;return;
    }
    this.gesture=null;
    if(fist)this.status('Para girar, muestra también la otra palma abierta y fija.');
  }
}
