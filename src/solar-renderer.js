import tgpu, { d } from 'typegpu';

const shader = /* wgsl */ `
@group(0) @binding(0) var<uniform> u: array<vec4f,32>;
@group(0) @binding(1) var bodies: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) id:u32) -> @builtin(position) vec4f {
  var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return vec4f(p[id],0,1);
}
fn rot(v:vec3f) -> vec3f {
  let a=u[2].xyz; let c=cos(a); let s=sin(a);
  let x=vec3f(v.x,v.y*c.x-v.z*s.x,v.y*s.x+v.z*c.x);
  let y=vec3f(x.x*c.y+x.z*s.y,x.y,-x.x*s.y+x.z*c.y);
  return vec3f(y.x*c.z-y.y*s.z,y.x*s.z+y.y*c.z,y.z);
}
@fragment fn fs(@builtin(position) pixel:vec4f) -> @location(0) vec4f {
  let uv=pixel.xy/u[0].xy;
  let rd=normalize(vec3f((uv.x-.5)*u[0].x/u[0].y,.5-uv.y,1.25));
  var nearest=10000.; var color=vec3f(0.); var alpha=0.;
  for(var i=0u;i<9u;i++) {
    let sphere=u[4u+i]; let oc=-sphere.xyz;
    let b=dot(oc,rd); let c=dot(oc,oc)-sphere.w*sphere.w; let h=b*b-c;
    if(h>=0.) {
      let t=-b-sqrt(h);
      if(t>.05 && t<nearest) {
        nearest=t; let n=normalize(rd*t-sphere.xyz);
        let light=normalize(u[4].xyz-sphere.xyz+n*.001);
        let diffuse=max(.23,dot(n,light));
        let bands=.88+.12*sin(n.y*30.+sin(n.x*12.)*2.+u[3].x*.3);
        color=u[13u+i].xyz*diffuse*bands;
        if(i==0u) { color=u[13].xyz*(1.1+.12*sin(n.x*12.+n.y*17.+sin(n.z*20.)+u[3].x)); }
        if(i==3u) { let land=sin(n.x*16.+u[3].x*.1)+sin(n.y*19.)+sin(n.z*15.); color=mix(color,vec3f(.12,.58,.32)*diffuse,smoothstep(.7,1.1,land)); }
        color+=vec3f(.12,.32,.45)*pow(1.-max(0.,dot(n,-rd)),3.); alpha=1.;
      }
    }
  }
  // Órbitas y anillos en planos 3D: participan en la misma comparación de profundidad.
  let normal=rot(vec3f(0,1,0)); let denom=dot(rd,normal);
  if(abs(denom)>.0001) {
    let t=dot(u[1].xyz,normal)/denom;
    let point=rd*t-u[1].xyz; let radius=length(point)/u[1].w;
    var orbits=array<f32,8>(1.05,1.5,2.,2.55,3.3,4.25,5.15,6.);
    var line=0.;
    let thickness=max(.009,t/u[0].y/u[1].w);
    for(var i=0u;i<8u;i++) { line=max(line,1.-smoothstep(thickness,thickness*2.,abs(radius-orbits[i]))); }
    if(t>.05 && t<nearest && line>.01) { nearest=t; color=vec3f(.23,.66,.85); alpha=line*.48; }
    let st=dot(u[10].xyz,normal)/denom;
    let sr=length(rd*st-u[10].xyz)/u[10].w;
    if(st>.05 && st<nearest && sr>1.35 && sr<2.25) {
      nearest=st; color=vec3f(.78,.66,.46); alpha=.75*(.7+.3*sin(sr*65.));
    }
  }
  // Textura de profundidad corporal en coordenadas del video sin espejo.
  let fit=max(u[0].x/u[0].z,u[0].y/u[0].w);
  let videoUV=vec2f(1.-(pixel.x+(u[0].z*fit-u[0].x)*.5)/(u[0].z*fit),
    (pixel.y+(u[0].w*fit-u[0].y)*.5)/(u[0].w*fit));
  let size=textureDimensions(bodies);
  let coord=clamp(vec2i(videoUV*vec2f(size)),vec2i(0),vec2i(size)-1);
  let body=textureLoad(bodies,coord,0);
  if(u[3].y>0.5 && body.x>0. && body.x<nearest*rd.z) {
    alpha*=1.-smoothstep(.4,.75,body.y);
  }
  if(u[3].z>.5 && body.y>.4) { return vec4f(vec3f(.08,.85,.72)*.28,.28); }
  return vec4f(color*alpha,alpha);
}`;

export class SolarRenderer {
  async initialize(canvas,onError) {
    if(!navigator.gpu) throw new Error('WebGPU no disponible. Abre la maqueta en Brave o Chrome con aceleración gráfica.');
    this.root=await tgpu.init(); this.device=this.root.device;
    this.device.lost.then(info=>onError?.('Se perdió la GPU: '+info.message));
    this.device.addEventListener('uncapturederror',e=>onError?.(e.error.message));
    this.canvas=canvas; this.context=canvas.getContext('webgpu');
    const format=navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({device:this.device,format,alphaMode:'premultiplied'});
    this.uniform=this.root.createBuffer(d.arrayOf(d.vec4f,32)).$usage('uniform');
    const module=this.device.createShaderModule({code:shader});
    const compilation=await module.getCompilationInfo();
    const errors=compilation.messages.filter(m=>m.type==='error');
    if(errors.length) throw new Error(errors.map(m=>m.message).join('; '));
    this.pipeline=await this.device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
    this.setBodyDepth(new Float32Array(2),1,1);
  }
  setBodyDepth(data,width,height) {
    if(this.maskWidth!==width || this.maskHeight!==height) {
      this.texture?.destroy(); this.maskWidth=width; this.maskHeight=height;
      this.texture=this.device.createTexture({size:[width,height],format:'rg32float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
      this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.root.unwrap(this.uniform)}},{binding:1,resource:this.texture.createView()}]});
    }
    this.device.queue.writeTexture({texture:this.texture},data,{bytesPerRow:width*8},[width,height]);
  }
  render(values,width,height) {
    if(this.canvas.width!==width)this.canvas.width=width;
    if(this.canvas.height!==height)this.canvas.height=height;
    this.uniform.write(values.map(v=>d.vec4f(...v)));
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});
    pass.setPipeline(this.pipeline); pass.setBindGroup(0,this.bindGroup); pass.draw(3); pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
  destroy(){this.texture?.destroy();this.context?.unconfigure();this.root?.destroy();}
}
