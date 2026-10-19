import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp,rm,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('production links-only startup needs no Drive credential or material directory',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-links-main-'));
 const child=spawn(process.execPath,['src/main.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'0',MATERIAL_STORAGE:'links',ACADEMY_DATA_DIR:directory,ADMIN_BOOTSTRAP_EMAIL:'bootstrap@example.test',ADMIN_BOOTSTRAP_PASSWORD:'Private bootstrap test passphrase!',GOOGLE_SERVICE_ACCOUNT_JSON:'',DRIVE_FOLDER_ID:''},stdio:['ignore','pipe','pipe']});
 const closed=once(child,'close');let stderr='';child.stderr.on('data',data=>stderr+=data);
 try{
  const port=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Startup timed out: '+stderr)),15000);child.stdout.on('data',data=>{output+=data;const match=output.match(/listening on 127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Unexpected exit '+code+': '+stderr));});});
  const base='http://127.0.0.1:'+port;
  assert.equal((await (await fetch(base+'/health')).json()).status,'ok');
  const login=await (await fetch(base+'/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'bootstrap@example.test',password:'Private bootstrap test passphrase!'})})).json();
  const me=await (await fetch(base+'/v1/me',{headers:{Authorization:'Bearer '+login.token}})).json();assert.equal(me.capabilities.material_upload,false);assert.equal(me.capabilities.external_links,true);
  await assert.rejects(stat(join(directory,'materials')),{code:'ENOENT'});
 }finally{child.kill('SIGTERM');await closed;await rm(directory,{recursive:true,force:true});}
});
