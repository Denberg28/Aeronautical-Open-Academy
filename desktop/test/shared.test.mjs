import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { AcademyBridge } from '../bridge.mjs';
import { responseBytes } from '../transport.mjs';

// Integration — CI may point this test at the separately maintained shared API checkout.
const apiRoot=resolve(process.env.ACADEMY_SHARED_API_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const {createAcademy}=await import(pathToFileURL(join(apiRoot,'server/src/server.mjs')));
const {LocalMaterials}=await import(pathToFileURL(join(apiRoot,'server/src/materials.mjs')));
test('organization sync, PDF upload/read and global logout work with the shared API',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-shared-'));
 const password='Synthetic organization test password!';
 const app=await createAcademy({dbPath:join(directory,'test.sqlite'),materials:new LocalMaterials(join(directory,'files')),
  bootstrap:{email:'admin@example.test',name:'Synthetic admin',password},scryptN:16384});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const fetcher=(url,options)=>fetch('http://127.0.0.1:'+app.server.address().port+new URL(url).pathname,options);
 const bridge=()=>new AcademyBridge({origin:'http://unused',accessKey:'never-forwarded'},{fetcher});
 const admin=bridge(),student=bridge(),other=bridge();
 const login=(client,email,pass=password)=>client.login({mode:'organization',origin:'https://academy.fixture.test',username:email,password:pass});
 try{
  await login(admin,'admin@example.test');
  const learner=await admin.request('/v1/admin/accounts',{method:'POST',body:{email:'learner@example.test',name:'Synthetic learner',role:'student',password}});
  await login(student,'learner@example.test');
  await student.request('/v1/auth/password',{method:'POST',body:{current_password:password,new_password:password+'changed'}});
  await login(student,'learner@example.test',password+'changed');await login(other,'learner@example.test',password+'changed');
  const {id}=await admin.request('/v1/subjects',{method:'POST',body:{title:'Shared clients',description:'Synthetic'}});
  await admin.request('/v1/admin/enrolments',{method:'POST',body:{subject_id:id,student_id:learner.account.id}});
  const created=await admin.request(`/v1/subjects/${id}/items`,{method:'POST',body:{kind:'material',material_mode:'file',title:'Protected PDF',body:'Read inside Academy'}});
  let item=(await admin.request(`/v1/items/${created.id}`)).item;
  const bytes=await readFile(new URL('../../app/src/main/assets/materials/a-learning-guide.pdf',import.meta.url));
  await admin.uploadMaterial(item.id,item.edit_version,bytes);
  item=(await admin.request(`/v1/items/${item.id}`)).item;
  await admin.request(`/v1/items/${item.id}`,{method:'POST',body:{published:true,expected_edit_version:item.edit_version}});
  const pdf=await student.readMaterial(item.id,item.revision);
  assert.deepEqual(Buffer.from(pdf.data,'base64'),bytes);assert.equal(pdf.token,undefined);
  await assert.rejects(student.request(`/v1/items/${item.id}/content`),/dedicated/);
  await assert.rejects(student.uploadMaterial(item.id,item.edit_version,bytes));
  await student.request(`/v1/items/${item.id}/complete`,{method:'POST',body:{completed:true}});
  const receipt=await other.sync();assert.equal(receipt.protocol,'academy-sync-v1');assert.equal(receipt.capabilities.student_download,false);
  assert.equal((await other.request(`/v1/subjects/${id}`)).summary.read,1);
  const quiz=await admin.request(`/v1/subjects/${id}/items`,{method:'POST',body:{kind:'quiz',title:'Shared form',body:'Choose both answers',published:true,
   questions:[{prompt:'First?',options:['A','B'],correct_index:0},{prompt:'Second?',options:['C','D'],correct_index:1}]}});
  const current=(await student.request(`/v1/items/${quiz.id}`)).item;
  const route=receipt.capabilities.multi_question_quiz?'quiz':'answers';
  const graded=await student.request(`/v1/items/${quiz.id}/${route}`,{method:'POST',body:{answers:[0,1],expected_revision:current.revision},key:randomUUID()});
  assert.equal(graded.result?.correct??graded.attempt?.score,2);
  await student.request('/v1/auth/logout-all',{method:'POST',body:{}});
  await assert.rejects(other.sync(),error=>error.status===401);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});

test('bounded responses and session switches reject stale private data',async()=>{
 await assert.rejects(responseBytes(new Response('small',{headers:{'Content-Length':'99999999'}}),100),/too large/);
 let release;const waiting=new Promise(resolve=>release=resolve);
 const bridge=new AcademyBridge({origin:'http://unused',accessKey:'private'},{fetcher:async(url)=>{
   if(url.endsWith('/v1/me'))await waiting;
   return new Response(JSON.stringify(url.endsWith('/login')?{token:'synthetic',account:{id:'one',role:'student'}}:{account:{id:'one'}}));
 }});
 await bridge.login({mode:'organization',origin:'https://academy.fixture.test',username:'one@example.test',password:'synthetic'});
 const pending=bridge.request('/v1/me');await bridge.logout();release();
 await assert.rejects(pending,error=>error.status===401);
 assert.equal(bridge.token,'');
});
