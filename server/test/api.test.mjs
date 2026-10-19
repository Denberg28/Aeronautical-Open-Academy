import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAcademy } from '../src/server.mjs';
import { LocalMaterials } from '../src/materials.mjs';
import { canManage,hashPassword,verifyPassword } from '../src/security.mjs';

const pass='A long private testing passphrase!';
async function fixture(options={}){
 const directory=await mkdtemp(join(tmpdir(),'academy-api-test-'));let time=Date.now();
 const app=await createAcademy({dbPath:join(directory,'test.sqlite'),materials:options.materials||new LocalMaterials(join(directory,'files')),bootstrap:{email:'admin@example.test',name:'Administrator',password:pass},scryptN:16384,clock:()=>time});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 async function call(path,{method='GET',token,body,key,binary}={}){
  const headers={};if(token)headers.Authorization='Bearer '+token;if(key)headers['Idempotency-Key']=key;
  if(body!==undefined)headers['Content-Type']='application/json';if(binary)headers['Content-Type']='application/pdf';
  const response=await fetch(base+path,{method,headers,body:binary|| (body===undefined?undefined:JSON.stringify(body))});
  return {status:response.status,headers:response.headers,body:response.headers.get('content-type')?.startsWith('application/pdf')?Buffer.from(await response.arrayBuffer()):await response.json()};
 }
 async function login(emailAddress,password=pass){const r=await call('/v1/auth/login',{method:'POST',body:{email:emailAddress,password}});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.token;}
 const admin=await login('admin@example.test');
 async function account(emailAddress,role){const r=await call('/v1/admin/accounts',{method:'POST',token:admin,body:{email:emailAddress,name:role,password:pass,role}});assert.equal(r.status,201,JSON.stringify(r.body));let token=await login(emailAddress);const changed=await call('/v1/auth/password',{method:'POST',token,body:{current_password:pass,new_password:pass+'changed'}});assert.equal(changed.status,200);token=await login(emailAddress,pass+'changed');return {...r.body.account,token};}
 return {app,call,login,admin,account,advance:n=>time+=n,close:async()=>{await app.close();await rm(directory,{recursive:true,force:true});}};
}

test('passwords are salted and verified; ownership never follows a client role claim',async()=>{
 const hash=await hashPassword(pass,16384);assert.ok(!hash.includes(pass));assert.ok(await verifyPassword(pass,hash));assert.ok(!await verifyPassword('wrong',hash));
 assert.ok(canManage({id:'a',role:'instructor',status:'active'},'a'));assert.ok(!canManage({id:'b',role:'instructor',status:'active'},'a'));assert.ok(!canManage({id:'a',role:'admin',status:'suspended'},'a'));
});

test('registration is admin-only; temporary passwords and user-selected roles do not grant access',async()=>{
 const f=await fixture();try{
  assert.equal((await f.call('/v1/admin/accounts',{method:'POST',body:{role:'admin'}})).status,401);
  const student=await f.account('student@example.test','student');
  assert.equal((await f.call('/v1/admin/accounts',{token:student.token})).status,403);
  assert.equal((await f.call('/v1/admin/accounts',{method:'POST',token:student.token,body:{role:'admin'}})).status,403);
  const user=await f.call('/v1/me',{token:student.token});assert.equal(user.body.account.role,'student');assert.ok(!JSON.stringify(user.body).includes('password_hash'));
  const created=await f.call('/v1/admin/accounts',{method:'POST',token:f.admin,body:{email:'pending@example.test',name:'Pending',password:pass,role:'student'}});assert.equal(created.status,201);
  const pending=await f.login('pending@example.test');assert.equal((await f.call('/v1/subjects',{token:pending})).status,403);
  assert.equal((await f.call('/v1/me',{token:pending})).body.account.must_change_password,true);
 }finally{await f.close();}
});

