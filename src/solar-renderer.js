import * as THREE from 'three';
import { PLANETS } from './solar-math.js';

// Texturas locales e ilustrativas: sin descargas ni dependencias de imágenes.
function surfaceTexture(index) {
  const width=256,height=128,data=new Uint8Array(width*height*4);
  const base=new THREE.Color(...PLANETS[index][3]);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width*Math.PI*2,v=y/height*Math.PI;
    const noise=Math.sin(u*13+Math.sin(v*11)*2)*Math.sin(v*19+Math.cos(u*7));
    let color=base.clone().multiplyScalar(.8+noise*.15);
    if(index===0)color.setRGB(1,.45+.22*Math.sin(v*20+noise*2),.035);
    if(index===3){
      const land=Math.sin(u*3+Math.cos(v*7))+Math.cos(u*7-v*4)+noise*.4;
      color.set(land>.55?0x428452:0x1769b5);
      if(y<9||y>height-10)color.set(0xe4f4ff);
      else if(Math.sin(u*17+v*13)+noise>1.25)color.lerp(new THREE.Color(0xf1f7ff),.8);
    }
    if(index===5||index===6){
      const band=.5+.5*Math.sin(v*(index===5?34:45)+noise*.7);
      color.lerp(new THREE.Color(index===5?0xf4d4ad:0xf4dea7),band*.6);
      if(index===5&&Math.sin(u+.6)>.985&&y>68&&y<78)color.set(0xb35b35);
    }
    const offset=(y*width+x)*4;
    data[offset]=Math.round(Math.min(1,color.r)*255);data[offset+1]=Math.round(Math.min(1,color.g)*255);data[offset+2]=Math.round(Math.min(1,color.b)*255);data[offset+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height);
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}
const maskDeclarations=`uniform sampler2D solarBodies;
uniform vec4 solarViewport;
uniform float solarOcclusion;
varying float solarDepth;
vec2 solarVideoUV(){
  vec2 pixel=vec2(gl_FragCoord.x,solarViewport.y-gl_FragCoord.y);
  float fit=max(solarViewport.x/solarViewport.z,solarViewport.y/solarViewport.w);
  return vec2(1.-(pixel.x+(solarViewport.z*fit-solarViewport.x)*.5)/(solarViewport.z*fit),
    (pixel.y+(solarViewport.w*fit-solarViewport.y)*.5)/(solarViewport.w*fit));
}`;

