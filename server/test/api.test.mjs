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
 const app=await createAcademy({dbPath:join(directory,'test.sqlite'),materials:'materials' in options?options.materials:new LocalMaterials(join(directory,'files')),bootstrap:{email:'admin@example.test',name:'Administrator',password:pass},scryptN:16384,clock:()=>time});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 async function call(path,{method='GET',token,body,key,binary}={}){
  const headers={};if(token)headers.Authorization='Bearer '+token;if(key)headers['Idempotency-Key']=key;
  if(body!==undefined)headers['Content-Type']='application/json';if(binary)headers['Content-Type']='application/pdf';
  const response=await fetch(base+path,{method,headers,body:binary|| (body===undefined?undefined:JSON.stringify(body))});
  return {status:response.status,headers:response.headers,body:(/^(application\/pdf|application\/vnd.openxmlformats)/.test(response.headers.get('content-type')||''))?Buffer.from(await response.arrayBuffer()):await response.json()};
 }
 async function login(emailAddress,password=pass){const r=await call('/v1/auth/login',{method:'POST',body:{email:emailAddress,password}});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.token;}
 const admin=await login('admin@example.test');
 async function account(emailAddress,role,student_number){const r=await call('/v1/admin/accounts',{method:'POST',token:admin,body:{email:emailAddress,name:role,password:pass,role,...(student_number?{student_number}:{})}});assert.equal(r.status,201,JSON.stringify(r.body));let token=await login(emailAddress);const changed=await call('/v1/auth/password',{method:'POST',token,body:{current_password:pass,new_password:pass+'changed'}});assert.equal(changed.status,200);token=await login(emailAddress,pass+'changed');return {...r.body.account,token};}
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

test('self-enrollment is opt-in, identity-bound and idempotent; discovery never reveals protected content',async()=>{
 const f=await fixture();try{
  const i=await f.account('enroll-i@example.test','instructor'),s=await f.account('enroll-s@example.test','student'),other=await f.account('enroll-o@example.test','student');
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Enrollment sample'}})).body.id;
  assert.equal((await f.call('/v1/subjects/discover',{token:s.token})).body.subjects.length,0);
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:s.token,body:{}})).status,404);
  assert.equal((await f.call('/v1/subjects/'+id,{method:'POST',token:s.token,body:{self_enrol:true}})).status,404);
  assert.equal((await f.call('/v1/subjects/'+id,{method:'POST',token:i.token,body:{self_enrol:true}})).status,200);
  const discovered=(await f.call('/v1/subjects/discover',{token:s.token})).body.subjects;assert.deepEqual(Object.keys(discovered[0]).sort(),['description','id','title']);
  for(let n=0;n<2;n++)assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:s.token,body:{student_id:other.id}})).status,200);
  assert.equal((await f.call('/v1/subjects/'+id,{token:other.token})).status,404);
  assert.equal((await f.call('/v1/subjects/discover',{token:s.token})).body.subjects.length,0);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id,enrolled:false}});
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:s.token,body:{}})).status,404);
  assert.equal((await f.call('/v1/subjects/discover',{token:s.token})).body.subjects.length,0);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id}});
  await f.call('/v1/subjects/'+id,{method:'POST',token:i.token,body:{self_enrol:false}});
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).status,200);
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:other.token,body:{}})).status,404);
 }finally{await f.close();}
});

test('reading, written output, exams, quiz results and grading have separate revision-aware measures',async()=>{
 const f=await fixture();try{
  const i=await f.account('grade-i@example.test','instructor'),s=await f.account('grade-s@example.test','student'),o=await f.account('grade-o@example.test','student'),j=await f.account('grade-j@example.test','instructor');
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject B',description:'Assessment sample'}})).body.id;
  for(const student of [s,o])await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:student.id}});
  const add=async kind=>(await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i.token,body:{kind,title:kind,body:'Submit your answer',published:true,...(kind==='quiz'?{options:['A','B'],correct_index:1}:{})}})).body.id;
  const material=await add('material'),work=await add('activity'),exam=await add('examination'),quiz=await add('quiz');
  await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i.token,body:{kind:'activity',title:'Draft',body:'Draft excluded'}});
  assert.equal((await f.call('/v1/items/'+work+'/complete',{method:'POST',token:s.token,body:{completed:true}})).status,409);
  assert.equal((await f.call('/v1/items/'+material+'/complete',{method:'POST',token:s.token,body:{completed:true}})).status,200);
  const key=randomUUID(),output='My assessed written output';
  assert.equal((await f.call('/v1/items/'+work+'/submission',{method:'POST',token:s.token,key,body:{output,score:100,student_id:o.id}})).status,201);
  assert.equal((await f.call('/v1/items/'+work+'/submission',{method:'POST',token:s.token,key,body:{output}})).status,200);
  assert.equal((await f.call('/v1/items/'+work+'/submission',{method:'POST',token:s.token,key,body:{output:'changed'}})).status,409);
  assert.equal((await f.call('/v1/items/'+work+'/submission',{method:'POST',token:s.token,key:randomUUID(),body:{output}})).status,409);
  await f.call('/v1/items/'+exam+'/submission',{method:'POST',token:s.token,key:randomUUID(),body:{output:'Written examination response'}});
  await f.call('/v1/items/'+quiz+'/quiz',{method:'POST',token:s.token,key:randomUUID(),body:{choice:0,score:1}});
  let view=(await f.call('/v1/subjects/'+id,{token:s.token})).body;
  assert.deepEqual(view.summary,{read:1,materials:1,read_percent:100,submitted:3,required:3,compliance_percent:100,graded:1,awaiting_assessment:2,completed:4,total:4,completion_percent:100});
  assert.equal(view.items.find(x=>x.id===exam).assessment_type,'examination');
  assert.equal(view.items.find(x=>x.id===work).submission.score,null);
  assert.ok(!JSON.stringify((await f.call('/v1/subjects/'+id,{token:o.token})).body).includes(output));
  for(const denied of [s,o,j]){
   assert.equal((await f.call('/v1/subjects/'+id+'/learners',{token:denied.token})).status,404);
   assert.equal((await f.call('/v1/subjects/'+id+'/learners/'+s.id,{token:denied.token})).status,404);
   assert.equal((await f.call('/v1/subjects/'+id+'/export',{token:denied.token})).status,404);
  }
  let detail=(await f.call('/v1/subjects/'+id+'/learners/'+s.id,{token:i.token})).body;
  assert.equal(detail.items.find(x=>x.id===work).output,output);assert.equal(detail.items.find(x=>x.id===quiz).answer,'A');
  const submission=detail.items.find(x=>x.id===work).submission_id;
  assert.equal((await f.call('/v1/submissions/'+submission+'/grade',{method:'POST',token:j.token,body:{score:100,feedback:'Bad'}})).status,404);
  assert.equal((await f.call('/v1/submissions/'+submission+'/grade',{method:'POST',token:s.token,body:{score:100,feedback:'Bad'}})).status,404);
  assert.equal((await f.call('/v1/submissions/'+submission+'/grade',{method:'POST',token:i.token,body:{score:101,feedback:'Bad'}})).status,400);
  assert.equal((await f.call('/v1/submissions/'+submission+'/grade',{method:'POST',token:i.token,body:{score:0,feedback:'Please revisit section 1.'}})).status,200);
  assert.equal((await f.call('/v1/submissions/'+submission+'/grade',{method:'POST',token:i.token,body:{score:99,feedback:'Stale overwrite'}})).status,409);
  detail=(await f.call('/v1/subjects/'+id+'/learners/'+s.id,{token:i.token})).body;assert.equal(detail.summary.graded,2);assert.equal(detail.summary.awaiting_assessment,1);
  view=(await f.call('/v1/subjects/'+id,{token:s.token})).body;assert.equal(view.items.find(x=>x.id===work).submission.score,0);assert.equal(view.items.find(x=>x.id===work).submission.feedback,'Please revisit section 1.');
  await f.call('/v1/items/'+work,{method:'POST',token:i.token,body:{body:'New instructions'}});
  view=(await f.call('/v1/subjects/'+id,{token:s.token})).body;assert.equal(view.summary.completion_percent,75);assert.equal(view.summary.submitted,2);assert.equal(view.items.find(x=>x.id===work).submission,null);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM submissions WHERE id=?').get(submission).n,1);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id,enrolled:false}});
  assert.equal((await f.call('/v1/subjects/'+id+'/learners/'+s.id,{token:i.token})).status,404);
 }finally{await f.close();}
});

