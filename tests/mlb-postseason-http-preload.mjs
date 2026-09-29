// Local HTTP fixtures only. Never set YJ_RENDER_HTTP_TEST on a deployed service.
import {readFileSync} from 'node:fs';
if(process.env.YJ_RENDER_HTTP_TEST!=='1')throw Error('Test-only fixture');
const RealDate=Date,now=RealDate.parse('2026-09-29T12:54:29Z');
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}static parse(value){return RealDate.parse(value);}static UTC(...args){return RealDate.UTC(...args);}};
await import('./render-http-preload.mjs');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/mlb-postseason-20260929.json',import.meta.url),'utf8'));
const original=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(['localhost','127.0.0.1'].includes(url.hostname))return original(input,options);
 if(url.hostname==='statsapi.mlb.com'){
  if(url.pathname==='/api/v1/schedule')return Response.json(fixture.schedule);
  if(url.pathname==='/api/v1/standings'&&url.searchParams.get('standingsTypes')==='regularSeason')return process.env.MLB_TEST_STANDINGS_FAILURE==='1'?new Response('',{status:503}):Response.json(fixture.standings);
  if(url.pathname==='/api/v1/people')return Response.json(fixture.pitchers);
 }
 return new Response('',{status:503});
};
