import './guard.mjs';
import { createServer } from 'node:http';import { readFile } from 'node:fs/promises';import path from 'node:path';
createServer(async(request,response)=>{const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname);const file=path.resolve('dist/harness','.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(path.resolve('dist/harness')+path.sep)){response.writeHead(403).end();return;}try{const data=await readFile(file);response.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.glb')?'model/gltf-binary':'application/octet-stream');response.end(data);}catch{response.writeHead(404).end();}}).listen(4173,'127.0.0.1');

