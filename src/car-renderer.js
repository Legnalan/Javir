import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSportsCar } from './aventador-model.js';
export { createSportsCar } from './aventador-model.js';
export class CarRenderer{
  async initialize(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.05,100);const gltf=await new GLTFLoader().loadAsync('/public/models/aventador.glb');this.car=createSportsCar(gltf.scene);gltf.scene.traverse(o=>o.geometry?.dispose());this.scene.add(this.car.root);
    const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;environment.dispose();pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xc5edff,0x283145,1.5));
    for(const [pos,power]of [[[ -4,7,5],2.5],[[3,4,-4],2]]){const l=new THREE.DirectionalLight(0xffffff,power);l.position.fromArray(pos);this.scene.add(l);}
    this.raycaster=new THREE.Raycaster();this.target=new THREE.Vector3();this.zoom=1;
  }
  render({width,height,scale,angles,anchor,offsets,selected,dt}){
    this.renderer.setSize(Math.max(1,width),Math.max(1,height),false);this.camera.aspect=width/height;
    this.zoom=THREE.MathUtils.lerp(this.zoom,THREE.MathUtils.clamp(scale,.6,3.2),1-Math.exp(-dt*9));
    this.state=this.car.update(this.zoom,offsets,selected);const root=this.car.root;
    root.rotation.set(angles[0],angles[1],angles[2]);root.updateMatrixWorld(true);
    const goal=this.state.focus?this.car.parts[selected].base.clone().applyMatrix4(root.matrixWorld):new THREE.Vector3(0,.7,0);
    this.target.lerp(goal,1-Math.exp(-dt*7));
    const framing=Math.max(1,1.15/this.camera.aspect);
    const distance=(this.state.focus?3.8:8.8/Math.min(this.zoom,1.4)+this.state.body*2.3)*framing;
    this.camera.position.copy(this.target).add(new THREE.Vector3(-distance*.68,distance*.27,distance*.82));this.camera.lookAt(this.target);
    this.camera.setViewOffset(width,height,(.5-anchor.x)*width,(.5-anchor.y)*height,width,height);this.camera.updateProjectionMatrix();
    this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
  }
  pick(point){
    this.raycaster.setFromCamera(new THREE.Vector2(point.x*2-1,1-point.y*2),this.camera);
    const hit=this.raycaster.intersectObjects(this.car.root.children,true).find(h=>{let g=h.object;while(g.parent&&g.userData.part==null)g=g.parent;return g.visible;});
    if(!hit)return null;let g=hit.object;while(g.userData.part==null&&g.parent)g=g.parent;
    const id=g.userData.part;return this.zoom<2.15&&this.car.parts[id].wheel?this.car.parts[id].tireIndex:id;
  }
  project(index,width,height){const p=this.car.parts[index].group.getWorldPosition(new THREE.Vector3()).project(this.camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
  destroy(){const textures=new Set();this.scene?.traverse(o=>{o.geometry?.dispose();if(o.material){for(const value of Object.values(o.material))if(value?.isTexture)textures.add(value);o.material.dispose();}});textures.forEach(t=>t.dispose());this.environment?.dispose();this.renderer?.dispose();}
}