test('Excel export is a real, scoped workbook with literal strings, numeric results and pagination metadata',async()=>{
 const f=await fixture();try{
  const i=await f.account('export-i@example.test','instructor'),s=await f.account('export-s@example.test','student');
  f.app.db.prepare('UPDATE accounts SET name=? WHERE id=?').run('=HYPERLINK("https://example.invalid","Name") & <tag>',s.id);
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject C',description:'Export'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id}});
  const result=await f.call('/v1/subjects/'+id+'/export',{token:i.token});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.body.subarray(0,2).toString(),'PK');
  const {spawnSync}=await import('node:child_process');
  const checked=spawnSync('python3',['-c',`import sys,io,zipfile,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None
n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
w=E.fromstring(z.read('xl/workbook.xml')); assert [s.attrib['name'] for s in w.findall('s:sheets/s:sheet',n)]==['Quiz scores','Summary','Assessments','Report notes']
for f in z.namelist():
 if f.endswith('.xml'):
  x=E.fromstring(z.read(f)); assert not x.findall('.//s:f',n)
s=E.fromstring(z.read('xl/worksheets/sheet2.xml')); cell=s.find(".//s:c[@r='B2']",n); assert cell.attrib['t']=='inlineStr'; assert cell.find('s:is/s:t',n).text.startswith('=HYPERLINK')
assert 'Total enrolled students' in z.read('xl/worksheets/sheet4.xml').decode()
print('PASS OOXML ZIP CRC, workbook relationships, literal formula-like strings, XML and report scope')`],{input:result.body});
  assert.equal(checked.status,0,checked.stderr?.toString());
  const empty=await f.call('/v1/subjects/'+id+'/learners?offset=100',{token:i.token});assert.equal(empty.body.learners.length,0);assert.equal(empty.body.total,1);assert.equal(empty.body.next_offset,null);
  assert.ok(f.app.db.prepare("SELECT id FROM audit WHERE action='gradebook-export' AND target_id=?").get(id));
 }finally{await f.close();}
});

test('roster pagination is bounded and deletion removes written records and rejoining blocks',async()=>{
 const f=await fixture();try{
  const i=await f.account('page-i@example.test','instructor'),s=await f.account('page-s@example.test','student');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Paged roster'}})).body.id;
  const insert=f.app.db.prepare("INSERT INTO accounts(id,email,name,role,password_hash,must_change_password,created_at) VALUES(?,?,?,'student','test-only',0,1)"),enrol=f.app.db.prepare('INSERT INTO enrolments(subject_id,student_id) VALUES(?,?)');
  for(let n=0;n<101;n++){const id=randomUUID();insert.run(id,'fixture'+n+'@example.test','Student '+String(n).padStart(3,'0'));enrol.run(subject,id);}
  let page=(await f.call('/v1/subjects/'+subject+'/learners',{token:i.token})).body;assert.equal(page.learners.length,100);assert.equal(page.total,101);assert.equal(page.next_offset,100);
  const second=(await f.call('/v1/subjects/'+subject+'/learners?offset=100',{token:i.token})).body;assert.equal(second.learners.length,1);assert.equal(second.next_offset,null);assert.ok(!page.learners.some(x=>x.student.id===second.learners[0].student.id));
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:s.id}});
  const item=(await f.call('/v1/subjects/'+subject+'/items',{method:'POST',token:i.token,body:{kind:'activity',title:'Output',body:'Write',published:true}})).body.id;
  await f.call('/v1/items/'+item+'/submission',{method:'POST',token:s.token,key:randomUUID(),body:{output:'Delete with my account'}});
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:s.id,enrolled:false}});
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM submissions WHERE student_id=?').get(s.id).n,1);
  await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{status:'deleted',confirm_email:s.email}});
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM submissions WHERE student_id=?').get(s.id).n,0);assert.equal(f.app.db.prepare('SELECT count(*) n FROM enrolment_blocks WHERE student_id=?').get(s.id).n,0);
 }finally{await f.close();}
});

