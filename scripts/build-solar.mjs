import { build } from 'esbuild';
await build({entryPoints:['src/graph-three.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'public/generated/graph-three.js'});
await build({entryPoints:['src/solar-demo.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'public/generated/solar-demo.js'});
// MediaPipe usa importScripts para WASM; el worker debe ser clásico, no módulo.
await build({entryPoints:['src/body-worker.js'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'public/generated/body-worker.js'});

await build({entryPoints:['src/car-demo.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'public/generated/car-demo.js'});
