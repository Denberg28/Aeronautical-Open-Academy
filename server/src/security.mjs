import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export const MAX_FILE_BYTES=50*1024*1024;
export class ApiError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export function requireThat(condition,status,message){if(!condition)throw new ApiError(status,message);}
export function text(value,name,max=200){requireThat(typeof value==='string'&&value.trim().length>0&&value.length<=max,400,`Invalid ${name}.`);return value.trim();}
export function email(value){const e=text(value,'email',254).toLowerCase();requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),400,'Enter a valid email.');return e;}
export function password(value){requireThat(typeof value==='string'&&value.length>=15&&value.length<=128,400,'Use a password/passphrase with 15–128 characters.');return value;}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
let hashing=0;
async function derive(raw,salt,N){
  requireThat(hashing<2,503,'Sign-in is busy. Try again shortly.');hashing++;
  try{return await scrypt(raw,salt,64,{N,r:8,p:1,maxmem:192*1024*1024});}finally{hashing--;}
}
export async function hashPassword(raw,N=131072){const salt=randomBytes(16).toString('hex');return `scrypt$${N}$${salt}$${(await derive(password(raw),salt,N)).toString('hex')}`;}
export async function verifyPassword(raw,encoded){
  if(typeof raw!=='string'||raw.length>128)return false;
  const [algorithm,cost,salt,hash]=String(encoded).split('$');const N=Number(cost);
  if(algorithm!=='scrypt'||![16384,131072].includes(N)||!salt||!/^[0-9a-f]{128}$/.test(hash||''))return false;
  const actual=await derive(raw,salt,N);return timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
export function publicAccount(a){return {id:a.id,email:a.email,name:a.name,role:a.role,status:a.status,must_change_password:!!a.must_change_password};}
export function canManage(account,ownerId){return account.status==='active'&&(account.role==='admin'||account.role==='instructor'&&account.id===ownerId);}