test('student IDs are admin-managed, normalized, unique, and not trusted from enrollment payloads',async()=>{
 const f=await fixture();try{
  const i=await f.account('id-i@example.test','instructor'),s=await f.account('id-s@example.test','student','0001-ab'),other=await f.account('id-o@example.test','student','0002-ab');
  assert.equal((await f.call('/v1/me',{token:s.token})).body.account.student_number,'0001-AB');
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:s.token,body:{student_number:'0002-AB'}})).status,403);
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:i.token,body:{student_number:'0002-AB'}})).status,403);
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{student_number:'0002-ab'}})).status,409);
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{student_number:'../bad'}})).status,400);
  assert.equal((await f.call('/v1/admin/accounts',{method:'POST',token:f.admin,body:{name:'Duplicate',email:'duplicate@example.test',role:'student',student_number:'0001-AB',password:pass}})).status,409);
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Eligibility'}})).body.id;
  let policy=(await f.call('/v1/subjects/'+id+'/eligibility',{token:i.token})).body;
  assert.deepEqual(policy,{all_students:false,student_numbers:[],revision:1});
  assert.equal((await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:false,student_numbers:['0001-ab','0001-AB'],expected_revision:policy.revision}})).status,200);
  const discovery=(await f.call('/v1/subjects/discover',{token:s.token})).body;assert.equal(discovery.subjects.length,1);assert.deepEqual(Object.keys(discovery.subjects[0]).sort(),['description','id','title']);
  assert.equal((await f.call('/v1/subjects/discover',{token:other.token})).body.subjects.length,0);
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:other.token,body:{source:'qr',student_number:'0001-AB',student_id:s.id}})).status,404);
  for(let n=0;n<3;n++)assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:s.token,body:{source:'qr'}})).status,200);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM enrolments WHERE subject_id=?').get(id).n,1);
  assert.equal(f.app.db.prepare('SELECT source FROM enrolments WHERE subject_id=?').get(id).source,'qr');
  assert.equal((await f.call('/v1/subjects/'+id+'/eligibility',{token:s.token})).status,404);
  assert.equal((await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:true,student_numbers:[],expected_revision:1}})).status,409);
  policy=(await f.call('/v1/subjects/'+id+'/eligibility',{token:i.token})).body;assert.deepEqual(policy.student_numbers,['0001-AB']);
  assert.equal((await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:true,student_numbers:['0001-AB'],expected_revision:policy.revision}})).status,400);
  assert.equal((await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:false,student_numbers:['bad ID'],expected_revision:policy.revision}})).status,400);
 }finally{await f.close();}
});

test('all-students, narrowing eligibility, administrative overrides, blocks and suspension obey authority',async()=>{
 const f=await fixture();try{
  const i=await f.account('rule-i@example.test','instructor'),j=await f.account('rule-j@example.test','instructor'),s=await f.account('rule-s@example.test','student','2026-001'),o=await f.account('rule-o@example.test','student','2026-002');
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject B',description:'Eligibility'}})).body.id;
  const save=async(all_students,student_numbers)=>{const p=(await f.call('/v1/subjects/'+id+'/eligibility',{token:i.token})).body;const r=await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students,student_numbers,expected_revision:p.revision}});assert.equal(r.status,200);return r.body;};
  assert.equal((await f.call('/v1/subjects/'+id+'/eligibility',{token:j.token})).status,404);
  await save(true,[]);
  for(const student of [s,o])assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:student.token,body:{source:'qr'}})).status,200);
  await save(false,['2026-001']);
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).status,200);
  assert.equal((await f.call('/v1/subjects/'+id,{token:o.token})).status,404);
  assert.equal((await f.call('/v1/subjects',{token:o.token})).body.subjects.length,0);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id}});
  await save(false,[]); // administrator promotion to explicit enrollment survives closure
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).status,200);
  assert.equal(f.app.db.prepare('SELECT source FROM enrolments WHERE subject_id=? AND student_id=?').get(id,s.id).source,'admin');
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id,enrolled:false}});
  await save(true,[]);
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:s.token,body:{source:'qr'}})).status,404);
  await f.call('/v1/admin/accounts/'+o.id,{method:'POST',token:f.admin,body:{status:'suspended'}});
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:o.token,body:{source:'qr'}})).status,401);
  assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:i.token,body:{source:'qr'}})).status,403);
 }finally{await f.close();}
});

test('correcting or deleting an ID removes old eligibility, automatic enrollments and sessions without losing work',async()=>{
 const f=await fixture();try{
  const i=await f.account('correct-i@example.test','instructor'),s=await f.account('correct-s@example.test','student','0100-X');
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject C',description:'Correction'}})).body.id;
  await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:false,student_numbers:['0100-X'],expected_revision:1}});
  await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:s.token,body:{source:'qr'}});
  const item=(await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i.token,body:{kind:'activity',title:'Work',body:'Write',published:true}})).body.id;
  await f.call('/v1/items/'+item+'/submission',{method:'POST',token:s.token,key:randomUUID(),body:{output:'Retained on correction'}});
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{student_number:'0101-X'}})).status,200);
  assert.equal((await f.call('/v1/me',{token:s.token})).status,401);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM eligible_students WHERE student_number=?').get('0100-X').n,0);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM enrolments WHERE student_id=?').get(s.id).n,0);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM submissions WHERE student_id=?').get(s.id).n,1);
  let policy=(await f.call('/v1/subjects/'+id+'/eligibility',{token:i.token})).body;assert.ok(policy.revision>2);
  await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:false,student_numbers:['0101-X'],expected_revision:policy.revision}});
  const fresh=await f.login(s.email,pass+'changed');assert.equal((await f.call('/v1/subjects/'+id+'/enrol',{method:'POST',token:fresh,body:{source:'qr'}})).status,200);
  assert.equal((await f.call('/v1/subjects/'+id,{token:fresh})).body.items[0].submission.output,'Retained on correction');
  await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{status:'deleted',confirm_email:s.email}});
  assert.equal(f.app.db.prepare('SELECT student_number FROM accounts WHERE id=?').get(s.id).student_number,null);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM eligible_students WHERE student_number=?').get('0101-X').n,0);
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM submissions WHERE student_id=?').get(s.id).n,0);
 }finally{await f.close();}
});