export class SolarRenderer {
  constructor(){
    this.scene=new THREE.Scene();
    // Coincide con la focal del video y la proyección usada por los gestos.
    this.camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2*Math.atan(.4)),1,.05,160);
    this.uniforms={solarBodies:{value:null},solarViewport:{value:new THREE.Vector4(1,1,1280,720)},solarOcclusion:{value:0}};
    this.setBodyDepth(new Float32Array(2),1,1);
    this.scene.add(new THREE.HemisphereLight(0xb8d8ff,0x151824,1.4));
    this.sunLight=new THREE.PointLight(0xffddaa,100,0,2);this.scene.add(this.sunLight);
    this.planets=PLANETS.map(([name],index)=>{
      const texture=surfaceTexture(index);
      const material=index===0?new THREE.MeshBasicMaterial({map:texture}):new THREE.MeshStandardMaterial({map:texture,roughness:.88,metalness:0});
      this.applyOcclusion(material);
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,48,32),material);
      mesh.name=name;mesh.userData.planetIndex=index;this.scene.add(mesh);
      const outline=new THREE.Mesh(new THREE.SphereGeometry(1.07,24,16),new THREE.MeshBasicMaterial({color:0xffd477,side:THREE.BackSide}));
      this.applyOcclusion(outline.material);outline.visible=false;mesh.add(outline);
      return mesh;
    });
    this.orbits=new THREE.Group();this.orbits.matrixAutoUpdate=false;this.scene.add(this.orbits);
    for(const [,radius] of PLANETS.slice(1)){
      const points=Array.from({length:160},(_,i)=>new THREE.Vector3(Math.cos(i/160*Math.PI*2)*radius,0,Math.sin(i/160*Math.PI*2)*radius));
      const material=new THREE.LineBasicMaterial({color:0x5cbbdc,transparent:true,opacity:.4});this.applyOcclusion(material);
      this.orbits.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),material));
    }
    this.rings=new THREE.Group();this.rings.matrixAutoUpdate=false;this.scene.add(this.rings);
    for(const [inner,outer,color] of [[1.3,1.6,0x8b775f],[1.65,2,0xe1cba3],[2.03,2.3,0xaaa28a]]){
      const material=new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.85,roughness:1});this.applyOcclusion(material);
      const ring=new THREE.Mesh(new THREE.RingGeometry(inner,outer,120),material);ring.rotation.x=-Math.PI/2;this.rings.add(ring);
    }
    this.raycaster=new THREE.Raycaster();
    this.debugScene=new THREE.Scene();
    this.debugScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:this.uniforms,transparent:true,depthTest:false,depthWrite:false,
      vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:maskDeclarations+'void main(){float c=texture2D(solarBodies,solarVideoUV()).g;gl_FragColor=vec4(.08,.85,.72,c>.4?.28:0.);}'
    })));
  }
  applyOcclusion(material){
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader='varying float solarDepth;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nsolarDepth=-mvPosition.z;');
      shader.fragmentShader=maskDeclarations+'\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\nvec2 body=texture2D(solarBodies,solarVideoUV()).rg;\nif(solarOcclusion>.5 && body.x>0. && body.x<solarDepth && body.y>=.55) discard;');
    };
    material.customProgramCacheKey=()=> 'solar-body-depth-v1';
  }
  async initialize(canvas,onError){
    this.canvas=canvas;
    this.contextLost=e=>{e.preventDefault();onError?.('Se perdió la aceleración gráfica. Vuelve al grafo y abre el sistema solar otra vez.');};
    canvas.addEventListener('webglcontextlost',this.contextLost);
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);this.renderer.setClearColor(0x000000,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  }
  setBodyDepth(data,width,height){
    this.bodyTexture?.dispose();
    const pixels=new Float32Array(width*height*4);
    for(let i=0;i<width*height;i++){pixels[i*4]=data[i*2];pixels[i*4+1]=data[i*2+1];}
    this.bodyTexture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat,THREE.FloatType);
    this.bodyTexture.needsUpdate=true;this.uniforms.solarBodies.value=this.bodyTexture;
  }
  update(values,width,height,selectedIds=new Set()){
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.uniforms.solarViewport.value.set(width,height,values[0][2],values[0][3]);
    this.uniforms.solarOcclusion.value=values[3][1];
    this.planets.forEach((mesh,i)=>{
      const [x,y,z,radius]=values[4+i];mesh.position.set(x,y,-z);mesh.scale.setScalar(radius);
      mesh.visible=z>.05;mesh.rotation.y=values[3][0]*(i===0?.08:.18);
      mesh.children[0].visible=selectedIds.has(i);
    });
    const [x,y,z,scale]=values[1];
    const [rx,ry,rz]=values[2];
    const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,ry,rz,'ZYX'));
    const reflected=new THREE.Matrix4().makeScale(1,1,-1).multiply(rotation);
    this.orbits.matrix.copy(reflected).scale(new THREE.Vector3(scale,scale,scale)).setPosition(x,y,-z);
    const saturn=this.planets[6];
    this.rings.matrix.copy(reflected).scale(new THREE.Vector3(saturn.scale.x,saturn.scale.x,saturn.scale.x)).setPosition(saturn.position);
    this.rings.visible=saturn.visible;this.sunLight.position.copy(this.planets[0].position);
    this.sunLight.intensity=100*scale*scale;
    this.scene.updateMatrixWorld(true);
  }
  render(values,width,height,selectedIds){
    this.update(values,width,height,selectedIds);
    this.renderer.setSize(width,height,false);this.renderer.render(this.scene,this.camera);
    if(values[3][2]){this.renderer.autoClear=false;this.renderer.render(this.debugScene,this.camera);this.renderer.autoClear=true;}
  }
  pick(point){
    this.raycaster.setFromCamera(new THREE.Vector2(point.x*2-1,1-point.y*2),this.camera);
    return this.raycaster.intersectObjects(this.planets,false).find(hit=>hit.object.visible)?.object.userData.planetIndex??null;
  }
  destroy(){
    this.canvas?.removeEventListener('webglcontextlost',this.contextLost);
    const geometries=new Set(),materials=new Set(),textures=new Set([this.bodyTexture]);
    for(const scene of [this.scene,this.debugScene])scene.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      if(object.material){materials.add(object.material);if(object.material.map)textures.add(object.material.map);}
    });
    geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value?.dispose());
    this.renderer?.dispose();
  }
}
