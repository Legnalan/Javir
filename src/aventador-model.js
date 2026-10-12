import * as THREE from 'three';
export const CAR_PART_NAMES=['Chasis y bajos','Cofre y frente','Cabina y parabrisas','Puerta derecha','Asiento del copiloto ilustrativo','Puerta izquierda','Asiento del piloto ilustrativo','Cubierta del motor','Motor ilustrativo','Alerón trasero',...['delantera derecha','delantera izquierda','trasera derecha','trasera izquierda'].flatMap(w=>[`Neumático ${w}`,`Rin ${w}`,`Disco y cáliper ${w} ilustrativos`])];
// Las superficies del recurso se agrupan por región. Es una exploración visual,
// no una segmentación CAD: asientos, motor y frenos internos son ilustrativos.
export function createSportsCar(model){
 if(!model)throw new Error('El recurso Aventador es obligatorio');
 const root=new THREE.Group(),parts=[];
 const bases=[[0,.2,0],[-1.65,.55,0],[-.12,.9,0],[0,.62,-.94],[.08,.54,-.38],[0,.62,.94],[.08,.54,.38],[1.55,.65,0],[1.2,.52,0],[2.15,.75,0]];
 const explosions=[[0,-.35,0],[-.8,.7,0],[0,1.12,0],[0,.42,-.85],[0,.65,-.3],[0,.42,.85],[0,.65,.3],[.65,.7,0],[.9,.15,0],[.45,1.12,0]];
 const wheels=['FR','FL','RR','RL'];
 wheels.forEach((key,i)=>{const side=i%2?1:-1,x=i<2?-1.28:1.47,y=i<2?.35:.37;for(const extension of [.6,1.85,-.55]){bases.push([x,y,side*.86]);explosions.push([x<0?-.3:.3,0,side*extension]);}});
 CAR_PART_NAMES.forEach((name,i)=>{const group=new THREE.Group();group.position.fromArray(bases[i]);group.userData.part=i;root.add(group);const p={name,group,base:group.position.clone(),explode:new THREE.Vector3(...explosions[i])};if(i>=10){const wheel=Math.floor((i-10)/3);Object.assign(p,{wheel:CAR_PART_NAMES[10+wheel*3].replace('Neumático ',''),tireIndex:10+wheel*3,kind:['tire','rim','brake'][(i-10)%3]});}parts.push(p);});
 function append(index,geometry,material){geometry.translate(...parts[index].base.toArray().map(v=>-v));const mat=material.clone();if(parts[index].kind==='tire'){mat.metalness=0;mat.roughness=.85;}if(parts[index].kind==='rim'){mat.metalness=.65;mat.roughness=.3;}const m=new THREE.Mesh(geometry,mat);m.userData.emissive=mat.emissive.clone();m.userData.emissiveIntensity=mat.emissiveIntensity;parts[index].group.add(m);}
 if(model){
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const normalization=new THREE.Matrix4().makeRotationY(-Math.PI/2).multiply(new THREE.Matrix4().makeScale(4.9/size.z,4.9/size.z,4.9/size.z)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
  model.traverse(object=>{if(!object.isMesh)return;
   const geometry=object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalization,object.matrixWorld));const expanded=geometry.index?geometry.toNonIndexed():geometry;
   const pos=expanded.attributes.position,buckets=new Map();const wheelKey=wheels.find(k=>object.name.includes(`Wheel_${k}_`)),wheelIndex=wheels.indexOf(wheelKey);
   for(let v=0;v<pos.count;v+=3){const p=new THREE.Vector3();for(let k=0;k<3;k++)p.add(new THREE.Vector3().fromBufferAttribute(pos,v+k));p.multiplyScalar(1/3);
    let index;
    if(wheelIndex>=0){const base=parts[10+wheelIndex*3].base;let radius=0,inner=Infinity;for(let k=0;k<3;k++){const r=Math.hypot(pos.getX(v+k)-base.x,pos.getY(v+k)-base.y);radius=Math.max(radius,r);inner=Math.min(inner,r);}const outer=radius>(wheelIndex<2?.295:.315);index=10+wheelIndex*3+(outer?(inner<.1?2:0):1);}
    else if(object.name.startsWith('Glass'))index=p.x>.65?7:2;
    else if(p.y<.25)index=0;
    else if(p.x<-.85)index=1;
    else if(p.x>2.05&&p.y>.65)index=9;
    else if(p.x>.7)index=7;
    else if(p.y>.9)index=2;
    else index=p.z<0?3:5;
    if(!buckets.has(index))buckets.set(index,[]);buckets.get(index).push(v,v+1,v+2);
   }
   for(const [index,indices]of buckets){const split=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(expanded.attributes)){const array=new Float32Array(indices.length*attribute.itemSize);indices.forEach((vertex,k)=>{for(let c=0;c<attribute.itemSize;c++)array[k*attribute.itemSize+c]=attribute.array[vertex*attribute.itemSize+c];});split.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize));}split.computeBoundingSphere();append(index,split,object.material);}
   if(expanded!==geometry)expanded.dispose();geometry.dispose();
  });
 }
 const dark=new THREE.MeshStandardMaterial({color:0x151b22,metalness:.15,roughness:.55}),metal=new THREE.MeshStandardMaterial({color:0x87939d,metalness:.65,roughness:.35}),red=new THREE.MeshStandardMaterial({color:0xe03a1d,roughness:.4});
 function box(index,size,position,material){const g=new THREE.BoxGeometry(...size);g.translate(...position);append(index,g,material);}
 for(const index of [4,6]){const b=bases[index];box(index,[.5,.14,.43],b,dark);box(index,[.13,.48,.44],[b[0]+.2,b[1]+.23,b[2]],dark);}
 box(8,[.9,.2,.55],bases[8],metal);for(let i=0;i<6;i++)box(8,[.1,.1,.53],[.8+i*.14,.68,0],dark);
 for(let i=0;i<4;i++){const index=12+i*3,b=bases[index],side=b[2]>0?1:-1;const g=new THREE.CylinderGeometry(.23,.23,.026,48);g.rotateX(Math.PI/2);g.translate(b[0],b[1],b[2]-side*.08);append(index,g,metal);box(index,[.09,.18,.055],[b[0]+.2,b[1],b[2]-side*.045],red);}
 function update(scale,offsets={},selected=null){const body=THREE.MathUtils.smoothstep(scale,1.45,2.05),wheel=THREE.MathUtils.smoothstep(scale,2.05,2.85),focus=parts[selected]?.wheel;
  for(const [i,p]of parts.entries()){p.group.position.copy(p.base).addScaledVector(p.explode,p.wheel?wheel:body);if(offsets[i])p.group.position.add(new THREE.Vector3(...offsets[i]));p.group.visible=!(focus&&scale>2.35&&p.wheel!==focus);p.group.traverse(m=>{if(m.isMesh){m.material.emissive.copy(m.userData.emissive);if(i===selected)m.material.emissive.setHex(0x235f57);m.material.emissiveIntensity=i===selected?.35:m.userData.emissiveIntensity;}});}return{body,wheel,focus:focus&&scale>2.35?focus:null};
 }
 return {root,parts,update};
}
