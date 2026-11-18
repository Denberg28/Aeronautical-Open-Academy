import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAcademy } from '../src/server.mjs';
import { LocalMaterials } from '../src/materials.mjs';

const password='Synthetic access contract passphrase!';
test('shared sync, global sign-out and legacy download denial enforce server identity',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-access-'));
 const app=await createAcademy({dbPath:join(directory,'test.sqlite'),materials:new LocalMaterials(join(directory,'files')),
   bootstrap:{email:'admin@example.test',name:'Test admin',password},scryptN:16384});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,{token,body,bytes,method=body||bytes?'POST':'GET'}={})=>{
   const response=await fetch(origin+path,{method,headers:{'X-Academy-Features':'choice-forms-v1',
     ...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(bytes?{'Content-Type':'application/pdf'}:{})},
     body:bytes||(body?JSON.stringify(body):undefined)});
   return {status:response.status,data:response.headers.get('content-type')?.startsWith('application/pdf')?Buffer.from(await response.arrayBuffer()):await response.json()};
 };
 const login=async(email,pass=password)=>(await call('/v1/auth/login',{body:{email,password:pass}})).data.token;
 try{
  const admin=await login('admin@example.test');
  const created=await call('/v1/admin/accounts',{token:admin,body:{email:'student@example.test',name:'Student',role:'student',password}});
  const temporary=await login('student@example.test');
  assert.equal((await call('/v1/sync',{token:temporary})).status,403);
  await call('/v1/auth/password',{token:temporary,body:{current_password:password,new_password:password+'changed'}});
  const student=await login('student@example.test',password+'changed');
  const otherDevice=await login('student@example.test',password+'changed');
  const receipt=await call('/v1/sync',{token:student});
  assert.equal(receipt.data.account.id,created.data.account.id);assert.equal(receipt.data.protocol,'academy-sync-v1');
  assert.equal(receipt.data.token,undefined);assert.equal(receipt.data.account.password_hash,undefined);
  assert.equal((await call('/v1/sync')).status,401);
  const sid=(await call('/v1/subjects',{token:admin,body:{title:'Protected course',description:'Synthetic test'}})).data.id;
  await call('/v1/admin/enrolments',{token:admin,body:{subject_id:sid,student_id:created.data.account.id}});
  assert.equal((await call(`/v1/subjects/${sid}/items`,{token:admin,body:{kind:'material',title:'Forbidden grant',body:'Synthetic',offline_allowed:true}})).status,400);
  const iid=(await call(`/v1/subjects/${sid}/items`,{token:admin,body:{kind:'material',material_mode:'file',title:'Private PDF',body:'Read inside Academy',published:true}})).data.id;
  const bytes=Buffer.from('%PDF-1.4\nSynthetic fixture\n%%EOF');
  assert.equal((await call(`/v1/items/${iid}/file`,{token:admin,bytes})).status,200);
  app.db.prepare('UPDATE items SET offline_allowed=1 WHERE id=?').run(iid);
  assert.equal((await call(`/v1/items/${iid}?features=choice`,{token:student})).data.item.offline_allowed,false);
  assert.equal((await call(`/v1/items/${iid}/content?download=1`,{token:student})).status,403);
  assert.equal((await call(`/v1/items/${iid}/content`,{token:student})).status,200);
  await call(`/v1/items/${iid}/complete`,{token:student,body:{completed:true}});
  assert.equal((await call(`/v1/subjects/${sid}`,{token:otherDevice})).data.summary.read,1);
  // Atomic failure must leave all devices signed in; retry then revokes both.
  app.db.exec("CREATE TRIGGER fail_signout BEFORE INSERT ON audit WHEN NEW.action='sign-out-all' BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  assert.equal((await call('/v1/auth/logout-all',{token:student,body:{}})).status,500);
  assert.equal((await call('/v1/me',{token:otherDevice})).status,200);
  app.db.exec('DROP TRIGGER fail_signout');
  assert.equal((await call('/v1/auth/logout-all',{token:student,body:{}})).status,200);
  assert.equal((await call('/v1/sync',{token:otherDevice})).status,401);
  assert.equal((await call('/v1/me',{token:student})).status,401);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
