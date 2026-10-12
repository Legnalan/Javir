import { SolarDemo } from './solar-demo.js';
import { CarRenderer } from './car-renderer.js';
import { CAR_PART_NAMES } from './aventador-model.js';
export class CarDemo extends SolarDemo{
  constructor(options){
    super(options);this.onReveal=options.onReveal;this.angles=[0,0,0];this.kind='car';this.anchor={x:.5,y:.32};
    this.element.classList.add('car-demo');this.canvas.setAttribute('aria-label','Lamborghini Aventador 3D con piezas seleccionables');
    this.names=CAR_PART_NAMES;
    this.labels.replaceChildren();this.labelElements=this.names.map(name=>{const e=document.createElement('span');e.textContent=name;e.hidden=true;this.labels.append(e);return e;});
    this.element.querySelector('.solar-heading').innerHTML='<span class="solar-kicker">JAVIR LAB · DESPIECE INTERACTIVO</span><strong>Lamborghini Aventador</strong><span>Modelo de Arion Digital · CC BY 4.0</span>';
    this.element.querySelector('.solar-dock').innerHTML=`<div class="solar-actions"><button data-action="camera">Cámara y gestos</button><button data-action="preview">Ver sin cámara</button><button data-action="reset">Ensamblar</button><button data-action="exit">Volver al diagrama</button></div><p class="solar-status" role="status"></p><p class="solar-hand-status">Índice: selecciona · dos pellizcos: zoom y despiece · garra: mueve · palma abierta: barrido para cambiar.</p><label>Acercamiento y despiece <input aria-label="Acercamiento y despiece" data-field="scale" type="range" min=".6" max="3.2" step=".01" value="1"></label><p class="car-stage">01 · Coche ensamblado</p><details><summary>Seleccionar una pieza</summary><div class="car-parts">${this.names.map((n,i)=>`<button data-part="${i}">${n}</button>`).join('')}</div></details><p class="solar-help">Selecciona una rueda y acerca más: se separan neumático, rin y freno. Aleja para ensamblar. Mouse: rueda para zoom, Shift + arrastrar para girar.</p><p class="solar-help">Modelo: <a href="https://sketchfab.com/3d-models/lamborghini-aventador-888e37a3641d4f7b94bc1a39396e2441" target="_blank" rel="noopener">Arion Digital</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Adaptado para selección y despiece. Agrupación de superficies e interiores ilustrativos.</p>`;
  }
  startBodies(){} stopBodies(){}
  async open(){
    this.active=true;this.element.hidden=false;this.viewport.classList.add('solar-active');
    const renderer=new CarRenderer();this.renderer=renderer;
    try{await renderer.initialize(this.canvas);if(!this.active){renderer.destroy();return;}this.lastFrame=performance.now();this.loop(this.lastFrame);}
    catch(error){renderer.destroy();this.renderer=null;throw error;}
  }
  loop(now){
    if(!this.active||!this.renderer)return;
    const dt=Math.min((now-this.lastFrame)/1000,.08);this.lastFrame=now;
    this.scale=Math.max(.6,Math.min(3.2,this.scale));
    const {width,height}=this.viewport.getBoundingClientRect();const resolution=Math.min(1,1280/width);
    this.renderer.render({width:Math.round(width*resolution),height:Math.round(height*resolution),scale:this.scale,angles:this.angles,anchor:this.anchor,offsets:this.offsets,selected:this.selected,dt});
    this.labelElements.forEach((e,i)=>{e.hidden=i!==this.selected||!this.renderer.car.parts[i].group.visible;if(!e.hidden){const p=this.renderer.project(i,width,height);e.style.transform=`translate(${p.x}px,${p.y-30}px) translateX(-50%)`;e.classList.add('selected');}});
    const state=this.renderer.state;const stage=state.focus?'03 · Rueda: neumático, rin y freno':state.wheel>.05?'03 · Componentes de las ruedas':state.body>.05?'02 · Conjuntos separados':'01 · Coche ensamblado';
    this.element.querySelector('.car-stage').textContent=stage;
    const slider=this.element.querySelector('[data-field=scale]');if(document.activeElement!==slider)slider.value=this.scale;
    this.element.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.part)===this.selected)));
    this.frame=requestAnimationFrame(t=>this.loop(t));
  }
  pick(point){return this.renderer?.pick(point)??null;}
  movePlanet(index,dx,dy){const offset=this.offsets[index]||[0,0,0];this.offsets[index]=[offset[0]+dx*7,offset[1]-dy*7,offset[2]];}
  status(message){super.status(message.replaceAll('planetas','piezas').replaceAll('planeta','pieza').replaceAll('sistema','coche'));}
  async click(event){
    const part=event.target.closest('[data-part]');if(part){this.selected=Number(part.dataset.part);this.selectedIds=new Set([this.selected]);this.onSound?.('select');this.status(`${this.names[this.selected]} · acerca para explorar sus componentes.`);return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='preview'){this.onReveal?.();this.status('Coche listo. Selecciona una pieza y acerca para desarmar.');return;}
    if(action==='reset'){this.scale=1;this.offsets={};this.angles=[0,0,0];this.anchor={x:.5,y:.32};this.selected=null;this.selectedIds.clear();this.gestureSelections={};this.gesture=null;this.onSound?.('confirm');this.status('Coche ensamblado. Selecciona una pieza con el índice o con un clic.');return;}
    return super.click(event);
  }
}