test('account edits roll back on failure, and the subject owner can assess administrator-authored work',async()=>{
 const f=await fixture();try{
  const i=await f.account('review-i@example.test','instructor'),s=await f.account('review-s@example.test','student','0200-X');
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Review'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id}});
  const item=(await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:f.admin,body:{kind:'examination',title:'Exam',body:'Write',published:true}})).body.id;
  await f.call('/v1/items/'+item+'/submission',{method:'POST',token:s.token,key:randomUUID(),body:{output:'Assessed by assigned instructor'}});
  let detail=(await f.call('/v1/subjects/'+id+'/learners/'+s.id,{token:i.token})).body;
  assert.equal((await f.call('/v1/submissions/'+detail.items[0].submission_id+'/grade',{method:'POST',token:i.token,body:{score:85,feedback:'Reviewed',expected_graded_at:null}})).status,200);
  assert.equal((await f.call('/v1/items/'+item,{method:'POST',token:i.token,body:{body:'Unauthorized content edit'}})).status,403);
  // A late failure after identity cleanup must restore all account state and sessions.
  f.app.db.exec("CREATE TRIGGER fail_account_edit BEFORE UPDATE OF status ON accounts BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{student_number:'0201-X'}})).status,500);
  assert.equal((await f.call('/v1/me',{token:s.token})).body.account.student_number,'0200-X');
  f.app.db.exec('DROP TRIGGER fail_account_edit');
 }finally{await f.close();}
});

test('stale content edits and upload completion cannot overwrite a newer item version',async()=>{
 const started=Promise.withResolvers(),proceed=Promise.withResolvers();let removed=false;
 const store={async put(){started.resolve();await proceed.promise;return randomUUID();},async remove(){removed=true;}};
 const f=await fixture({materials:store});try{
  const i=await f.account('conflict-i@example.test','instructor');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description:'Concurrent editing'}})).body.id;
  const item=(await f.call('/v1/subjects/'+subject+'/items',{method:'POST',token:i.token,body:{kind:'material',title:'PDF',body:'Original instructions'}})).body.id;
  const upload=f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:Buffer.from('%PDF-1.4\nfixture\n%%EOF')});await started.promise;
  assert.equal((await f.call('/v1/items/'+item,{method:'POST',token:i.token,body:{body:'Newer instructions',expected_edit_version:1}})).status,200);
  assert.equal((await f.call('/v1/items/'+item,{method:'POST',token:i.token,body:{body:'Stale content',expected_edit_version:1}})).status,409);
  proceed.resolve();assert.equal((await upload).status,409);assert.equal(removed,true);
  const saved=f.app.db.prepare('SELECT * FROM items WHERE id=?').get(item);assert.equal(saved.body,'Newer instructions');assert.equal(saved.file_ref,null);assert.equal(saved.edit_version,2);
 }finally{proceed.resolve();await f.close();}
});

test('material metadata and audit fail atomically, preserving the prior readable PDF',async()=>{
 const f=await fixture();try{
  const i=await f.account('atomic-i@example.test','instructor');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject C',description:'Atomic material update'}})).body.id;
  const item=(await f.call('/v1/subjects/'+subject+'/items',{method:'POST',token:i.token,body:{kind:'material',title:'PDF',body:'Original'}})).body.id;
  const original=Buffer.from('%PDF-1.4\noriginal\n%%EOF');assert.equal((await f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:original})).status,200);
  const before=f.app.db.prepare('SELECT file_ref,revision,edit_version FROM items WHERE id=?').get(item);
  f.app.db.exec("CREATE TRIGGER fail_material_audit BEFORE INSERT ON audit WHEN NEW.action='material-upload' BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:Buffer.from('%PDF-1.4\nnewer\n%%EOF')})).status,500);
  assert.deepEqual(f.app.db.prepare('SELECT file_ref,revision,edit_version FROM items WHERE id=?').get(item),before);
  assert.deepEqual((await f.call('/v1/items/'+item+'/content',{token:i.token})).body,original);
  f.app.db.exec('DROP TRIGGER fail_material_audit');
 }finally{await f.close();}
});

test('text-first materials work without file storage; links remain private references and do not imply reading',async()=>{
 const f=await fixture({materials:undefined});try{
  const i=await f.account('text-i@example.test','instructor'),s=await f.account('text-s@example.test','student'),o=await f.account('text-o@example.test','student'),j=await f.account('text-j@example.test','instructor');
  const me=(await f.call('/v1/me',{token:i.token})).body;assert.deepEqual(me.capabilities,{subject_tree:1,multi_question_quiz:1,max_quiz_questions:50,external_links:true,material_upload:false});
  const description='Subject links https://docs.google.com/document/d/demo/edit and http://www.example.org/intro';
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject A',description}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id}});
  await f.call('/v1/subjects/'+id+'/eligibility',{method:'POST',token:i.token,body:{all_students:true,student_numbers:[],expected_revision:1}});
  const discovery=(await f.call('/v1/subjects/discover',{token:o.token})).body.subjects;assert.equal(discovery.length,1);assert.ok(!JSON.stringify(discovery).includes('docs.google.com'));assert.equal(discovery[0].description,'Join to view subject text and resources.');
  const text='Week 1\nSlides https://docs.google.com/presentation/d/demo/edit#slide=id.1\nPDF https://www.example.org/lesson.pdf\nExcel https://www.example.org/data.xlsx\nVideo https://www.youtube.com/watch?v=demo';
  const item=(await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i.token,body:{kind:'material',material_mode:'text',title:'Week 1',body:text,published:true}})).body.id;
  const open=()=>f.call('/v1/items/'+item+'/open-link',{method:'POST',token:s.token,body:{url:'https://www.example.org/lesson.pdf',expected_revision:1}});
  assert.equal((await open()).status,200);assert.equal((await open()).body.url,'https://www.example.org/lesson.pdf');
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).body.summary.read,0);
  assert.equal(f.app.db.prepare('SELECT file_ref FROM items WHERE id=?').get(item).file_ref,null);
  for(const denied of [o,j])assert.equal((await f.call('/v1/items/'+item+'/open-link',{method:'POST',token:denied.token,body:{url:'https://www.example.org/lesson.pdf',expected_revision:1}})).status,404);
  assert.equal((await f.call('/v1/items/'+item+'/open-link',{method:'POST',token:s.token,body:{url:'https://www.example.org/injected',expected_revision:1}})).status,409);
  assert.equal((await f.call('/v1/items/'+item+'/open-link',{method:'POST',token:s.token,body:{url:'javascript:alert(1)',expected_revision:1}})).status,400);
  assert.equal((await f.call('/v1/items/'+item,{method:'POST',token:j.token,body:{body:'Stolen edit'}})).status,404);
  assert.equal((await f.call('/v1/items/'+item+'/file',{method:'POST',token:i.token,binary:Buffer.from('%PDF-1.4\nfixture\n%%EOF')})).status,409);
  assert.equal((await f.call('/v1/items/'+item+'/content',{token:s.token})).status,404);
  assert.equal((await f.call('/v1/items/'+item+'/complete',{method:'POST',token:s.token,body:{completed:true}})).status,200);
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).body.summary.read,1);
  const subjectLink=await f.call('/v1/subjects/'+id+'/open-link',{method:'POST',token:s.token,body:{url:'http://www.example.org/intro',expected_description:description}});assert.equal(subjectLink.status,200);
  assert.equal((await f.call('/v1/subjects/'+id+'/open-link',{method:'POST',token:s.token,body:{url:'https://www.example.org/other',expected_description:description}})).status,409);
 }finally{await f.close();}
});

