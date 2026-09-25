import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import worker from '../worker/test-router.js';
const root=path.resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const env={ASSETS:{async fetch(request){const pathname=decodeURIComponent(new URL(request.url).pathname),file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))return new Response('Not found',{status:404});try{return new Response(await readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'text/plain'}});}catch{return new Response('Not found',{status:404});}}}};
http.createServer(async(req,res)=>{try{const request=new Request(`http://localhost:8080${req.url}`,{method:req.method});const response=await worker.fetch(request,env,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.message);}}).listen(8080,'0.0.0.0',()=>console.log('Planungtool: http://localhost:8080'));
