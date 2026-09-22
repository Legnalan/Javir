// Unidades de maqueta, no distancias astronómicas ni medición de la habitación.
export const PLANETS = [
  ['Sol', 0, .55, [1, .65, .12], 0],
  ['Mercurio', 1.05, .10, [.64, .57, .49], 1.6],
  ['Venus', 1.5, .17, [.97, .72, .35], 1.2],
  ['Tierra', 2, .19, [.12, .48, 1], 1],
  ['Marte', 2.55, .14, [.9, .28, .12], .8],
  ['Júpiter', 3.3, .38, [.83, .62, .42], .45],
  ['Saturno', 4.25, .31, [.95, .79, .48], .32],
  ['Urano', 5.15, .24, [.34, .86, .88], .23],
  ['Neptuno', 6, .23, [.16, .35, .94], .18]
];
export function rotate3([x,y,z], [rx,ry,rz]) {
  [y,z] = [y*Math.cos(rx)-z*Math.sin(rx), y*Math.sin(rx)+z*Math.cos(rx)];
  [x,z] = [x*Math.cos(ry)+z*Math.sin(ry), -x*Math.sin(ry)+z*Math.cos(ry)];
  return [x*Math.cos(rz)-y*Math.sin(rz), x*Math.sin(rz)+y*Math.cos(rz), z];
}
export function planetPositions(time, angles, scale, center, offsets = {}) {
  return PLANETS.map(([name, orbit, radius,, speed], i) => {
    const phase = time * speed * .12 + i * 2.4;
    const local = [Math.cos(phase)*orbit, radius*.65, Math.sin(phase)*orbit];
    const v = rotate3(local, angles).map((n,k)=> n*scale + center[k] + (offsets[name]?.[k] || 0));
    return [...v, radius*scale];
  });
}
export function projectPoint(p, width, height) {
  if (p[2] <= .1) return null;
  return {x: width/2+p[0]/p[2]*height*1.25, y: height/2-p[1]/p[2]*height*1.25, radius:p[3]/p[2]*height*1.25, depth:p[2]};
}
// Coordenadas de la imagen original para video object-fit:cover reflejado.
export function cameraUV(x, y, width, height, videoWidth, videoHeight) {
  const fit = Math.max(width/videoWidth, height/videoHeight);
  return [1-(x+(videoWidth*fit-width)/2)/(videoWidth*fit), (y+(videoHeight*fit-height)/2)/(videoHeight*fit)];
}
export function estimateBodyDepth(landmarks, videoAspect, focal = 1.25) {
  const a=landmarks?.[11], b=landmarks?.[12];
  if (!a || !b || Math.min(a.visibility ?? 1,b.visibility ?? 1)<.55) return null;
  const width = Math.hypot((a.x-b.x)*videoAspect,a.y-b.y);
  // Supone hombros de 40 cm y 15 cm por unidad. Requiere ajuste para niños/perfil.
  return width > .045 ? Math.min(65,Math.max(3, focal*(.4/.15)/width)) : null;
}
export function isOccluded(objectDepth, bodyDepth, confidence) {
  return confidence >= .55 && bodyDepth > 0 && bodyDepth < objectDepth;
}

// El worker recibe video sin espejo: izquierda anatómica aparece a la derecha
// de la imagen cuando la persona mira a cámara. Perfil/poses inciertas no ocluyen.
export function bodyFacing(points, aspect = 1) {
  const pairs=[[11,12],[23,24]];
  const signs=pairs.map(([left,right])=>{
    const a=points?.[left],b=points?.[right];
    if(!a||!b||Math.min(a.visibility??0,b.visibility??0)<.65)return 0;
    const dx=(a.x-b.x)*aspect,dy=a.y-b.y;
    if(Math.abs(dx)<.04 || Math.abs(dx)<Math.hypot(dx,dy)*.55)return 0;
    return Math.sign(dx);
  });
  if(signs.every(sign=>sign===1))return 'front';
  if(signs.every(sign=>sign===-1))return 'back';
  return 'unknown';
}

// Asociación espacial entre cuadros, sin identidad facial y sin confiar en
// el orden de las poses del detector. Al perderlas, se vuelve a calibrar.
export function updateBodyOccluders(poses, previous, timestamp, aspect=1) {
  const available=previous.filter(track=>timestamp-track.timestamp<600);
  const used=new Set();
  return poses.map(points=>{
    const center={x:(points[11].x+points[12].x)/2,y:(points[11].y+points[12].y)/2};
    const facing=bodyFacing(points,aspect);
    let match=null,min=.16;
    available.forEach((track,index)=>{
      const dist=Math.hypot(center.x-track.center.x,center.y-track.center.y);
      if(!used.has(index)&&dist<min){min=dist;match=index;}
    });
    if(match!==null)used.add(match);
    const prior=match===null?null:available[match];
    const since=facing==='back'&&prior?.facing==='back'?prior.since:timestamp;
    return {center,facing,since,timestamp,occludes:facing==='back'&&timestamp-since>=450};
  });
}

export function composeBodyDepth(landmarks, masks, aspect, focal, bodyScale = 1, occluders = null) {
  const width=Math.min(256,masks[0]?.width||1);
  const height=Math.max(1,Math.round(width*(masks[0]?.height||1)/(masks[0]?.width||1)));
  const data=new Float32Array(width*height*2);
  masks.forEach((mask,index)=>{
    const points=landmarks[index];const depth=estimateBodyDepth(points,aspect,focal);
    const mayOcclude=depth!==null && (occluders===null || occluders[index]===true);
    const visible=points.filter(p=>(p.visibility??0)>.55);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const confidence=mask.data[Math.min(mask.height-1,Math.floor(y/height*mask.height))*mask.width+Math.min(mask.width-1,Math.floor(x/width*mask.width))];
      if(confidence<.4)continue;
      const offset=(y*width+x)*2;
      data[offset+1]=Math.max(data[offset+1],confidence);
      if(!mayOcclude)continue;
      let nearest=Infinity,localZ=0;
      for(const point of visible){const dist=(x/width-point.x)**2+(y/height-point.y)**2;if(dist<nearest){nearest=dist;localZ=point.z;}}
      const z=Math.max(1,depth+localZ*depth/focal)*bodyScale;
      if(data[offset]===0 || z<data[offset]){data[offset]=z;data[offset+1]=confidence;}
    }
  });
  return {data,width,height};
}