test('drafts, changed links, removed enrollment and suspension cannot open a material through stale metadata',async()=>{
 const f=await fixture();try{
  const i=await f.account('revlink-i@example.test','instructor'),s=await f.account('revlink-s@example.test','student');
  const description='https://www.example.org/subject';
  const id=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Subject B',description}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id}});
  const item=(await f.call('/v1/subjects/'+id+'/items',{method:'POST',token:i.token,body:{kind:'material',material_mode:'text',title:'Lesson',body:'https://www.example.org/original'}})).body.id;
  const open=(url='https://www.example.org/original',expected_revision=1)=>f.call('/v1/items/'+item+'/open-link',{method:'POST',token:s.token,body:{url,expected_revision}});
  assert.equal((await open()).status,404);
  await f.call('/v1/items/'+item,{method:'POST',token:i.token,body:{published:true,expected_edit_version:1}});assert.equal((await open()).status,200);
  await f.call('/v1/items/'+item+'/complete',{method:'POST',token:s.token,body:{completed:true}});
  await f.call('/v1/items/'+item,{method:'POST',token:i.token,body:{body:'https://www.example.org/replacement',expected_edit_version:2}});
  assert.equal((await open()).status,409);assert.equal((await open('https://www.example.org/original',2)).status,409);assert.equal((await open('https://www.example.org/replacement',2)).status,200);
  assert.equal((await f.call('/v1/subjects/'+id,{token:s.token})).body.summary.read,0);
  assert.equal((await f.call('/v1/subjects/'+id,{method:'POST',token:i.token,body:{description:'https://www.example.org/new-subject',expected_description:description}})).status,200);
  assert.equal((await f.call('/v1/subjects/'+id+'/open-link',{method:'POST',token:s.token,body:{url:'https://www.example.org/subject',expected_description:description}})).status,409);
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:id,student_id:s.id,enrolled:false}});
  assert.equal((await open('https://www.example.org/replacement',2)).status,404);
  await f.call('/v1/admin/accounts/'+s.id,{method:'POST',token:f.admin,body:{status:'suspended'}});assert.equal((await open('https://www.example.org/replacement',2)).status,401);
 }finally{await f.close();}
});

test('entry order is owner-controlled, atomic, persistent and independent of learning revisions',async()=>{
 const f=await fixture();try{
  const owner=await f.account('sequence-owner@example.test','instructor'),other=await f.account('sequence-other@example.test','instructor'),student=await f.account('sequence-student@example.test','student','SEQ-001');
  const created=await f.call('/v1/subjects',{method:'POST',token:owner.token,body:{title:'Sequence subject',description:'Practice order'}}),subject=created.body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{student_id:student.id,subject_id:subject,enrolled:true}});
  const ids=[];for(const title of ['First','Second','Third']){const r=await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind:'material',material_mode:'text',title,body:title,published:true}});assert.equal(r.status,201);ids.push(r.body.id);}
  await f.call(`/v1/items/${ids[0]}/complete`,{method:'POST',token:student.token,body:{completed:true}});
  const course=await f.call(`/v1/subjects/${subject}`,{token:owner.token}),revision=course.body.subject.order_revision,order={item_ids:[...ids].reverse(),expected_revision:revision};
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:student.token,body:order})).status,404);
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:other.token,body:order})).status,404);
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:owner.token,body:{...order,item_ids:[ids[0],ids[0],ids[2]]}})).status,400);
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:owner.token,body:order})).status,200);
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:owner.token,body:order})).status,409);
  const view=await f.call(`/v1/subjects/${subject}`,{token:student.token});assert.deepEqual(view.body.items.map(i=>i.id),[...ids].reverse());assert.equal(view.body.summary.read,1);assert.ok(view.body.items.every(i=>i.revision===1));
  const added=await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind:'material',material_mode:'text',title:'Fourth',body:'Appended',published:true}});
  const latest=await f.call(`/v1/subjects/${subject}`,{token:owner.token});assert.equal(latest.body.items.at(-1).id,added.body.id);
  await f.call(`/v1/items/${ids[1]}`,{method:'POST',token:owner.token,body:{archived:true,expected_edit_version:1}});
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:owner.token,body:{item_ids:latest.body.items.map(i=>i.id),expected_revision:latest.body.subject.order_revision}})).status,409);
  assert.ok(!(await f.call(`/v1/subjects/${subject}`,{token:student.token})).body.items.some(i=>i.id===ids[1]));
 }finally{await f.close();}
});

