// Local isolated fixture only; never enable this on Render.
import {readFileSync} from 'node:fs';
if(process.env.YJ_RENDER_HTTP_TEST!=='1')throw Error('Test-only fixture');
const RealDate=Date,now=RealDate.parse('2026-09-29T16:00:00Z');
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}static parse(value){return RealDate.parse(value);}static UTC(...args){return RealDate.UTC(...args);}};
await import('./render-http-preload.mjs');
const read=name=>JSON.parse(readFileSync(new URL(`./fixtures/nba/${name}.json`,import.meta.url),'utf8')),native=fetch;
globalThis.fetch=async(input,options)=>{
 const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(['localhost','127.0.0.1'].includes(u.hostname))return native(input,options);
 if(u.hostname==='site.api.espn.com'&&u.pathname.startsWith('/apis/site/v2/sports/basketball/wnba/')){
  const team=u.pathname.match(/teams\/(\d+)\/(schedule|roster)/);
  const file=team?(team[2]==='roster'?`roster-${team[1]}`:`team-${team[1]}-${u.searchParams.get('season')}-${u.searchParams.get('seasontype')}`):`day-${u.searchParams.get('dates')}`;
  if(process.env.NBA_TEST_HISTORY_FAILURE==='1'&&team?.[2]==='schedule'&&u.searchParams.get('seasontype')==='3')return new Response('',{status:503});
  try{return Response.json(JSON.parse(readFileSync(new URL(`./fixtures/wnba/${file}.json`,import.meta.url),'utf8')));}catch{return new Response('',{status:503});}
 }
 if(u.hostname==='www.nba.com'){
  let data;
  if(u.pathname==='/players')data={props:{pageProps:{players:[{PERSON_ID:1628369,PLAYER_SLUG:'jayson-tatum'}]}}};
  else if(u.pathname==='/team/1610612738/celtics')data=read('official-team');
  else if(u.pathname==='/player/1628369/jayson-tatum')data=read('official-player');
  else return new Response('',{status:404});
  return new Response('<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(data)+'</script>');
 }
 if(u.hostname==='site.api.espn.com'&&u.pathname.startsWith('/apis/site/v2/sports/basketball/nba/')){
  const team=u.pathname.match(/teams\/(\d+)\/schedule/);
  if(team){
   if(process.env.NBA_TEST_HISTORY_FAILURE==='1'&&u.searchParams.get('seasontype')==='3')return new Response('',{status:503});
   return Response.json(read(u.searchParams.get('seasontype')==='1'?'current':`team-${team[1]}-${u.searchParams.get('season')}-${u.searchParams.get('seasontype')}`));
  }
  if(u.searchParams.get('dates')==='20261008')return Response.json(read('future'));
  if(u.searchParams.get('dates')==='20260503')return Response.json(read('historical'));
  const empty=read('today');empty.leagues[0].calendar=['2026-10-08T07:00Z'];return Response.json(empty);
 }
 return new Response('',{status:503});
};
