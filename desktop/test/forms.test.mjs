import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { startLocal,AcademyBridge } from '../bridge.mjs';

test('canonical PC practice: all sixteen forms score forty selections, protect keys, retries and grades',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-forms-'));let local;
 try{
  local=await startLocal(directory);const bridge=new AcademyBridge(local);
  await bridge.login({username:'instructor',password:'instructor'});const subjects=(await bridge.request('/v1/subjects')).subjects;assert.equal(subjects.length,1);assert.match(subjects[0].title,/AE 101/);
  const subject=subjects[0],teacher=await bridge.request(`/v1/subjects/${subject.id}`);assert.equal(teacher.items.length,25);
  const forms=teacher.items.filter(item=>item.questions),keys=new Map(forms.map(item=>[item.id,item.questions.map(q=>q.correct_index)]));assert.equal(forms.length,16);assert.equal(forms.reduce((n,item)=>n+item.questions.length,0),40);
  assert.equal(forms.filter(i=>i.kind==='quiz').length,8);assert.equal(forms.filter(i=>i.assessment_type==='examination').length,4);
  await assert.rejects(bridge.request(`/v1/items/${forms[0].id}/answers`,{method:'POST',body:{answers:keys.get(forms[0].id),expected_revision:forms[0].revision},key:crypto.randomUUID()}),/Student/);
  await bridge.logout();await bridge.login({username:'student',password:'student'});
  const student=await bridge.request(`/v1/subjects/${subject.id}`);assert.ok(student.items.every(item=>!JSON.stringify(item).includes('correct_index')));
  const oldClient=await fetch(local.origin+`/v1/subjects/${subject.id}`,{headers:{Authorization:`Bearer ${bridge.token}`,'X-Academy-Desktop':local.accessKey}});assert.equal(oldClient.status,409);
  for(const form of forms){
   const path=`/v1/items/${form.id}/answers`,answers=keys.get(form.id),body={answers,expected_revision:form.revision,score:999},key=crypto.randomUUID();
   await assert.rejects(bridge.request(path,{method:'POST',body:{...body,answers:[]},key}),/Answer every/);
   await assert.rejects(bridge.request(path,{method:'POST',body:{...body,expected_revision:form.revision+1},key}),/changed/);
   const first=await bridge.request(path,{method:'POST',body,key});assert.equal(first.result.correct,answers.length);assert.equal(first.result.total,answers.length);assert.equal(first.result.score,100);
   assert.deepEqual((await bridge.request(path,{method:'POST',body,key})).result,first.result);
   await assert.rejects(bridge.request(path,{method:'POST',body:{...body,answers:answers.map(n=>(n+1)%4)},key}),/different|another/);
   await assert.rejects(bridge.request(path,{method:'POST',body,key:crypto.randomUUID()}),/already/);
   const saved=(await bridge.request(`/v1/items/${form.id}`)).item;assert.equal(saved.form_result.correct,answers.length);
  }
  const written=forms.find(item=>item.kind==='activity');await assert.rejects(bridge.request(`/v1/items/${written.id}/submission`,{method:'POST',body:{output:'Bypass'},key:crypto.randomUUID()}),/selection/);
  await bridge.logout();await bridge.login({username:'instructor',password:'instructor'});
  const roster=await bridge.request(`/v1/subjects/${subject.id}/learners`);assert.equal(roster.learners[0].summary.submitted,16);assert.equal(roster.learners[0].summary.graded,16);
  const report=await bridge.request(`/v1/subjects/${subject.id}/learners/${roster.learners[0].student.id}`),automatic=report.items.find(i=>i.response_mode==='choice');assert.equal(automatic.output,'');assert.ok(automatic.answer);
  await assert.rejects(bridge.request(`/v1/submissions/${automatic.submission_id}/grade`,{method:'POST',body:{score:0,feedback:'Overwrite',expected_graded_at:automatic.graded_at}}),/Automatic/);
  assert.equal((await bridge.exportReport(subject.id)).subarray(0,2).toString(),'PK');
 }finally{await local?.academy.close();await rm(directory,{recursive:true,force:true});}
});

test('PC v9 upgrade backs up, replaces only untouched factory content and retains historical work',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-upgrade-'));let local;
 try{
  local=await startLocal(directory,{legacyFixture:true});const bridge=new AcademyBridge(local);await bridge.login({username:'student',password:'student'});
  const subject=(await bridge.request('/v1/subjects')).subjects[0],course=await bridge.request(`/v1/subjects/${subject.id}`),activity=course.items.find(i=>i.kind==='activity');
  await bridge.request(`/v1/items/${activity.id}/submission`,{method:'POST',body:{output:'Preserve old written work'},key:crypto.randomUUID()});await local.academy.close();local=null;
  let db=new DatabaseSync(join(directory,'academy.sqlite'));db.exec('DROP INDEX IF EXISTS items_release; ALTER TABLE items DROP COLUMN publish_at; ALTER TABLE items DROP COLUMN due_at; DROP TABLE desktop_templates; DROP TABLE IF EXISTS security_limits; DROP INDEX IF EXISTS sessions_expiry; PRAGMA user_version=9;');db.close();
  local=await startLocal(directory);assert.equal(local.academy.db.prepare('SELECT count(*) n FROM items WHERE archived=0').get().n,25);assert.equal(local.academy.db.prepare('SELECT output FROM submissions').get().output,'Preserve old written work');assert.equal(local.academy.db.prepare('SELECT archived FROM items WHERE id=?').get(activity.id).archived,1);
  const backupPath=join(directory,'academy-before-pc-0.9.sqlite'),time=(await stat(backupPath)).mtimeMs;db=new DatabaseSync(backupPath,{readOnly:true});assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);assert.equal(db.prepare('SELECT output FROM submissions').get().output,'Preserve old written work');db.close();
  await local.academy.close();local=await startLocal(directory);assert.equal((await stat(backupPath)).mtimeMs,time);assert.equal(local.academy.db.prepare('SELECT count(*) n FROM items WHERE archived=0').get().n,25);
 }finally{await local?.academy.close();await rm(directory,{recursive:true,force:true});}
});

test('edited subjects survive practice installation and archived templates are never resurrected',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-preserve-'));let local;
 try{
  local=await startLocal(directory,{legacyFixture:true});local.academy.db.prepare("UPDATE subjects SET title='My edited subject'").run();await local.academy.close();local=await startLocal(directory);
  assert.equal(local.academy.db.prepare('SELECT count(*) n FROM subjects WHERE archived=0').get().n,2);assert.ok(local.academy.db.prepare("SELECT id FROM subjects WHERE title='My edited subject'").get());
  local.academy.db.prepare('UPDATE subjects SET archived=1 WHERE id=(SELECT subject_id FROM desktop_templates)').run();await local.academy.close();local=await startLocal(directory);assert.equal(local.academy.db.prepare('SELECT count(*) n FROM subjects WHERE archived=0').get().n,1);
 }finally{await local?.academy.close();await rm(directory,{recursive:true,force:true});}
});