test('subject tree groups activities and quizzes, retains root examinations and preserves learning when moved',async()=>{
 const f=await fixture({materials:null});try{
  const owner=await f.account('tree-teacher@example.test','instructor'),student=await f.account('tree-student@example.test','student');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:owner.token,body:{title:'Tree subject',description:'Tree'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:student.id}});
  const create=async(kind,title,extra={})=>{
   const result=await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind,title,body:title,published:true,...extra}});
   assert.equal(result.status,201,JSON.stringify(result.body));return result.body.id;
  };
  const first=await create('material','First material'),second=await create('material','Second material'),exam=await create('examination','Subject examination');
  const activity=await create('activity','Practice',{parent_id:first}),quiz=await create('quiz','Check understanding',{parent_id:first,options:['A','B'],correct_index:1});
  const view=async(token=owner.token)=>(await f.call(`/v1/subjects/${subject}`,{token})).body;
  let detail=await view();assert.equal(detail.tree_version,1);assert.deepEqual(detail.items.map(i=>i.id),[first,activity,quiz,second,exam]);
  assert.equal(detail.items.find(i=>i.id===exam).parent_id,null);assert.equal(detail.items.find(i=>i.id===activity).parent_id,first);
  assert.equal((await f.call(`/v1/items/${quiz}/quiz`,{method:'POST',token:student.token,key:randomUUID(),body:{choice:1}})).status,201);
  const oldRevision=detail.subject.order_revision;
  assert.equal((await f.call(`/v1/items/${quiz}`,{method:'PATCH',token:owner.token,body:{parent_id:second,expected_edit_version:1,expected_order_revision:oldRevision}})).status,200);
  detail=await view(student.token);const moved=detail.items.find(i=>i.id===quiz);assert.equal(moved.parent_id,second);assert.equal(moved.revision,1);assert.equal(moved.attempt.score,1);assert.equal(moved.completed,true);
  assert.deepEqual(detail.items.map(i=>i.id),[first,activity,second,quiz,exam]);
  assert.equal((await f.call(`/v1/subjects/${subject}/order`,{method:'POST',token:owner.token,body:{item_ids:detail.items.map(i=>i.id),expected_revision:oldRevision}})).status,409);
  assert.equal((await f.call(`/v1/items/${exam}`,{method:'PATCH',token:owner.token,body:{parent_id:first,expected_edit_version:1,expected_order_revision:detail.subject.order_revision}})).status,400);
  const other=(await f.call('/v1/subjects',{method:'POST',token:owner.token,body:{title:'Other',description:'Other'}})).body.id;
  assert.equal((await f.call(`/v1/subjects/${other}/items`,{method:'POST',token:owner.token,body:{kind:'activity',title:'Wrong parent',body:'Wrong',parent_id:first}})).status,400);
  assert.equal((await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind:'material',title:'Nested material',body:'Subsection',parent_id:first}})).status,400);
  assert.equal((await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind:'examination',title:'Nested examination',body:'Wrong',parent_id:first}})).status,400);
  assert.equal((await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:student.token,body:{kind:'activity',title:'Forbidden',body:'Wrong',parent_id:first}})).status,404);
 }finally{await f.close();}
});

test('draft and archived material groups hide children from students, direct access, progress and reports',async()=>{
 const f=await fixture({materials:null});try{
  const teacher=await f.account('group-teacher@example.test','instructor'),student=await f.account('group-student@example.test','student');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:teacher.token,body:{title:'Grouped',description:'Grouped'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:student.id}});
  const material=(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:teacher.token,body:{kind:'material',title:'Draft material',body:'Notes',published:false}})).body.id;
  const child=(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:teacher.token,body:{kind:'activity',title:'Child',body:'Work https://www.nasa.gov/',parent_id:material,published:true}})).body.id;
  let detail=(await f.call(`/v1/subjects/${subject}`,{token:student.token})).body;assert.equal(detail.items.length,0);assert.equal(detail.summary.total,0);
  assert.equal((await f.call(`/v1/items/${child}`,{token:student.token})).status,404);
  assert.equal((await f.call(`/v1/items/${child}/open-link`,{method:'POST',token:student.token,body:{expected_revision:1,url:'https://www.nasa.gov/'}})).status,404);
  assert.equal((await f.call(`/v1/items/${child}/submission`,{method:'POST',token:student.token,key:randomUUID(),body:{output:'Too early'}})).status,404);
  await f.call(`/v1/items/${material}`,{method:'PATCH',token:teacher.token,body:{published:true,expected_edit_version:1}});
  assert.equal((await f.call(`/v1/items/${child}/submission`,{method:'POST',token:student.token,key:randomUUID(),body:{output:'Saved work'}})).status,201);
  detail=(await f.call(`/v1/subjects/${subject}`,{token:teacher.token})).body;
  assert.equal((await f.call(`/v1/items/${material}`,{method:'PATCH',token:teacher.token,body:{archived:true,expected_edit_version:2}})).status,409);
  assert.equal((await f.call(`/v1/items/${material}`,{method:'PATCH',token:teacher.token,body:{archived:true,archive_children:true,expected_edit_version:2,expected_order_revision:detail.subject.order_revision-1}})).status,409);
  assert.equal((await f.call(`/v1/items/${material}`,{method:'PATCH',token:teacher.token,body:{archived:true,archive_children:true,expected_edit_version:2,expected_order_revision:detail.subject.order_revision}})).status,200);
  assert.equal((await f.call(`/v1/items/${child}`,{token:student.token})).status,404);
  detail=(await f.call(`/v1/subjects/${subject}`,{token:student.token})).body;assert.equal(detail.items.length,0);assert.equal(detail.summary.total,0);
  assert.equal(f.app.db.prepare('SELECT output FROM submissions WHERE item_id=?').get(child).output,'Saved work');
  assert.equal(f.app.db.prepare('SELECT archived FROM items WHERE id=?').get(child).archived,1);
 }finally{await f.close();}
});

test('material creation rejects nested materials while activities and quizzes remain available',async()=>{
 const f=await fixture({materials:null});try{
  const teacher=await f.account('simple-teacher@example.test','instructor');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:teacher.token,body:{title:'Simple tree',description:'Materials with activities and quizzes'}})).body.id;
  const root=(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:teacher.token,body:{kind:'material',title:'Lesson',body:'References',published:true}})).body.id;
  for(const kind of ['material','examination'])assert.equal((await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:teacher.token,body:{kind,title:'Invalid child',body:'References',parent_id:root}})).status,400);
  for(const kind of ['activity','quiz'])assert.equal((await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:teacher.token,body:{kind,title:'Practice',body:'Instructions',parent_id:root,...(kind==='quiz'?{options:['A','B'],correct_index:0}:{})}})).status,201);
 }finally{await f.close();}
});

