'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {ArrowLeft,LoaderCircle,RefreshCw,X} from 'lucide-react';
import {useFloatingDrag} from './use-floating-drag';
import {superDeviceEntryUrl} from '@/lib/super-entry-url';
type Entry={url:string;reuseUntil:number};
type Workspace={open:()=>void;busy:boolean;activePane:string|null;host:HTMLDivElement|null};
const Context=createContext<Workspace|null>(null);
export const useSuperWorkspace=()=>useContext(Context);
export function SuperEntryButton(){const value=useSuperWorkspace();return <Button variant="outline" onClick={()=>value?.open()} disabled={!value} aria-label="在網站內進入 SUPER 體育">進入 SUPER{value?.busy&&<LoaderCircle className="ml-1 size-4 animate-spin" aria-hidden="true"/>}</Button>;}
export default function SuperWorkspace({children,league}:{children:ReactNode;league:string}){
 const leagueLabel=league==='FOOTBALL'?'足球':league;
 const [visible,setVisible]=useState(false),[panel,setPanel]=useState(false),[activePane,setActivePane]=useState<string|null>(null),[host,setHost]=useState<HTMLDivElement|null>(null);
 const ballDrag=useFloatingDrag<HTMLButtonElement>(visible),panelDrag=useFloatingDrag<HTMLElement>(visible&&panel);
 const [frameVersion,setFrameVersion]=useState(0);
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadingFrame,setLoadingFrame]=useState(false),[slow,setSlow]=useState(false);
 const session=useRef<string|null>(null);
 const release=useCallback((owner:string)=>{void fetch('/api/super-entry',{method:'POST',headers:{'X-Super-Action':'release','X-Super-Session':owner},keepalive:true,cache:'no-store'}).catch(()=>{});},[]);
 const cached=useRef<Entry|null>(null),pending=useRef<Promise<Entry>|null>(null),mounted=useRef(true),generation=useRef(0),returnFocus=useRef<HTMLElement|null>(null),closeButton=useRef<HTMLButtonElement>(null);
 const ball=ballDrag.ref,contentRoot=useRef<HTMLDivElement>(null);
 const acquire=useCallback(()=>{
  if(pending.current)return pending.current;
  const owner=session.current||(session.current='browser:'+crypto.randomUUID());
  const mobile=/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  pending.current=(async()=>{const r=await fetch('/api/super-entry',{method:'POST',headers:{'X-Super-Device':mobile?'mobile':'desktop','X-Super-Session':owner},cache:'no-store',signal:AbortSignal.timeout(20000)}),d=await r.json();if(!r.ok)throw Error(d.error||'無法取得 SUPER 入口');const valid=superDeviceEntryUrl(d.url,mobile);if(!valid||!Number.isFinite(d.reuseUntil))throw Error('SUPER 入口格式無效');const next={url:valid,reuseUntil:d.reuseUntil};if(session.current!==owner){release(owner);throw Error('SUPER 已關閉');}cached.current=next;return next;})().finally(()=>{pending.current=null;});
  return pending.current;
 },[release]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;cached.current=null;if(session.current)release(session.current);session.current=null;};},[release]);
 useEffect(()=>{if(!visible||!url)return;const heartbeat=()=>{const owner=session.current;if(owner)void fetch('/api/super-entry',{method:'POST',headers:{'X-Super-Action':'heartbeat','X-Super-Session':owner},cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok&&mounted.current&&session.current===owner)setError('SUPER 連線保護已到期，請按重新登入 SUPER。');}).catch(()=>{});};const timer=setInterval(heartbeat,30000);const resume=()=>{if(document.visibilityState==='visible')heartbeat();};document.addEventListener('visibilitychange',resume);window.addEventListener('online',heartbeat);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',heartbeat);};},[visible,url]);
 const load=useCallback(async(force=false)=>{const version=++generation.current;setBusy(true);setError('');try{const next=!force&&cached.current&&cached.current.reuseUntil>Date.now()?cached.current:await acquire();if(!mounted.current||generation.current!==version)return;cached.current=null;setUrl(next.url);setFrameVersion(v=>v+1);setSlow(false);setLoadingFrame(true);}catch(e){if(mounted.current&&generation.current===version)setError(e instanceof Error?e.message:'SUPER 連線失敗，請重試。');}finally{if(mounted.current&&generation.current===version)setBusy(false);}},[acquire]);
 const close=useCallback(()=>{if(session.current)release(session.current);session.current=null;cached.current=null;generation.current++;setVisible(false);setPanel(false);setUrl('');setActivePane(null);setBusy(false);setLoadingFrame(false);setSlow(false);setError('');requestAnimationFrame(()=>returnFocus.current?.focus());},[release]);
 const open=useCallback(()=>{returnFocus.current=document.activeElement as HTMLElement;const root=document.querySelector(`[data-super-league="${league}"]`),pane=root?.querySelector('[data-super-parlay]');setActivePane(pane?.getAttribute('data-super-parlay')||null);setVisible(true);setPanel(false);void load();},[league,load]);
 // A schedule/date change can remount the source pane while SUPER stays open.
 useEffect(()=>{
  if(!visible)return;
  const root=contentRoot.current;if(!root)return;
  const reconnect=()=>{const id=root.querySelector(`[data-super-league="${league}"] [data-super-parlay]`)?.getAttribute('data-super-parlay')||null;setActivePane(old=>old===id?old:id);};
  reconnect();const observer=new MutationObserver(reconnect);observer.observe(root,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[visible,league]);
 useEffect(()=>{if(!visible)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';document.body.classList.add('super-workspace-open');closeButton.current?.focus();return()=>{document.body.style.overflow=old;document.body.classList.remove('super-workspace-open');};},[visible]);
 useEffect(()=>{if(!visible||!loadingFrame)return;const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[visible,loadingFrame,url]);
 return <Context.Provider value={{open,busy,activePane:visible?activePane:null,host}}><div ref={contentRoot} inert={visible}>{children}</div>{visible&&<section className="super-workspace" role="dialog" aria-modal="true" aria-label="SUPER 體育站內畫面" onKeyDown={e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.stopPropagation();if(panel){setPanel(false);ball.current?.focus();}else close();}}}>
  <header className="super-workspace-header"><Button ref={closeButton} variant="outline" onClick={close}><ArrowLeft className="size-4"/>返回分析</Button><strong>SUPER 體育</strong><Button variant="outline" disabled={busy} onClick={()=>void load(true)}><RefreshCw className={`size-4 ${busy?'animate-spin':''}`}/>重新登入 SUPER</Button></header>
  <div className="super-frame-area">{url&&<iframe key={`${url}:${frameVersion}`} src={url} title="SUPER 體育會員介面" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin" onLoad={()=>setLoadingFrame(false)} onError={()=>{setLoadingFrame(false);setError('SUPER 畫面未完成載入，請重試。');}}/>}{!url&&<div className="super-entry-state" role="status">{busy?<><LoaderCircle className="size-7 animate-spin"/>正在取得你的 SUPER 入口…</>:<p>SUPER 尚未開啟</p>}</div>}
   {(error||slow)&&<div className="super-entry-notice" role="status">{error||'SUPER 載入較久。若畫面顯示拒絕嵌入，需要由來源網站開放嵌入權限。'}<Button variant="outline" disabled={busy} onClick={()=>void load(true)}>重試</Button></div>}
  </div>
  <aside ref={panelDrag.ref} style={panelDrag.style} onPointerMove={panelDrag.onPointerMove} onPointerUp={panelDrag.onPointerUp} onPointerCancel={panelDrag.onPointerCancel} onLostPointerCapture={panelDrag.onLostPointerCapture} onClickCapture={panelDrag.onClickCapture} id="super-recommendations" className="super-recommendations" hidden={!panel} aria-label={`${leagueLabel} 推薦單`}><div className="super-recommendations-title" onPointerDown={panelDrag.onPointerDown}><strong>{leagueLabel} 推薦注單</strong><button type="button" aria-label="收起推薦單" onClick={()=>{setPanel(false);ball.current?.focus();}}><X className="size-5"/></button></div><div ref={setHost} className="super-recommendations-body">{!activePane&&<p className="p-4 text-sm">{league==='FOOTBALL'?'正在載入足球推薦…':league==='NBA'?'正在載入 NBA 推薦…':'請返回「賽前分析・串關」選擇推薦單，再進入 SUPER。'}</p>}</div></aside>
  <button {...ballDrag} type="button" className="super-floating-ball" aria-label={panel?'收起推薦單':'開啟推薦單'} aria-expanded={panel} aria-controls="super-recommendations" onClick={()=>setPanel(v=>!v)}><span aria-hidden="true">{panel?'×':'單'}</span><small>推薦</small></button>
 </section>}</Context.Provider>;
}
