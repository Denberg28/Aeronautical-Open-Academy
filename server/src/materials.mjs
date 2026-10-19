import { createSign } from 'node:crypto';
import { mkdir, readFile, copyFile, unlink, chmod } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { requireThat, ApiError, MAX_FILE_BYTES } from './security.mjs';

/** Private development storage. No public file-serving route exists. */
export class LocalMaterials {
  constructor(directory){this.directory=directory;}
  async put(path,id){requireThat(/^[a-f0-9-]{36}$/.test(id),400,'Invalid file ID.');await mkdir(this.directory,{recursive:true,mode:0o700});await copyFile(path,join(this.directory,id+'.pdf'));await chmod(join(this.directory,id+'.pdf'),0o600);return id;}
  async get(ref){requireThat(/^[a-f0-9-]{36}$/.test(ref),404,'Material unavailable.');return createReadStream(join(this.directory,ref+'.pdf'));}
  async remove(ref){if(/^[a-f0-9-]{36}$/.test(ref))await unlink(join(this.directory,ref+'.pdf')).catch(()=>{});}
}

/** Organization Shared Drive adapter. Credentials never leave this server. */
export class DriveMaterials {
  constructor(serviceAccount,folder,fetcher=fetch){
    requireThat(serviceAccount?.client_email&&serviceAccount?.private_key&&/^[A-Za-z0-9_-]{10,200}$/.test(folder),500,'Organization Drive storage is not configured.');
    this.credentials=serviceAccount;this.folder=folder;this.fetcher=fetcher;this.cachedToken=null;
  }
  async bearer(){
    if(this.cachedToken&&this.cachedToken.expires>Date.now()+60000)return this.cachedToken.value;
    const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
    const input=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:this.credentials.client_email,scope:'https://www.googleapis.com/auth/drive.file',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
    const signature=createSign('RSA-SHA256').update(input).sign(this.credentials.private_key,'base64url');
    const response=await this.fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+signature}),signal:AbortSignal.timeout(15000),redirect:'error'});
    requireThat(response.ok,502,'Organization Drive authentication unavailable.');const j=await response.json();
    requireThat(typeof j.access_token==='string',502,'Organization Drive authentication unavailable.');
    this.cachedToken={value:j.access_token,expires:Date.now()+Math.min(Number(j.expires_in)||3600,3600)*1000};return j.access_token;
  }
  async put(path,id,bytes){
    const authorization='Bearer '+await this.bearer();
    const begin=await this.fetcher('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',{
      method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json','X-Upload-Content-Type':'application/pdf','X-Upload-Content-Length':String(bytes)},
      body:JSON.stringify({name:id+'.pdf',parents:[this.folder],appProperties:{academy:'material'}}),signal:AbortSignal.timeout(15000),redirect:'error'});
    requireThat(begin.ok,502,'Organization Drive upload unavailable.');
    const location=begin.headers.get('location');let url;
    try{url=new URL(location);}catch{throw new ApiError(502,'Invalid Drive upload destination.');}
    requireThat(url.protocol==='https:'&&url.hostname==='www.googleapis.com'&&!url.username&&!url.password&&!url.port,502,'Invalid Drive upload destination.');
    const sent=await this.fetcher(url,{method:'PUT',headers:{Authorization:authorization,'Content-Type':'application/pdf','Content-Length':String(bytes)},body:createReadStream(path),duplex:'half',signal:AbortSignal.timeout(120000),redirect:'error'});
    requireThat(sent.ok,502,'Organization Drive upload failed.');const file=await sent.json();
    requireThat(typeof file.id==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(file.id),502,'Invalid Drive file reference.');return file.id;
  }
  async get(ref){
    requireThat(/^[A-Za-z0-9_-]{10,200}$/.test(ref),404,'Material unavailable.');
    const response=await this.fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ref)}?alt=media&supportsAllDrives=true`,{headers:{Authorization:'Bearer '+await this.bearer()},signal:AbortSignal.timeout(120000),redirect:'error'});
    requireThat(response.ok&&response.body,502,'Organization Drive material unavailable.');
    requireThat(Number(response.headers.get('content-length')||0)<=MAX_FILE_BYTES,502,'Material exceeds the allowed limit.');
    return Readable.fromWeb(response.body);
  }
  // Replaced objects remain private in Drive for an administrator-led retention policy.
  async remove(){}
}