test('subject deletion is owner/admin-only, removes access and preserves learner records',async()=>{
 const f=await fixture({materials:null});try{
  const owner=await f.account('delete-owner@example.test','instructor'),other=await f.account('delete-other@example.test','instructor'),student=await f.account('delete-student@example.test','student');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:owner.token,body:{title:'Delete practice',description:'Keep learner history'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:student.id}});
  const item=(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind:'activity',title:'Practice',body:'Write your answer',published:true}})).body.id;
  await f.call(`/v1/items/${item}/submission`,{method:'POST',token:student.token,key:randomUUID(),body:{output:'Retained work'}});
  const submission=f.app.db.prepare('SELECT id FROM submissions WHERE item_id=?').get(item);
  assert.equal((await f.call(`/v1/submissions/${submission.id}/grade`,{method:'POST',token:owner.token,body:{score:88,feedback:'Retained feedback'}})).status,200);
  const detail=(await f.call(`/v1/subjects/${subject}`,{token:owner.token})).body;
  const body={confirm_delete:true,expected_title:detail.subject.title,expected_description:detail.subject.description,expected_order_revision:detail.subject.order_revision,expected_eligibility_revision:detail.subject.eligibility_revision,expected_items:detail.items.map(i=>({id:i.id,edit_version:i.edit_version}))};
  for(const token of [other.token,student.token])assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token,body})).status,404);
  assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:owner.token,body:{...body,confirm_delete:false}})).status,400);
  assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:owner.token,body})).status,200);
  assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:owner.token,body})).status,200,'Acknowledged deletion is idempotent');
  for(const token of [owner.token,f.admin,student.token]){
   assert.equal((await f.call(`/v1/subjects/${subject}`,{token})).status,404);
   assert.ok(!(await f.call('/v1/subjects',{token})).body.subjects.some(s=>s.id===subject));
   assert.equal((await f.call(`/v1/items/${item}`,{token})).status,404);
  }
  assert.equal((await f.call(`/v1/items/${item}/submission`,{method:'POST',token:student.token,key:randomUUID(),body:{output:'Denied'}})).status,404);
  assert.equal((await f.call(`/v1/subjects/${subject}/export`,{token:owner.token})).status,404);
  assert.equal((await f.call(`/v1/subjects/${subject}/enrol`,{method:'POST',token:student.token,body:{source:'self'}})).status,404);
  assert.deepEqual({...f.app.db.prepare('SELECT output,score,feedback FROM submissions WHERE item_id=?').get(item)},{output:'Retained work',score:88,feedback:'Retained feedback'});
  assert.equal(f.app.db.prepare('SELECT archived FROM items WHERE id=?').get(item).archived,0);
  assert.equal(f.app.db.prepare("SELECT count(*) n FROM audit WHERE action='subject-delete' AND target_id=?").get(subject).n,1);
 }finally{await f.close();}
});

test('subject deletion rejects stale snapshots, rolls back failure and allows administrator management',async()=>{
 const f=await fixture({materials:null});try{
  const owner=await f.account('delete-safe@example.test','instructor');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:owner.token,body:{title:'Snapshot subject',description:'Review before deleting'}})).body.id;
  const item=(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:owner.token,body:{kind:'material',title:'Lesson',body:'Notes'}})).body.id;
  const snapshot=async()=>{const d=(await f.call(`/v1/subjects/${subject}`,{token:owner.token})).body;return {confirm_delete:true,expected_title:d.subject.title,expected_description:d.subject.description,expected_order_revision:d.subject.order_revision,expected_eligibility_revision:d.subject.eligibility_revision,expected_items:d.items.map(i=>({id:i.id,edit_version:i.edit_version}))};};
  const old=await snapshot();
  await f.call(`/v1/items/${item}`,{method:'PATCH',token:owner.token,body:{body:'Updated notes',expected_edit_version:1}});
  assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:owner.token,body:old})).status,409);
  const fresh=await snapshot();
  for(const body of [{...fresh,expected_items:[]},{...fresh,expected_title:'Old title'},{...fresh,expected_order_revision:0},{...fresh,expected_eligibility_revision:0}])assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:owner.token,body})).status,409);
  f.app.db.exec("CREATE TRIGGER fail_subject_delete BEFORE INSERT ON audit WHEN NEW.action='subject-delete' BEGIN SELECT RAISE(ABORT,'Synthetic failure'); END;");
  assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:owner.token,body:fresh})).status,500);
  assert.equal(f.app.db.prepare('SELECT archived FROM subjects WHERE id=?').get(subject).archived,0);
  assert.equal((await f.call(`/v1/subjects/${subject}`,{token:owner.token})).body.subject.order_revision,fresh.expected_order_revision);
  f.app.db.exec('DROP TRIGGER fail_subject_delete;');
  assert.equal((await f.call(`/v1/subjects/${subject}/archive`,{method:'POST',token:f.admin,body:fresh})).status,200);
 }finally{await f.close();}
});

test('multi-question quiz scores all answers atomically, hides keys, validates revisions and exports totals',async()=>{
 const f=await fixture();try{
  const i=await f.account('quiz-teacher@example.test','instructor'),s=await f.account('quiz-student@example.test','student');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Multi quiz',description:'Synthetic'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:s.id}});
  const questions=Array.from({length:3},(_,n)=>({prompt:`Question ${n+1}`,options:['A','B','C'],correct_index:n}));
  const create=body=>f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:i.token,body:{kind:'quiz',title:'Three questions',body:'Instructions',published:true,...body}});
  for(const q of [[],Array(51).fill(questions[0]),[{...questions[0],correct_index:null}],[{...questions[0],options:['one']}],[{...questions[0],prompt:''}]])assert.equal((await create({questions:q})).status,400);
  const made=await create({questions});assert.equal(made.status,201);const id=made.body.id;
  const before=(await f.call(`/v1/items/${id}`,{token:s.token})).body.item;
  assert.equal(before.question_count,3);assert.ok(!JSON.stringify(before).includes('correct_index'));assert.deepEqual(before.options,[]);
  const owner=(await f.call(`/v1/items/${id}`,{token:i.token})).body.item;assert.equal(owner.questions[2].correct_index,2);
  assert.equal((await f.call(`/v1/items/${id}`,{method:'PATCH',token:i.token,body:{questions}})).status,400);
  const submit=(body,key=randomUUID())=>f.call(`/v1/items/${id}/quiz`,{method:'POST',token:s.token,key,body});
  assert.equal((await submit({choice:0})).status,409);
  for(const answers of [[0],[0,1,9],[0,1,null],[0,1,'2']])assert.equal((await submit({answers,expected_revision:1})).status,400);
  assert.equal((await submit({answers:[0,1,2],expected_revision:0})).status,409);
  const key=randomUUID(),result=await submit({answers:[0,1,0],expected_revision:1,score:3,correct_index:0},key);
  assert.equal(result.status,201);assert.equal(result.body.attempt.score,2);assert.equal(result.body.attempt.max_score,3);
  assert.equal((await submit({answers:[0,1,0],expected_revision:1},key)).body.attempt.id,result.body.attempt.id);
  assert.equal((await submit({answers:[0,1,2],expected_revision:1},key)).status,409);
  assert.equal((await submit({answers:[0,1,0],expected_revision:1})).status,409);
  const after=(await f.call(`/v1/items/${id}`,{token:s.token})).body.item;
  assert.equal(after.completed,true);assert.equal(after.attempt.max_score,3);assert.ok(!JSON.stringify(after).includes('correct_index'));
  const learner=(await f.call(`/v1/subjects/${subject}/learners/${s.id}`,{token:i.token})).body;
  assert.equal(learner.items[0].score,2);assert.equal(learner.items[0].max_score,3);assert.match(learner.items[0].answer,/Question 3: A/);
  const report=await f.call(`/v1/subjects/${subject}/export`,{token:i.token});assert.equal(report.status,200);assert.equal(report.body.subarray(0,2).toString(),'PK');
  // A failed audit cannot leave a hidden committed quiz attempt.
  const other=(await create({questions})).body.id;
  f.app.db.exec("CREATE TRIGGER quiz_audit_failure BEFORE INSERT ON audit WHEN NEW.action='quiz-submit' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  assert.equal((await f.call(`/v1/items/${other}/quiz`,{method:'POST',token:s.token,key:randomUUID(),body:{answers:[0,1,2],expected_revision:1}})).status,500);
  assert.equal(f.app.db.prepare('SELECT COUNT(*) n FROM attempts WHERE item_id=?').get(other).n,0);
 }finally{await f.close();}
});