test('subject enrolment, creator ownership, draft visibility, and answer-key isolation',async()=>{
 const f=await fixture();try{
  const i1=await f.account('i1@example.test','instructor'),i2=await f.account('i2@example.test','instructor'),s=await f.account('s@example.test','student');
  const created=await f.call('/v1/subjects',{method:'POST',token:i1.token,body:{title:'Subject A',description:'Sample'}}),id=created.body.id;
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).status,404);
  assert.equal((await f.call('/v1/subjects/'+id,{token:i2.token})).status,404);
  assert.equal((await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i2.token,body:{kind:'activity',title:'Stolen',body:'x'}})).status,404);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{student_id:s.id,subject_id:id}});
  const q=await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i1.token,body:{kind:'quiz',title:'Quiz',body:'Choose one.',options:['First','Second'],correct_index:1,published:true}});assert.equal(q.status,201);
  await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i1.token,body:{kind:'activity',title:'Draft',body:'Not yet published'}});
  const view=await f.call('/v1/subjects/'+id,{token:s.token});assert.equal(view.body.items.length,1);assert.ok(!JSON.stringify(view.body).includes('correct_index'));assert.ok(!JSON.stringify(view.body).includes('file_ref'));
  assert.equal((await f.call('/v1/subjects/'+id,{token:i1.token})).body.items.find(item=>item.id===q.body.id).correct_index,1);
  assert.equal((await f.call('/v1/items/'+q.body.id,{method:'PATCH',token:i2.token,body:{title:'Changed'}})).status,404);
 }finally{await f.close();}
});

test('quiz grading is server-side, idempotent, bounded, and separate from completion flags',async()=>{
 const f=await fixture();try{
  const i=await f.account('i@example.test','instructor'),s=await f.account('s@example.test','student');
  const course=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject B',description:'Sample'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:course,student_id:s.id}});
  const q=(await f.call('/v1/subjects/'+course+'/items',{method:'POST',token:i.token,body:{kind:'quiz',title:'Quiz',body:'Choose.',options:['A','B'],correct_index:1,published:true}})).body.id;
  assert.equal((await f.call('/v1/items/'+q+'/complete',{method:'POST',token:s.token,body:{completed:true}})).status,409);
  const key=randomUUID();const first=await f.call('/v1/items/'+q+'/quiz',{method:'POST',token:s.token,key,body:{choice:0,score:1,correct_index:0}});assert.equal(first.status,201);assert.equal(first.body.attempt.score,0);
  const repeated=await f.call('/v1/items/'+q+'/quiz',{method:'POST',token:s.token,key,body:{choice:0}});assert.equal(repeated.status,200);assert.equal(repeated.body.attempt.id,first.body.attempt.id);
  assert.equal((await f.call('/v1/items/'+q+'/quiz',{method:'POST',token:s.token,key,body:{choice:1}})).status,409);
  assert.equal((await f.call('/v1/items/'+q+'/quiz',{method:'POST',token:s.token,key:randomUUID(),body:{choice:1}})).status,409);
  assert.equal((await f.call('/v1/subjects/'+course,{token:s.token})).body.items[0].completed,true);
 }finally{await f.close();}
});

test('suspension, deletion, logout and expiry revoke access rather than relying on UI',async()=>{
 const f=await fixture();try{
  const s=await f.account('s@example.test','student');
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'PATCH',token:f.admin,body:{status:'suspended'}})).status,200);
  assert.equal((await f.call('/v1/me',{token:s.token})).status,401);
  assert.equal((await f.call('/v1/auth/login',{method:'POST',body:{email:s.email,password:pass+'changed'}})).status,401);
  await f.call('/v1/admin/accounts/'+s.id,{method:'PATCH',token:f.admin,body:{status:'active'}});const next=await f.login(s.email,pass+'changed');
  assert.equal((await f.call('/v1/me',{token:s.token})).status,401);
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'PATCH',token:f.admin,body:{status:'deleted',confirm_email:'wrong'}})).status,400);
  await f.call('/v1/admin/accounts/'+s.id,{method:'PATCH',token:f.admin,body:{status:'deleted',confirm_email:s.email}});
  assert.equal((await f.call('/v1/me',{token:next})).status,401);
  const self=(await f.call('/v1/me',{token:f.admin})).body.account;
  assert.equal((await f.call('/v1/admin/accounts/'+self.id,{method:'PATCH',token:f.admin,body:{status:'deleted',confirm_email:self.email}})).status,409);
  const t=await f.account('t@example.test','student');await f.call('/v1/auth/logout',{method:'POST',token:t.token});assert.equal((await f.call('/v1/me',{token:t.token})).status,401);
  f.advance(31*60*1000);assert.equal((await f.call('/v1/me',{token:f.admin})).status,401);
 }finally{await f.close();}
});

