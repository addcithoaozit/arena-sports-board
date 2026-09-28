'use client';
import {useState} from 'react';
import {UserRound} from 'lucide-react';
function Photo({name,urls}:{name?:string;urls:string[]}){
 const [index,setIndex]=useState(0),src=urls[index];
 return <span className="live-player-photo">{src?<img src={src} alt={name||'球員'} loading="lazy" referrerPolicy="no-referrer" onError={()=>setIndex(i=>i+1)}/>:<UserRound aria-hidden="true"/>}</span>;
}
export default function InternationalPlayerPhoto({person}:{person?:{name?:string;photoUrls?:string[]}|null}){
 const urls=person?.photoUrls||[];
 return <Photo key={`${person?.name}:${urls.join('|')}`} name={person?.name} urls={urls}/>;
}
