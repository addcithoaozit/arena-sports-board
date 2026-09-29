import Link from 'next/link';
import type {ReactNode} from 'react';
import {internationalTeamHref,npbPlayerHref,type NpbPlayerLinks} from '@/lib/international-profile-links';

export function InternationalTeamLink({league,name,children}:{league:string;name:string;children:ReactNode}){
 const href=internationalTeamHref(league,name);
 return href?<Link href={href} prefetch={false} className="player-link">{children}</Link>:<>{children}</>;
}
export function NpbPlayerLink({links,team,name}:{links:NpbPlayerLinks|undefined;team:string;name:string}){
 const href=npbPlayerHref(links,team,name);
 return href?<Link href={href} prefetch={false} className="player-link">{name}</Link>:<>{name}</>;
}