test('activity grades commit atomically, return the saved version and reject stale regrading',async()=>{
 const f=await fixture();try{
  const i=await f.account('atomic-grade-i@example.test','instructor'),s=await f.account('atomic-grade-s@example.test','student');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Atomic grading',description:'Synthetic'}})).body.id;
  await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:s.id}});
  const item=(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:i.token,body:{kind:'activity',title:'Activity',body:'Explain your answer',published:true}})).body.id;
  await f.call(`/v1/items/${item}/submission`,{method:'POST',token:s.token,key:randomUUID(),body:{output:'Student response'}});
  const submission=f.app.db.prepare('SELECT * FROM submissions WHERE item_id=?').get(item);
  const grade=body=>f.call(`/v1/submissions/${submission.id}/grade`,{method:'POST',token:i.token,body});
  f.app.db.exec("CREATE TRIGGER grade_audit_failure BEFORE INSERT ON audit WHEN NEW.action='work-grade' BEGIN SELECT RAISE(ABORT,'synthetic audit outage'); END;");
  assert.equal((await grade({score:85,feedback:'Not committed',expected_graded_at:null})).status,500);
  assert.equal(f.app.db.prepare('SELECT score FROM submissions WHERE id=?').get(submission.id).score,null);
  f.app.db.exec('DROP TRIGGER grade_audit_failure');
  const saved=await grade({score:0,feedback:'  Review the instructions.  ',expected_graded_at:null});
  assert.equal(saved.status,200);assert.equal(saved.body.submission.score,0);assert.equal(saved.body.submission.feedback,'Review the instructions.');
  const stamp=saved.body.submission.graded_at;assert.ok(stamp);
  assert.equal((await grade({score:100,feedback:'Stale',expected_graded_at:null})).status,409);
  const updated=await grade({score:92.5,feedback:'Improved',expected_graded_at:stamp});
  assert.equal(updated.status,200);assert.ok(updated.body.submission.graded_at>stamp);
  const student=(await f.call(`/v1/items/${item}`,{token:s.token})).body.item;
  assert.equal(student.submission.score,92.5);assert.equal(student.submission.feedback,'Improved');
 }finally{await f.close();}
});

test('quiz score sheet uses dated columns, numeric counts, blank missing scores and current visible revisions',async()=>{
 const f=await fixture();try{
  const i=await f.account('matrix-i@example.test','instructor'),s=await f.account('matrix-s@example.test','student','2026-001'),o=await f.account('matrix-o@example.test','student','2026-002');
  const subject=(await f.call('/v1/subjects',{method:'POST',token:i.token,body:{title:'Score matrix',description:'Synthetic'}})).body.id;
  for(const student of [s,o])await f.call('/v1/admin/enrolments',{method:'POST',token:f.admin,body:{subject_id:subject,student_id:student.id}});
  const add=async(title,published=true)=>(await f.call(`/v1/subjects/${subject}/items`,{method:'POST',token:i.token,body:{kind:'quiz',title,body:'Instructions',published,questions:[0,1,2].map(n=>({prompt:`Question ${n+1}`,options:['A','B','C'],correct_index:n}))}})).body.id;
  const first=await add('Flight quiz'),zero=await add('Flight quiz'),missing=await add('Pending quiz'),hidden=await add('Hidden quiz',false),revised=await add('Revised quiz');
  f.app.db.prepare('UPDATE items SET created_at=? WHERE subject_id=?').run(Date.parse('2026-10-25T17:00:00Z'),subject);
  for(const [item,answers]of [[first,[0,1,0]],[zero,[1,2,0]],[revised,[0,1,2]]])assert.equal((await f.call(`/v1/items/${item}/quiz`,{method:'POST',token:s.token,key:randomUUID(),body:{answers,expected_revision:1}})).status,201);
  await f.call(`/v1/items/${revised}`,{method:'PATCH',token:i.token,body:{body:'New instructions require new work'}});
  const report=await f.call(`/v1/subjects/${subject}/export?timezone=Asia%2FManila`,{token:i.token});assert.equal(report.status,200);
  const {spawnSync}=await import('node:child_process');
  const decoded=spawnSync('python3',['-c',`import sys,io,zipfile,json,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
x=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
def value(c):
 v=c.find('s:v',n)
 return float(v.text) if v is not None else ''.join(c.itertext())
print(json.dumps([[value(c) for c in r] for r in x.findall('s:sheetData/s:row',n)]))`],{input:report.body});
  assert.equal(decoded.status,0,decoded.stderr?.toString());const rows=JSON.parse(decoded.stdout);
  assert.deepEqual(rows[0],['Student ID number','Name','2026-10-26 · Flight quiz','2026-10-26 · Flight quiz (2)','2026-10-26 · Pending quiz','2026-10-26 · Revised quiz']);
  assert.deepEqual(rows.find(row=>row[0]==='2026-001').slice(2),[2,0,'','']);
  assert.deepEqual(rows.find(row=>row[0]==='2026-002').slice(2),['','','','']);
  assert.equal((await f.call(`/v1/subjects/${subject}/export?timezone=invalid-zone`,{token:i.token})).status,400);
  assert.equal((await f.call(`/v1/subjects/${subject}/export`,{token:s.token})).status,404);
 }finally{await f.close();}
});
