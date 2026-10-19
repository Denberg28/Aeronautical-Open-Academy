import { isIP } from 'node:net';
import { requireThat } from './security.mjs';
/** Validate the initial public web URL only. No DNS, preview, redirect or content fetch. */
export function externalUrl(raw){
 requireThat(typeof raw==='string',400,'Provide a web material link.');const value=raw.trim();
 requireThat(value.length>0&&value.length<=2048&&!/[\s\\\u0000-\u001f\u007f]/u.test(value)&&/^https?:\/\//i.test(value),400,'Use a complete HTTP or HTTPS link, without spaces or backslashes.');
 let url;try{url=new URL(value);}catch{requireThat(false,400,'Invalid material link.');}
 const host=url.hostname.toLowerCase();
 requireThat(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.port&&host.length<=253&&!isIP(host)&&!host.includes(':')&&!host.startsWith('[')&&host.includes('.')&&!host.endsWith('.')&&host.split('.').every(s=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))&&!/(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host)&&!/^\d+$/.test(host.split('.').at(-1)),400,'Use a public web link without credentials, local addresses or custom ports.');
 requireThat(url.href.length<=2048,400,'Material link is too long.');return url.href;
}
function trimPunctuation(value){
 let end=value;while(/[.,;!]$/.test(end))end=end.slice(0,-1);
 for(const [open,close]of [['(',')'],['[',']'],['{','}']])while(end.endsWith(close)&&end.split(close).length>end.split(open).length)end=end.slice(0,-1);
 return end.replace(/[.,;!]+$/,'');
}
export function linksInText(value){
 const links=[];for(const match of String(value).matchAll(/https?:\/\/[^\s<>"`]+/gi)){
  try{links.push(externalUrl(trimPunctuation(match[0])));}catch{/* Invalid text remains plain text. */}
 }return [...new Set(links)];
}
export function linkFromText(raw,source){const url=externalUrl(raw);requireThat(linksInText(source).includes(url),409,'This link changed. Refresh and review the material before opening it.');return url;}