test('protected files require enrolment and creator authority; view does not grant offline permission',async()=>{
 const f=await fixture();try{
  const i=await f.account('i@example.test','instructor'),j=await f.account('j@example.test','instructor'),s=await f.account('s@example.test','student');
  const course=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject C',description:'Sample'}})).body.id;
  const item=(await f.call('/v1/subjects/'+course+'/items',{method:'POST',token:i.token,body:{kind:'material',title:'PDF',body:'Notes',published:true}})).body.id;
  const pdf=Buffer.from('%PDF-1.4\noriginal sample\n%%EOF');
  assert.equal((await f.call('/v1/items/'+item+'/file',{method:'POST',token:j.token,binary:pdf})).status,404);
  assert.equal((await f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:Buffer.from('<html>sign in</html>')})).status,400);
  assert.equal((await f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:pdf})).status,200);
  assert.equal((await f.call('/v1/items/'+item+'/content',{token:s.token})).status,404);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{student_id:s.id,subject_id:course}});
  const read=await f.call('/v1/items/'+item+'/content',{token:s.token});assert.equal(read.status,200);assert.deepEqual(read.body,pdf);assert.equal(read.headers.get('cache-control'),'no-store');
  assert.equal((await f.call('/v1/items/'+item+'/content?download=1',{token:s.token})).status,403);
  assert.equal((await f.call('/v1/items/'+item+'/content?download=1',{token:i.token})).status,200);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{student_id:s.id,subject_id:course,enrolled:false}});
  assert.equal((await f.call('/v1/items/'+item+'/content',{token:s.token})).status,404);
 }finally{await f.close();}
});

test('global announcements are admin-only and visible to active accounts',async()=>{
 const f=await fixture();try{
  const s=await f.account('s@example.test','student');
  assert.equal((await f.call('/v1/announcements',{method:'POST',token:s.token,body:{title:'Bad',body:'Bad'}})).status,403);
  const created=await f.call('/v1/announcements',{method:'POST',token:f.admin,body:{title:'Welcome',body:'Read the subject overview.'}});assert.equal(created.status,201);
  assert.equal((await f.call('/v1/announcements',{token:s.token})).body.announcements[0].title,'Welcome');
  assert.equal((await f.call('/v1/announcements')).status,401);
 }finally{await f.close();}
});

test('role changes and password resets revoke old sessions; unauthorized ownership writes fail',async()=>{
 const f=await fixture();try{
  const i=await f.account('i@example.test','instructor');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Sample'}})).body.id;
  const item=(await f.call('/v1/subjects/'+subject+'/items',{method:'POST',token:i.token,body:{kind:'activity',title:'Activity',body:'Do the work',published:true}})).body.id;
  assert.equal((await f.call('/v1/items/'+item,{method:'POST',token:i.token,body:{owner_id:randomUUID()}})).status,400);
  assert.equal((await f.call('/v1/admin/accounts/'+i.id,{method:'POST',token:f.admin,body:{role:'student'}})).status,200);
  assert.equal((await f.call('/v1/subjects',{token:i.token})).status,401);
  const downgraded=await f.login(i.email,pass+'changed');assert.equal((await f.call('/v1/subjects/'+subject,{token:downgraded})).status,404);
  assert.equal((await f.call('/v1/admin/accounts/'+i.id+'/password',{method:'POST',token:f.admin,body:{password:pass+'new reset'}})).status,200);
  assert.equal((await f.call('/v1/me',{token:downgraded})).status,401);
  const reset=await f.login(i.email,pass+'new reset');assert.equal((await f.call('/v1/subjects',{token:reset})).status,403);
  const me=(await f.call('/v1/me',{token:f.admin})).body.account;
  assert.equal((await f.call('/v1/admin/accounts/'+me.id,{method:'POST',token:f.admin,body:{role:'student'}})).status,409);
 }finally{await f.close();}
});

test('suspension during an upstream upload wins before publishing metadata',async()=>{
 const started=Promise.withResolvers(),proceed=Promise.withResolvers();let removed=false;
 const store={async put(){started.resolve();await proceed.promise;return randomUUID();},async remove(){removed=true;}};
 const f=await fixture({materials:store});try{
  const i=await f.account('i@example.test','instructor');
  const course=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Sample'}})).body.id;
  const item=(await f.call('/v1/subjects/'+course+'/items',{method:'POST',token:i.token,body:{kind:'material',title:'PDF',body:'Notes',published:false}})).body.id;
  const upload=f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:Buffer.from('%PDF-1.4\nfixture\n%%EOF')});
  await started.promise;
  assert.equal((await f.call('/v1/admin/accounts/'+i.id,{method:'POST',token:f.admin,body:{status:'suspended'}})).status,200);proceed.resolve();
  assert.equal((await upload).status,401);assert.equal(removed,true);
  assert.equal(f.app.db.prepare('select file_ref from items where id=?').get(item).file_ref,null);
 }finally{proceed.resolve();await f.close();}
});
