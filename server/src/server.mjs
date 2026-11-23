import { released, scheduleFields, timing } from './schedule.mjs';
import { syncReceipt } from './access.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { linkFromText } from './links.mjs';
import { workbook } from './xlsx.mjs';
import { validateQuestions,quizQuestions,publicQuestions,gradeAnswers,MAX_QUIZ_QUESTIONS } from './quizzes.mjs';
import { openDatabase } from './store.mjs';
import { ApiError, requireThat, text, email, password, hashPassword, verifyPassword, publicAccount, digest, token, canManage, MAX_FILE_BYTES, studentNumber, accountName } from './security.mjs';

export async function createAcademy({dbPath=':memory:',materials,bootstrap,clock=Date.now,scryptN=131072,sessionMs=8*60*60*1000}={}){
 const db=openDatabase(dbPath),now=()=>clock();
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const transaction=action=>{db.exec('BEGIN IMMEDIATE');try{const value=action();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 const audit=(actor,action,target)=>run('INSERT INTO audit(actor_id,action,target_id,created_at) VALUES(?,?,?,?)',actor,action,target,now());
 async function createAccount(data,role=data.role,mustChange=true,beforeCommit=()=>{},actorId=null){
  const allowed=new Set(['name','email','role','password','student_number']);
  requireThat(Object.keys(data).every(k=>allowed.has(k)),400,'Unexpected field in account registration.');
  requireThat(['admin','instructor','student'].includes(role),400,'Choose admin, instructor, or student.');
  const address=email(data.email),name=accountName(data.name),number=data.student_number==null?null:studentNumber(data.student_number);
  requireThat(number===null||role==='student',400,'Student ID applies to student accounts only.');
  requireThat(number===null||!get('SELECT id FROM accounts WHERE student_number=?',number),409,'Student ID is already assigned.');
  requireThat(!get('SELECT id FROM accounts WHERE email=?',address),409,'An account already uses that email.');
  const hashed=await hashPassword(data.password,scryptN),id=randomUUID();beforeCommit();
  try{
   transaction(()=>{
    run('INSERT INTO accounts(id,email,name,role,password_hash,must_change_password,created_at,student_number) VALUES(?,?,?,?,?,?,?,?)',id,address,name,role,hashed,mustChange?1:0,now(),number);
    if(actorId)audit(actorId,'account-create',id);
   });
  }
  catch(e){if(number&&get('SELECT id FROM accounts WHERE student_number=?',number))throw new ApiError(409,'Student ID is already assigned.');if(get('SELECT id FROM accounts WHERE email=?',address))throw new ApiError(409,'An account already uses that email.');throw e;}
  return publicAccount(get('SELECT * FROM accounts WHERE id=?',id));
 }
 if(!get('SELECT id FROM accounts LIMIT 1')&&bootstrap)await createAccount({...bootstrap,role:'admin'},'admin',false);
 const dummyHash=await hashPassword(token(),scryptN);
 let activeUploads=0;
 function throttle(key,limit=10){
  const current=now();run('DELETE FROM security_limits WHERE expires_at<=?',current);
  const hash=digest(key),entry=get('SELECT * FROM security_limits WHERE key_hash=?',hash);
  requireThat(entry||get('SELECT count(*) n FROM security_limits').n<5000,429,'Sign-in is busy. Try again later.');
  requireThat(!entry||entry.hits<limit,429,'Too many authentication attempts. Try again in 15 minutes.');
  run('INSERT INTO security_limits VALUES(?,?,?) ON CONFLICT(key_hash) DO UPDATE SET hits=hits+1',hash,1,current+15*60*1000);
 }
 async function json(req){
  requireThat((req.headers['content-type']||'').startsWith('application/json'),415,'Send JSON with application/json.');
  let bytes=0;const chunks=[];
  for await(const chunk of req){bytes+=chunk.length;requireThat(bytes<=65536,413,'Request exceeds 64 KB.');chunks.push(chunk);}
  try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));requireThat(value&&typeof value==='object'&&!Array.isArray(value),400,'Expected a JSON object.');return value;}
  catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'Invalid JSON.');}
 }
 function authenticate(req){
  const raw=String(req.headers.authorization||'');requireThat(/^Bearer [A-Za-z0-9_-]{43}$/.test(raw),401,'Sign in to continue.');
  const hash=digest(raw.slice(7));const session=get('SELECT s.*,a.status,a.role,a.email,a.name,a.must_change_password,a.student_number,a.id FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=?',hash);
  requireThat(session&&session.status==='active'&&session.expires_at>now()&&session.last_seen>now()-30*60*1000,401,'Your session has ended. Sign in again.');
  run('UPDATE sessions SET last_seen=? WHERE token_hash=?',now(),hash);return session;
 }
 const admin=a=>requireThat(a.role==='admin',403,'Administrator access required.');
 const recent=a=>requireThat(a.created_at>now()-15*60*1000,401,'Sign in again before changing accounts.');
 // Access — Admin-managed instructor subject grants (active/suspended, read_only/editor); students default to reader with no downloads.
 function instructorAccess(a,subjectId){
  if(a.status!=='active')return {canRead:false,canEdit:false,accessLevel:null,status:null};
  if(a.role==='admin')return {canRead:true,canEdit:true,accessLevel:'admin',status:'active'};
  if(a.role==='instructor'){
   const grant=get('SELECT access_level,status FROM subject_instructors WHERE subject_id=? AND instructor_id=?',subjectId,a.id);
   if(!grant||grant.status!=='active')return {canRead:false,canEdit:false,accessLevel:grant?.access_level||null,status:grant?.status||null};
   return {canRead:true,canEdit:grant.access_level==='editor',accessLevel:grant.access_level,status:'active'};
  }
  return {canRead:false,canEdit:false,accessLevel:'reader',status:'active'};
 }
 function annotateSubject(a,subject){
  const folder_id=subject.folder_id??null;
  if(a.role==='admin')return {...subject,folder_id,access_level:'admin',can_edit:true,can_delete:true};
  if(a.role==='instructor'){
   const access=instructorAccess(a,subject.id);
   return {...subject,folder_id,access_level:access.accessLevel||'read_only',can_edit:access.canEdit,can_delete:access.canEdit&&subject.owner_id===a.id};
  }
  return {...subject,folder_id,access_level:'reader',can_edit:false,can_delete:false};
 }
 const MAX_FOLDERS=200,MAX_FOLDER_DEPTH=5;
 function allFolders(){
  return all('SELECT id,name,parent_id,sort_order,created_at,updated_at FROM subject_folders ORDER BY sort_order,name,id LIMIT 200');
 }
 function visibleFolders(a,subjects){
  const folders=allFolders();
  if(a.role==='admin')return folders;
  const byId=new Map(folders.map(f=>[f.id,f]));
  const keep=new Set();
  for(const s of subjects){
   let cur=s.folder_id;
   let guard=0;
   while(cur&&byId.has(cur)&&guard++<=MAX_FOLDERS){
    if(keep.has(cur))break;
    keep.add(cur);
    cur=byId.get(cur).parent_id;
   }
  }
  return folders.filter(f=>keep.has(f.id));
 }
 function folderDepth(byId,folderId){
  let depth=0,cur=folderId;
  const seen=new Set();
  while(cur){
   requireThat(!seen.has(cur),400,'Invalid folder hierarchy.');
   seen.add(cur);
   const node=byId.get(cur);
   requireThat(node,400,'Choose an existing parent folder.');
   cur=node.parent_id;
   depth++;
  }
  return depth;
 }
 function folderDescendants(folders,rootId){
  const out=new Set();
  const stack=[rootId];
  while(stack.length){
   const id=stack.pop();
   for(const f of folders)if(f.parent_id===id&&!out.has(f.id)){out.add(f.id);stack.push(f.id);}
  }
  return out;
 }
 function subtreeHeight(folders,rootId){
  let max=0;
  const stack=[[rootId,0]];
  while(stack.length){
   const [id,d]=stack.pop();
   if(d>max)max=d;
   for(const f of folders)if(f.parent_id===id)stack.push([f.id,d+1]);
  }
  return max;
 }
 function resequenceFolderSiblings(parentId,orderedIds){
  orderedIds.forEach((fid,index)=>run('UPDATE subject_folders SET sort_order=? WHERE id=?',index,fid));
 }
 function subjectFor(a,id,write=false){
  const subject=get('SELECT * FROM subjects WHERE id=? AND archived=0',id);requireThat(subject,404,'Subject unavailable.');
  if(a.role==='admin')return subject;
  if(a.role==='instructor'){
   const access=instructorAccess(a,subject.id);
   requireThat(access.canRead,404,'Subject unavailable.');
   if(write)requireThat(access.canEdit,403,'Read-only instructor access cannot modify this subject.');
   return subject;
  }
  requireThat(!write,404,'Subject unavailable.');
  requireThat(a.role==='student'&&get('SELECT 1 FROM enrolments WHERE student_id=? AND subject_id=?',a.id,id),404,'Subject unavailable.');
  return subject;
 }
 function eligible(a,subject){return !!subject.self_enrol&&(!!subject.eligibility_all||!!(a.student_number&&get('SELECT 1 FROM eligible_students WHERE subject_id=? AND student_number=?',subject.id,a.student_number)));}
 function forgetNumber(number,accountId){
  if(number){run('UPDATE subjects SET eligibility_revision=eligibility_revision+1 WHERE id IN (SELECT subject_id FROM eligible_students WHERE student_number=?)',number);run('DELETE FROM eligible_students WHERE student_number=?',number);}
  run("DELETE FROM enrolments WHERE student_id=? AND source IN ('qr','self')",accountId);
 }
 function enrollmentPolicy(subject){return {all_students:!!subject.eligibility_all,student_numbers:all('SELECT student_number FROM eligible_students WHERE subject_id=? ORDER BY student_number',subject.id).map(s=>s.student_number),revision:subject.eligibility_revision};}
 function savePolicy(a,subject,allStudents,numbers){
  transaction(()=>{
   run('UPDATE subjects SET eligibility_all=?,self_enrol=?,eligibility_revision=eligibility_revision+1 WHERE id=?',allStudents?1:0,allStudents||numbers.length?1:0,subject.id);
   run('DELETE FROM eligible_students WHERE subject_id=?',subject.id);
   for(const number of numbers)run('INSERT INTO eligible_students VALUES(?,?)',subject.id,number);
   run("DELETE FROM enrolments WHERE subject_id=? AND source IN ('qr','self') AND NOT EXISTS(SELECT 1 FROM accounts a JOIN subjects s ON s.id=? WHERE a.id=enrolments.student_id AND s.self_enrol=1 AND (s.eligibility_all=1 OR EXISTS(SELECT 1 FROM eligible_students e WHERE e.subject_id=s.id AND e.student_number=a.student_number)))",subject.id,subject.id);
   audit(a.id,'eligibility-edit',subject.id);
  });
 }
 function visibleToStudent(item){
  if(!released(item,now()))return false;
  if(!item.parent_id)return true;
  const parent=get("SELECT * FROM items WHERE id=?",item.parent_id);
  return !!parent&&parent.kind==='material'&&parent.subject_id===item.subject_id&&visibleToStudent(parent);
 }
 function orderedItems(subjectId){
  const rows=all('SELECT * FROM items WHERE subject_id=? AND archived=0 ORDER BY sort_order,created_at,id',subjectId);
  const children=new Map();
  for(const item of rows)if(item.parent_id){if(!children.has(item.parent_id))children.set(item.parent_id,[]);children.get(item.parent_id).push(item);}
  const visit=item=>[item,...(children.get(item.id)||[]).flatMap(visit)];
  return rows.filter(i=>!i.parent_id).flatMap(visit);
 }
 function descendants(id){
  return all(`WITH RECURSIVE tree AS (SELECT * FROM items WHERE parent_id=? AND archived=0 UNION ALL SELECT i.* FROM items i JOIN tree t ON i.parent_id=t.id WHERE i.archived=0) SELECT * FROM tree`,id);
 }
 function validateParent(a,parentId,subjectId,kind,examination){
  requireThat(parentId===null||typeof parentId==='string',400,'Choose a material in this subject.');
  if(parentId===null)return;
  requireThat(['activity','quiz'].includes(kind)&&!examination,400,'Only activities and quizzes belong inside a material. Examinations stay at subject level.');
  const parent=itemFor(a,parentId,false);
  requireThat(parent.subject_id===subjectId&&parent.kind==='material'&&!parent.parent_id,400,'Choose a material in this subject.');
 }

 function itemFor(a,id,write=false){
  const item=get('SELECT * FROM items WHERE id=? AND archived=0',id);requireThat(item,404,'Material or activity unavailable.');subjectFor(a,item.subject_id,false);
  if(write){
   if(a.role==='instructor')requireThat(instructorAccess(a,item.subject_id).canEdit,403,'Read-only instructor access cannot modify this material.');
   requireThat(canManage(a,item.owner_id),403,'Only the creator or an administrator can edit this material.');
  }
  else if(a.role==='student')requireThat(visibleToStudent(item),404,'Material or activity unavailable.');return item;
 }
 function presentItem(a,item,features=""){
  const editor=a.role==='admin'||(a.role==='instructor'&&instructorAccess(a,item.subject_id).canEdit);
  const manager=editor&&canManage(a,item.owner_id);
  const copy={parent_id:item.parent_id,id:item.id,subject_id:item.subject_id,owner_id:item.owner_id,kind:item.kind,title:item.title,body:item.body,published:!!item.published,offline_allowed:false,can_edit:manager,revision:item.revision,edit_version:item.edit_version,material_mode:item.material_mode,has_file:!!item.file_ref};
  if(item.kind==='quiz'){
   copy.questions=publicQuestions(item,manager);
   copy.question_count=copy.questions.length;
   copy.options=copy.questions.length===1?copy.questions[0].options:[];
   if(manager)copy.correct_index=item.correct_index;
   const attempt=get('SELECT id,revision,choice,score,max_score,answers_json,created_at FROM attempts WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision);
   if(attempt){copy.attempt=attempt;copy.form_result={answers:attempt.answers_json?JSON.parse(attempt.answers_json):[attempt.choice],correct:attempt.score,total:attempt.max_score,score:Math.round(attempt.score*10000/attempt.max_score)/100};}
  }
  if(item.kind==='activity'&&item.questions_json){
   requireThat(features.includes('choice-forms-v1'),409,'Update Aeronautical Academy Repository to open selection activities and examinations.');
   copy.response_mode='choice';copy.questions=publicQuestions(item,manager);copy.question_count=copy.questions.length;
   const submission=get('SELECT output,score FROM submissions WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision);
   if(submission)copy.form_result=JSON.parse(submission.output);
  }
  const progress=get('SELECT completed,revision,updated_at FROM progress WHERE student_id=? AND item_id=?',a.id,item.id);
  copy.assessment_type=item.assessment_type;
  if(item.kind==='activity')copy.submission=get('SELECT id,revision,output,score,feedback,submitted_at,graded_at FROM submissions WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision)||null;
  copy.completed=item.kind==='quiz'?!!copy.attempt:item.kind==='activity'?!!copy.submission:!!(progress?.completed&&progress.revision===item.revision);
  const completedAt=copy.completed?(item.kind==='material'?progress.updated_at:copy.attempt?.created_at??copy.submission?.submitted_at??copy.form_result?.submitted_at??null):null;
  Object.assign(copy,timing(item,now(),completedAt));
  return copy;
 }
 // Published current revisions form the denominator; self-reported reading is never a grade.
 function learnerView(student,subjectId,items,detail=false){
  const progress=new Map(all('SELECT p.* FROM progress p JOIN items i ON i.id=p.item_id WHERE i.subject_id=? AND p.student_id=?',subjectId,student.id).map(p=>[p.item_id,p]));
  const attempts=new Map(all('SELECT t.* FROM attempts t JOIN items i ON i.id=t.item_id WHERE i.subject_id=? AND t.student_id=? AND t.revision=i.revision',subjectId,student.id).map(t=>[t.item_id,t]));
  const submissions=new Map(all('SELECT t.* FROM submissions t JOIN items i ON i.id=t.item_id WHERE i.subject_id=? AND t.student_id=? AND t.revision=i.revision',subjectId,student.id).map(t=>[t.item_id,t]));
  let read=0,materials=0,submitted=0,required=0,graded=0;
  const states=items.map(item=>{
   const p=progress.get(item.id),q=attempts.get(item.id),w=submissions.get(item.id);
   const done=item.kind==='material'?!!(p?.completed&&p.revision===item.revision):item.kind==='quiz'?!!q:!!w;
   if(item.kind==='material'){materials++;if(done)read++;}else{required++;if(done)submitted++;if(q||w?.score!=null)graded++;}
   const result={id:item.id,title:item.title,kind:item.kind,assessment_type:item.assessment_type,revision:item.revision,completed:done,status:item.kind==='material'?(done?'Read (self-reported)':'Unread'):!done?'Not submitted':q||w?.score!=null?'Graded':'Awaiting assessment',score:q?q.score:w?.score??null,max_score:item.kind==='quiz'?(q?.max_score??quizQuestions(item).length):item.kind==='activity'?100:null,feedback:w?.feedback||'',submission_id:w?.id||null,graded_at:w?.graded_at||null,submitted_at:q?.created_at||w?.submitted_at||null};
   if(item.kind==='activity'&&item.questions_json){result.response_mode='choice';if(w){const form=JSON.parse(w.output);result.answer=quizQuestions(item).map((q,i)=>`${i+1}. ${q.prompt}: ${q.options[form.answers[i]]}`).join('\n');}}
   Object.assign(result,timing(item,now(),done?(item.kind==='material'?p.updated_at:q?.created_at??w?.submitted_at??null):null));
   if(detail){result.body=item.body;result.output=item.questions_json?'':w?.output||'';if(q){const answers=q.answers_json?JSON.parse(q.answers_json):[q.choice];const questions=quizQuestions(item);result.answer=questions.length===1?questions[0].options[answers[0]]:questions.map((question,i)=>`${i+1}. ${question.prompt}: ${question.options[answers[i]]}`).join('\n');}}
   return result;
  });
  const pct=(n,d)=>d?Math.round(n*100/d):0;
  const summary={overdue:states.filter(i=>i.due_state==='overdue').length,late:states.filter(i=>i.due_state==='late').length,read,materials,read_percent:pct(read,materials),submitted,required,compliance_percent:pct(submitted,required),graded,awaiting_assessment:submitted-graded,completed:read+submitted,total:items.length,completion_percent:pct(read+submitted,items.length)};
  return {student:{id:student.id,name:student.name,email:student.email,status:student.status,student_number:student.student_number??null},summary,...(detail?{items:states}:{})};
 }
 const publishedItems=id=>orderedItems(id).filter(visibleToStudent);
 function reportPage(subjectId,offset){
  const items=publishedItems(subjectId),total=get("SELECT count(*) n FROM enrolments e JOIN accounts a ON a.id=e.student_id WHERE e.subject_id=? AND a.role='student' AND a.status<>'deleted'",subjectId).n;
  const students=all("SELECT a.id,a.name,a.email,a.status,a.student_number FROM enrolments e JOIN accounts a ON a.id=e.student_id WHERE e.subject_id=? AND a.role='student' AND a.status<>'deleted' ORDER BY a.name,a.id LIMIT 100 OFFSET ?",subjectId,offset);
  return {items,students,total,offset,next_offset:offset+students.length<total?offset+students.length:null};
 }
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  function send(code,value){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
  try{
   const url=new URL(req.url,'http://localhost'),path=url.pathname,method=req.method;
   requireThat(req.url.length<2048,414,'Request URL is too long.');
   if(path==='/health'&&method==='GET')return send(200,{status:'ok',version:'0.11.0-rc.1'});
   if(['POST','PATCH'].includes(method)&&path!=='/v1/auth/logout'&&!/^\/v1\/items\/[a-f0-9-]{36}\/file$/.test(path))requireThat((req.headers['content-type']||'').startsWith('application/json'),415,'Send application/json.');
   const payload=(['POST','PATCH'].includes(method)&&(req.headers['content-type']||'').startsWith('application/json'))?await json(req):null;
   if(path==='/v1/auth/login'&&method==='POST'){
    const data=payload;throttle('login-peer:'+String(req.socket.remoteAddress||'local'),100);
    const address=email(data.email);throttle('login-account:'+address);const a=get('SELECT * FROM accounts WHERE email=?',address);
    const valid=await verifyPassword(data.password,a?.password_hash||dummyHash);
    requireThat(a&&valid&&a.status==='active',401,'Email or password is incorrect, or this account is unavailable.');
    // Re-read after async hashing: suspension/deletion while hashing must win.
    const fresh=get('SELECT * FROM accounts WHERE id=?',a.id);requireThat(fresh.status==='active'&&fresh.password_hash===a.password_hash,401,'Account unavailable.');
    const raw=token();run('DELETE FROM sessions WHERE expires_at<=?',now());
    const old=all('SELECT token_hash FROM sessions WHERE account_id=? ORDER BY created_at DESC',a.id);for(const s of old.slice(4))run('DELETE FROM sessions WHERE token_hash=?',s.token_hash);
    transaction(()=>{run('INSERT INTO sessions VALUES(?,?,?,?,?)',digest(raw),a.id,now(),now(),now()+sessionMs);audit(a.id,'sign-in',a.id);});
    return send(200,{token:raw,account:publicAccount(fresh)});
   }
   const a=authenticate(req);
   if(path==='/v1/me'&&method==='GET')return send(200,{account:publicAccount(a),capabilities:{sync:"refresh-v1",student_download:false,student_role_default:"reader",instructor_subject_access:"v1",subject_folders:"v1",global_sign_out:true,scheduling:"dates-v1",choice_forms:true,subject_tree:1,multi_question_quiz:1,max_quiz_questions:MAX_QUIZ_QUESTIONS,external_links:true,material_upload:!!materials}});
   if(path==='/v1/auth/logout'&&method==='POST'){run('DELETE FROM sessions WHERE token_hash=?',a.token_hash);return send(200,{signed_out:true});}
   if(path==='/v1/auth/logout-all'&&method==='POST'){
    transaction(()=>{run('DELETE FROM sessions WHERE account_id=?',a.id);audit(a.id,'sign-out-all',a.id);});
    return send(200,{signed_out:true,all_sessions:true});
   }
   if(path==='/v1/auth/password'&&method==='POST'){
    throttle('password-change:'+a.id);
    const d=payload,current=get('SELECT * FROM accounts WHERE id=?',a.id);
    requireThat(d.new_password!==d.current_password,400,'Choose a different password from the current or temporary password.');
    requireThat(await verifyPassword(d.current_password,current.password_hash),403,'Current password is incorrect.');
    const nextHash=await hashPassword(d.new_password,scryptN);authenticate(req);
    const fresh=get('SELECT * FROM accounts WHERE id=?',a.id);requireThat(fresh.status==='active'&&fresh.password_hash===current.password_hash,401,'Sign in again.');
    transaction(()=>{run('UPDATE accounts SET password_hash=?,must_change_password=0 WHERE id=?',nextHash,a.id);run('DELETE FROM sessions WHERE account_id=?',a.id);audit(a.id,'password-change',a.id);});return send(200,{sign_in_again:true});
   }
   requireThat(!a.must_change_password,403,'Change your temporary password before continuing.');
   if(path==='/v1/sync'&&method==='GET')return send(200,syncReceipt(a,now()));
   if(path==='/v1/admin/accounts'&&method==='GET'){admin(a);const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));return send(200,{accounts:all('SELECT * FROM accounts WHERE status<>? ORDER BY created_at DESC LIMIT 100 OFFSET ?','deleted',offset).map(publicAccount)});}
   if(path==='/v1/admin/audit'&&method==='GET'){admin(a);return send(200,{events:all('SELECT * FROM audit ORDER BY id DESC LIMIT 100')});}
   if(path==='/v1/admin/accounts'&&method==='POST'){admin(a);recent(a);throttle('account-create:'+a.id,30);const created=await createAccount(payload,undefined,true,()=>{const fresh=authenticate(req);admin(fresh);recent(fresh);},a.id);return send(201,{account:created});}
   let match;
   if((match=path.match(/^\/v1\/admin\/accounts\/([a-f0-9-]{36})$/))&&['PATCH','POST'].includes(method)){
    admin(a);recent(a);const d=payload,target=get('SELECT * FROM accounts WHERE id=? AND status<>?',match[1],'deleted');requireThat(target,404,'Account unavailable.');
    d.status=d.status??target.status;const nextRole=d.role??target.role;requireThat(['admin','instructor','student'].includes(nextRole),400,'Invalid role.');
    requireThat(['active','suspended','deleted'].includes(d.status),400,'Invalid account status.');
    requireThat(!(a.id===target.id&&(d.status!=='active'||nextRole!=='admin')),409,'Use another administrator account to change access for this account.');
    if(target.role==='admin'&&target.status==='active'&&(d.status!=='active'||nextRole!=='admin'))requireThat(get("SELECT count(*) n FROM accounts WHERE role='admin' AND status='active'").n>1,409,'At least one active administrator must remain.');
    const nextNumber=nextRole!=='student'||d.status==='deleted'?null:d.student_number===undefined?target.student_number:d.student_number===null?null:studentNumber(d.student_number);
    requireThat(d.student_number===undefined||nextRole==='student',400,'Student ID applies to student accounts only.');
    requireThat(nextNumber===null||!get('SELECT id FROM accounts WHERE student_number=? AND id<>?',nextNumber,target.id),409,'Student ID is already assigned.');
    transaction(()=>{
    if(nextNumber!==target.student_number)forgetNumber(target.student_number,target.id);
    if(d.status==='deleted'||nextRole!=='instructor')run('DELETE FROM subject_instructors WHERE instructor_id=?',target.id);
    run('UPDATE accounts SET student_number=? WHERE id=?',nextNumber,target.id);
    if(d.status==='deleted'){
     requireThat(d.confirm_email===target.email,400,'Confirm the exact email before account deletion.');
     run('UPDATE accounts SET status=?,email=?,name=?,password_hash=?,must_change_password=1 WHERE id=?','deleted',target.id+'@deleted.invalid','Deleted account','',target.id);
     run('DELETE FROM enrolments WHERE student_id=?',target.id);run('DELETE FROM enrolment_blocks WHERE student_id=?',target.id);run('DELETE FROM progress WHERE student_id=?',target.id);run('DELETE FROM attempts WHERE student_id=?',target.id);run('DELETE FROM submissions WHERE student_id=?',target.id);
    }else run('UPDATE accounts SET status=?,role=? WHERE id=?',d.status,nextRole,target.id);
    run('DELETE FROM sessions WHERE account_id=?',target.id);audit(a.id,'account-'+d.status,target.id);});return send(200,{status:d.status});
   }
   if((match=path.match(/^\/v1\/admin\/accounts\/([a-f0-9-]{36})\/password$/))&&method==='POST'){
    admin(a);recent(a);const d=payload,target=get("SELECT id FROM accounts WHERE id=? AND status<>'deleted'",match[1]);requireThat(target,404,'Account unavailable.');
    const hashed=await hashPassword(d.password,scryptN);const fresh=authenticate(req);admin(fresh);recent(fresh);requireThat(get("SELECT id FROM accounts WHERE id=? AND status<>'deleted'",target.id),404,'Account unavailable.');
    transaction(()=>{run('UPDATE accounts SET password_hash=?,must_change_password=1 WHERE id=?',hashed,target.id);run('DELETE FROM sessions WHERE account_id=?',target.id);audit(a.id,'password-reset',target.id);});return send(200,{reset:true});
   }
   // Admin — Per-subject instructor access control (read_only/editor and active/suspended).
   if((match=path.match(/^\/v1\/admin\/subjects\/([a-f0-9-]{36})\/instructors$/))&&['GET','POST'].includes(method)){
    admin(a);const subject=subjectFor(a,match[1]);
    if(method==='GET'){
     const rows=all("SELECT a.id instructor_id,a.name,a.email,a.status account_status,si.access_level,si.status access_status,si.updated_at FROM accounts a LEFT JOIN subject_instructors si ON si.subject_id=? AND si.instructor_id=a.id WHERE a.role='instructor' AND a.status<>'deleted' ORDER BY a.name,a.id LIMIT 200",subject.id);
     return send(200,{subject:{id:subject.id,title:subject.title,owner_id:subject.owner_id},instructors:rows.map(r=>({instructor_id:r.instructor_id,name:r.name,email:r.email,account_status:r.account_status,assigned:!!r.access_level,access_level:r.access_level||null,status:r.access_status||null,is_owner:r.instructor_id===subject.owner_id,updated_at:r.updated_at||null}))});
    }
    recent(a);const d=payload;
    const instructor=get("SELECT id,role,status FROM accounts WHERE id=? AND status<>'deleted'",d.instructor_id);
    requireThat(instructor&&instructor.role==='instructor',400,'Choose an instructor account.');
    if(d.remove===true){
     transaction(()=>{run('DELETE FROM subject_instructors WHERE subject_id=? AND instructor_id=?',subject.id,instructor.id);audit(a.id,'instructor-access-remove',subject.id);});
     return send(200,{saved:true,removed:true});
    }
    const level=d.access_level;const status=d.status??'active';
    requireThat(['read_only','editor'].includes(level),400,'Choose read_only or editor access.');
    requireThat(['active','suspended'].includes(status),400,'Choose active or suspended access status.');
    const ts=now();
    transaction(()=>{
     run('INSERT INTO subject_instructors(subject_id,instructor_id,access_level,status,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(subject_id,instructor_id) DO UPDATE SET access_level=excluded.access_level,status=excluded.status,updated_by=excluded.updated_by,updated_at=excluded.updated_at',subject.id,instructor.id,level,status,a.id,ts);
     audit(a.id,`instructor-access-${status}-${level}`,subject.id);
    });
    return send(200,{saved:true,access:{subject_id:subject.id,instructor_id:instructor.id,access_level:level,status,updated_at:ts}});
   }
   // Admin — Hierarchical subject folders in the left navigation pane.
   if(path==='/v1/admin/folders'&&method==='GET'){admin(a);return send(200,{folders:allFolders()});}
   if(path==='/v1/admin/folders'&&method==='POST'){
    admin(a);const d=payload;
    const name=text(d.name,'folder name',80);
    const parentId=d.parent_id==null||d.parent_id===''?null:String(d.parent_id);
    const existing=allFolders();
    requireThat(existing.length<MAX_FOLDERS,409,`You can create up to ${MAX_FOLDERS} folders.`);
    if(parentId!==null){
     const byId=new Map(existing.map(f=>[f.id,f]));
     requireThat(byId.has(parentId),400,'Choose an existing parent folder.');
     requireThat(folderDepth(byId,parentId)+1<=MAX_FOLDER_DEPTH,400,`Folders can nest up to ${MAX_FOLDER_DEPTH} levels deep.`);
    }
    const siblings=existing.filter(f=>(f.parent_id??null)===parentId);
    const id=randomUUID(),ts=now(),sortOrder=siblings.length;
    transaction(()=>{
     run('INSERT INTO subject_folders(id,name,parent_id,sort_order,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,name,parentId,sortOrder,a.id,ts,ts);
     audit(a.id,'folder-create',id);
    });
    return send(201,{folder:get('SELECT id,name,parent_id,sort_order,created_at,updated_at FROM subject_folders WHERE id=?',id),folders:allFolders()});
   }
   if((match=path.match(/^\/v1\/admin\/folders\/([a-f0-9-]{36})$/))&&method==='PATCH'){
    admin(a);const d=payload;
    const folders=allFolders(),byId=new Map(folders.map(f=>[f.id,f]));
    const folder=byId.get(match[1]);requireThat(folder,404,'Folder unavailable.');
    const name=d.name===undefined?folder.name:text(d.name,'folder name',80);
    let targetParent=d.parent_id===undefined?(folder.parent_id??null):(d.parent_id==null||d.parent_id===''?null:String(d.parent_id));
    const beforeId=d.before_id==null||d.before_id===''?null:String(d.before_id);
    const afterId=d.after_id==null||d.after_id===''?null:String(d.after_id);
    requireThat(!(beforeId&&afterId),400,'Specify either before_id or after_id, not both.');
    if(beforeId||afterId){
     const refId=beforeId||afterId;
     requireThat(refId!==folder.id,400,'Cannot position a folder relative to itself.');
     const ref=byId.get(refId);requireThat(ref,400,'Target folder unavailable.');
     if(d.parent_id===undefined)targetParent=ref.parent_id??null;
     else requireThat((ref.parent_id??null)===targetParent,400,'Target sibling belongs to a different parent folder.');
    }
    if(targetParent!==null){
     requireThat(targetParent!==folder.id,400,'A folder cannot be moved inside itself.');
     requireThat(byId.has(targetParent),400,'Choose an existing parent folder.');
     requireThat(!folderDescendants(folders,folder.id).has(targetParent),400,'A folder cannot be moved inside one of its own subfolders.');
     requireThat(folderDepth(byId,targetParent)+1+subtreeHeight(folders,folder.id)<=MAX_FOLDER_DEPTH,400,`Folders can nest up to ${MAX_FOLDER_DEPTH} levels deep.`);
    }
    const oldParent=folder.parent_id??null;
    const targetSiblings=folders.filter(f=>(f.parent_id??null)===targetParent&&f.id!==folder.id).map(f=>f.id);
    let insertAt;
    if(beforeId)insertAt=targetSiblings.indexOf(beforeId);
    else if(afterId)insertAt=targetSiblings.indexOf(afterId)+1;
    else if(Number.isInteger(d.sort_order))insertAt=Math.max(0,Math.min(targetSiblings.length,d.sort_order));
    else if(targetParent!==oldParent)insertAt=targetSiblings.length;
    else insertAt=folders.filter(f=>(f.parent_id??null)===oldParent).findIndex(f=>f.id===folder.id);
    if(insertAt<0)insertAt=targetSiblings.length;
    targetSiblings.splice(insertAt,0,folder.id);
    const ts=now();
    transaction(()=>{
     run('UPDATE subject_folders SET name=?,parent_id=?,updated_at=? WHERE id=?',name,targetParent,ts,folder.id);
     resequenceFolderSiblings(targetParent,targetSiblings);
     if(oldParent!==targetParent){
      const remainingOld=folders.filter(f=>(f.parent_id??null)===oldParent&&f.id!==folder.id).map(f=>f.id);
      resequenceFolderSiblings(oldParent,remainingOld);
     }
     audit(a.id,'folder-update',folder.id);
    });
    return send(200,{folder:get('SELECT id,name,parent_id,sort_order,created_at,updated_at FROM subject_folders WHERE id=?',folder.id),folders:allFolders()});
   }
   if((match=path.match(/^\/v1\/admin\/folders\/([a-f0-9-]{36})$/))&&method==='DELETE'){
    admin(a);
    const folder=get('SELECT * FROM subject_folders WHERE id=?',match[1]);requireThat(folder,404,'Folder unavailable.');
    const parentId=folder.parent_id??null,ts=now();
    transaction(()=>{
     run('UPDATE subjects SET folder_id=? WHERE folder_id=?',parentId,folder.id);
     run('UPDATE subject_folders SET parent_id=?,updated_at=? WHERE parent_id=?',parentId,ts,folder.id);
     run('DELETE FROM subject_folders WHERE id=?',folder.id);
     const siblings=all('SELECT id FROM subject_folders WHERE parent_id IS ? ORDER BY sort_order,name,id',parentId).map(r=>r.id);
     resequenceFolderSiblings(parentId,siblings);
     audit(a.id,'folder-delete',folder.id);
    });
    return send(200,{deleted:true,moved_to:parentId,folders:allFolders()});
   }
   if((match=path.match(/^\/v1\/admin\/subjects\/([a-f0-9-]{36})\/folder$/))&&method==='POST'){
    admin(a);
    const subject=subjectFor(a,match[1]);
    const folderId=payload.folder_id==null||payload.folder_id===''?null:String(payload.folder_id);
    if(folderId!==null)requireThat(get('SELECT id FROM subject_folders WHERE id=?',folderId),400,'Choose an existing folder.');
    transaction(()=>{
     run('UPDATE subjects SET folder_id=? WHERE id=?',folderId,subject.id);
     audit(a.id,'subject-folder',subject.id);
    });
    return send(200,{saved:true,subject_id:subject.id,folder_id:folderId});
   }
   if(path==='/v1/admin/enrolments'&&method==='POST'){
    admin(a);const d=payload;requireThat(get("SELECT 1 FROM accounts WHERE id=? AND role='student' AND status='active'",d.student_id),400,'Choose an active student.');subjectFor(a,d.subject_id);
    transaction(()=>{if(d.enrolled===false){run('DELETE FROM enrolments WHERE subject_id=? AND student_id=?',d.subject_id,d.student_id);run('INSERT OR IGNORE INTO enrolment_blocks VALUES(?,?)',d.subject_id,d.student_id);}
    else{run('DELETE FROM enrolment_blocks WHERE subject_id=? AND student_id=?',d.subject_id,d.student_id);run("INSERT INTO enrolments(subject_id,student_id,source) VALUES(?,?,'admin') ON CONFLICT(subject_id,student_id) DO UPDATE SET source='admin'",d.subject_id,d.student_id);}
    audit(a.id,d.enrolled===false?'unenrol':'enrol',d.student_id);});return send(200,{saved:true});
   }
   if(path==='/v1/announcements'&&method==='GET')return send(200,{announcements:all('SELECT id,title,body,created_at FROM announcements WHERE archived=0 ORDER BY created_at DESC LIMIT 30')});
   if(path==='/v1/announcements'&&method==='POST'){admin(a);const d=payload,id=randomUUID();run('INSERT INTO announcements(id,title,body,author_id,created_at) VALUES(?,?,?,?,?)',id,text(d.title,'title',160),text(d.body,'announcement',5000),a.id,now());audit(a.id,'announcement-create',id);return send(201,{id});}
   if((match=path.match(/^\/v1\/announcements\/([a-f0-9-]{36})$/))&&method==='DELETE'){admin(a);run('UPDATE announcements SET archived=1 WHERE id=?',match[1]);audit(a.id,'announcement-archive',match[1]);return send(200,{archived:true});}
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/eligibility$/))&&['GET','POST'].includes(method)){
    requireThat(a.role!=='student',404,'Subject unavailable.');
    const subject=subjectFor(a,match[1],method==='POST');
    if(method==='GET')return send(200,enrollmentPolicy(subject));
    const d=payload;requireThat(typeof d.all_students==='boolean'&&Array.isArray(d.student_numbers)&&d.student_numbers.length<=1000,400,'Choose all students or provide at most 1000 student IDs.');
    requireThat(d.expected_revision===subject.eligibility_revision,409,'Eligibility changed. Refresh before saving.');
    const numbers=[...new Set(d.student_numbers.map(studentNumber))];
    requireThat(!d.all_students||numbers.length===0,400,'Choose all students or a student ID list, not both.');
    savePolicy(a,subject,d.all_students,numbers);return send(200,enrollmentPolicy(subjectFor(a,subject.id,true)));
   }
   if(path==='/v1/subjects/discover'&&method==='GET'){
    requireThat(a.role==='student',403,'Student access required.');
    const offset=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0)));
    const subjects=all('SELECT s.id,s.title FROM subjects s WHERE s.archived=0 AND s.self_enrol=1 AND (s.eligibility_all=1 OR EXISTS(SELECT 1 FROM eligible_students e WHERE e.subject_id=s.id AND e.student_number=?)) AND NOT EXISTS(SELECT 1 FROM enrolment_blocks b WHERE b.subject_id=s.id AND b.student_id=?) AND NOT EXISTS(SELECT 1 FROM enrolments e WHERE e.subject_id=s.id AND e.student_id=?) ORDER BY s.title,s.id LIMIT 100 OFFSET ?',a.student_number,a.id,a.id,offset);
    return send(200,{subjects:subjects.map(s=>({...s,description:'Join to view subject text and resources.'}))});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/enrol$/))&&method==='POST'){
    requireThat(a.role==='student',403,'Student access required.');
    const subject=get('SELECT * FROM subjects WHERE id=? AND archived=0',match[1]);
    requireThat(subject&&!get('SELECT 1 FROM enrolment_blocks WHERE subject_id=? AND student_id=?',match[1],a.id),404,'Enrollment unavailable. Ask your instructor to check eligibility.');
    const existing=get('SELECT 1 FROM enrolments WHERE subject_id=? AND student_id=?',match[1],a.id);
    if(existing)return send(200,{enrolled:true,already_enrolled:true});
    requireThat(eligible(a,subject),404,'Enrollment unavailable. Ask your instructor to check your registered student ID or allow all students.');
    const source=payload.source==='qr'?'qr':'self';transaction(()=>{run('INSERT INTO enrolments(subject_id,student_id,source) VALUES(?,?,?)',match[1],a.id,source);audit(a.id,source+'-enrol',match[1]);});return send(200,{enrolled:true});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/learners(?:\/([a-f0-9-]{36}))?$/))&&method==='GET'){
    requireThat(a.role!=='student',404,'Subject unavailable.');
    subjectFor(a,match[1],false);
    if(match[2]){
     const student=get("SELECT a.id,a.name,a.email,a.status,a.student_number FROM accounts a JOIN enrolments e ON e.student_id=a.id WHERE a.id=? AND e.subject_id=? AND a.role='student' AND a.status<>'deleted'",match[2],match[1]);requireThat(student,404,'Enrolled student unavailable.');
     return send(200,learnerView(student,match[1],publishedItems(match[1]),true));
    }
    const offset=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0))),page=reportPage(match[1],offset);
    return send(200,{learners:page.students.map(s=>learnerView(s,match[1],page.items)),total:page.total,offset,next_offset:page.next_offset});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/export$/))&&method==='GET'){
    const subject=subjectFor(a,match[1],true),offset=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('offset'))||0))),page=reportPage(subject.id,offset);
    const summary=[['Account ID','Name','Email','Account status','Read','Reading items','Read percent (self-reported)','Submitted','Required assessments','Compliance percent','Graded','Awaiting assessment','Completed items','Total items','Completion percent','Student ID number']];
    const details=[['Account ID','Name','Item ID','Title','Kind','Revision','Status','Score','Maximum score','Feedback','Submitted UTC','Student ID number','Due UTC','Deadline status']];
    const timeZone=url.searchParams.get('timezone')||'UTC';
    let dateFormat;
    try{dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{requireThat(false,400,'Choose a valid report time zone.');}
    const quizzes=page.items.filter(item=>item.kind==='quiz'),usedHeaders=new Map();
    const quizHeaders=quizzes.map(item=>{
     const parts=Object.fromEntries(dateFormat.formatToParts(new Date(item.created_at)).map(part=>[part.type,part.value]));
     const label=`${parts.year}-${parts.month}-${parts.day} · ${item.title}`,count=(usedHeaders.get(label)||0)+1;
     usedHeaders.set(label,count);return count===1?label:label+` (${count})`;
    });
    const quizScores=[['Student ID number','Name',...quizHeaders]];
    for(const student of page.students){const view=learnerView(student,subject.id,page.items,true),m=view.summary;
     summary.push([student.id,student.name,student.email,student.status,m.read,m.materials,m.read_percent,m.submitted,m.required,m.compliance_percent,m.graded,m.awaiting_assessment,m.completed,m.total,m.completion_percent,student.student_number||'']);
     const scores=new Map(view.items.filter(item=>item.kind==='quiz').map(item=>[item.id,item.score]));
     quizScores.push([student.student_number||'',student.name,...quizzes.map(item=>scores.get(item.id)??'')]);
     for(const i of view.items)details.push([student.id,student.name,i.id,i.title,i.assessment_type==='examination'?'examination':i.kind,i.revision,i.status,i.score??'',i.max_score??'',i.feedback,i.submitted_at?new Date(i.submitted_at).toISOString():'',student.student_number||'',i.due_at?new Date(i.due_at).toISOString():'',i.due_state]);
    }
    const bytes=workbook([{name:'Quiz scores',rows:quizScores},{name:'Summary',rows:summary},{name:'Assessments',rows:details},{name:'Report notes',rows:[['Field','Value'],['Subject',subject.title],['Subject ID',subject.id],['Generated UTC',new Date(now()).toISOString()],['Quiz column dates', 'Quiz creation dates in '+timeZone+'; title identifies each quiz. Submission times are in Assessments.'],['Quiz scores','Numeric correct-answer counts only. Zero is a submitted score; blank means not submitted for the current revision.'],['Roster offset',offset],['Students in this file',page.students.length],['Total enrolled students',page.total],['Next offset',page.next_offset??'None'],['Scope','Current published item revisions; up to 100 enrolled students per export.'],['Reading','Student-reported reading; not evidence of comprehension.'],['Compliance','Submitted activities, written examinations and quizzes / required published assessments. Deadlines are advisory; late work is accepted and marked late without an automatic grade penalty.'],['Completion','Read materials plus submitted assessments / published items. Not a pass or qualification.'],['Grades','Quiz: correct answers / total questions; written work 0–100. No inferred pass/fail or weighted course grade.'],['Privacy','Confidential learner report. Keep in approved organization storage; exported files cannot be revoked.']]}]);
    audit(a.id,'gradebook-export',subject.id);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Length':bytes.length,'Content-Disposition':'attachment; filename="academy-progress.xlsx"'});res.end(bytes);return;
   }
   // Forms — trusted scoring, current revision and idempotent complete submissions.
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/answers$/))&&method==='POST'){
    const item=itemFor(a,match[1]);requireThat(a.role==='student',403,'Student submission required.');
    if(item.kind==='activity'){
     requireThat(item.questions_json,400,'This is written work, not a selection form.');requireThat(payload.expected_revision===item.revision,409,'This assessment changed. Refresh before submitting.');
     const key=String(req.headers['idempotency-key']||'');requireThat(/^[a-f0-9-]{36}$/.test(key),400,'Provide a unique submission key.');
     const graded=gradeAnswers(item,payload),result={answers:graded.answers,correct:graded.score,total:graded.max_score,score:Math.round(graded.score*10000/graded.max_score)/100},encoded=JSON.stringify(result);
     const previous=get('SELECT * FROM submissions WHERE student_id=? AND request_key=?',a.id,key);
     if(previous){requireThat(previous.item_id===item.id&&previous.revision===item.revision&&previous.output===encoded,409,'Submission key was used for different answers.');return send(200,{result:JSON.parse(previous.output)});}
     requireThat(!get('SELECT id FROM submissions WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision),409,'This assessment has already been submitted.');
     transaction(()=>{run('INSERT INTO submissions(id,student_id,item_id,revision,output,score,submitted_at,graded_at,request_key) VALUES(?,?,?,?,?,?,?,?,?)',randomUUID(),a.id,item.id,item.revision,encoded,result.score,now(),now(),key);audit(a.id,'form-submit',item.id);});return send(201,{result});
    }
    requireThat(item.kind==='quiz',400,'Choose an assessment.');requireThat(payload.expected_revision===item.revision,409,'This quiz changed. Refresh before submitting.');
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/submission$/))&&method==='POST'){
    const item=itemFor(a,match[1]),d=payload;requireThat(a.role==='student'&&item.kind==='activity',403,'Student written submission required.');
    requireThat(!item.questions_json,409,'Use this assessment’s selection form.');
    const output=text(d.output,'written output',12000),key=String(req.headers['idempotency-key']||'');requireThat(/^[a-f0-9-]{36}$/.test(key),400,'Provide a unique submission key.');
    const old=get('SELECT * FROM submissions WHERE student_id=? AND request_key=?',a.id,key);
    if(old){requireThat(old.item_id===item.id&&old.revision===item.revision&&old.output===output,409,'This submission key was used for different work.');return send(200,{submitted:true});}
    requireThat(!get('SELECT id FROM submissions WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision),409,'Work has already been submitted for this version.');
    run('INSERT INTO submissions(id,student_id,item_id,revision,output,submitted_at,request_key) VALUES(?,?,?,?,?,?,?)',randomUUID(),a.id,item.id,item.revision,output,now(),key);audit(a.id,'work-submit',item.id);return send(201,{submitted:true});
   }
   if((match=path.match(/^\/v1\/submissions\/([a-f0-9-]{36})\/grade$/))&&method==='POST'){
    const submission=get('SELECT * FROM submissions WHERE id=?',match[1]);requireThat(submission,404,'Submission unavailable.');
    const item=itemFor(a,submission.item_id);subjectFor(a,item.subject_id,true);requireThat(!item.questions_json,409,'Automatic scores cannot be manually changed.');requireThat(submission.revision===item.revision,409,'This work belongs to an older item revision.');
    requireThat(get("SELECT 1 FROM enrolments e JOIN accounts a ON a.id=e.student_id WHERE e.subject_id=? AND e.student_id=? AND a.status='active' AND a.role='student'",item.subject_id,submission.student_id),404,'Student is no longer enrolled.');
    const d=payload;requireThat(typeof d.score==='number'&&Number.isFinite(d.score)&&d.score>=0&&d.score<=100,400,'Score must be 0–100.');
    const feedback=d.feedback===''?'':text(d.feedback,'feedback',1000);
    requireThat((d.expected_graded_at??null)===submission.graded_at,409,'The assessment changed. Refresh before saving.');
    const gradedAt=Math.max(now(),(submission.graded_at||0)+1);
    transaction(()=>{run('UPDATE submissions SET score=?,feedback=?,grader_id=?,graded_at=? WHERE id=?',d.score,feedback,a.id,gradedAt,submission.id);audit(a.id,'work-grade',submission.id);});return send(200,{graded:true,submission:{id:submission.id,score:d.score,feedback,graded_at:gradedAt}});
   }
   if(path==='/v1/subjects'&&method==='GET'){
    const rows=a.role==='admin'?all('SELECT * FROM subjects WHERE archived=0 ORDER BY title LIMIT 200'):a.role==='instructor'?all("SELECT s.* FROM subjects s JOIN subject_instructors si ON si.subject_id=s.id WHERE s.archived=0 AND si.instructor_id=? AND si.status='active' ORDER BY s.title LIMIT 200",a.id):all('SELECT s.* FROM subjects s JOIN enrolments e ON e.subject_id=s.id WHERE e.student_id=? AND s.archived=0 ORDER BY s.title LIMIT 200',a.id);
    return send(200,{subjects:rows.map(s=>a.role==='student'?{...annotateSubject(a,s),summary:learnerView(a,s.id,publishedItems(s.id)).summary}:annotateSubject(a,s)),folders:visibleFolders(a,rows)});
   }
   if(path==='/v1/subjects'&&method==='POST'){
    requireThat(a.role==='admin'||a.role==='instructor',403,'Instructor access required.');const d=payload,id=randomUUID();
    const owner=a.role==='admin'&&d.owner_id?d.owner_id:a.id;const ownerAccount=get("SELECT id,role FROM accounts WHERE id=? AND role IN ('admin','instructor') AND status='active'",owner);requireThat(ownerAccount,400,'Choose an active subject owner.');
    const ts=now();
    transaction(()=>{
     run('INSERT INTO subjects(id,title,description,owner_id,created_at) VALUES(?,?,?,?,?)',id,text(d.title,'title',160),text(d.description,'description',1000),owner,ts);
     if(ownerAccount.role==='instructor')run("INSERT INTO subject_instructors(subject_id,instructor_id,access_level,status,updated_by,updated_at) VALUES(?,?,'editor','active',?,?)",id,owner,a.id,ts);
     audit(a.id,'subject-create',id);
    });return send(201,{id});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})$/))&&method==='GET'){
    const subject=subjectFor(a,match[1]);const items=orderedItems(subject.id).slice(0,200).filter(i=>a.role!=='student'||visibleToStudent(i)).map(i=>presentItem(a,i,String(req.headers['x-academy-features']||'')));
    return send(200,{subject:annotateSubject(a,subject),items,tree_version:1,quiz_version:1,choice_forms:true,...(a.role==='student'?{summary:learnerView(a,subject.id,publishedItems(subject.id)).summary}:{})});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})$/))&&['PATCH','POST'].includes(method)){
    const old=subjectFor(a,match[1],true),d=payload;
    requireThat((d.expected_description===undefined||d.expected_description===old.description)&&(d.expected_title===undefined||d.expected_title===old.title),409,'Subject text changed. Refresh before saving.');
    requireThat(d.self_enrol===undefined||typeof d.self_enrol==='boolean',400,'Set self_enrol true or false.');
    transaction(()=>{run('UPDATE subjects SET title=?,description=?,self_enrol=? WHERE id=?',d.title===undefined?old.title:text(d.title,'title',160),d.description===undefined?old.description:text(d.description,'description',1000),d.self_enrol===undefined?old.self_enrol:d.self_enrol?1:0,match[1]);if(d.self_enrol!==undefined){run('UPDATE subjects SET eligibility_all=?,eligibility_revision=eligibility_revision+1 WHERE id=?',d.self_enrol?1:0,old.id);run('DELETE FROM eligible_students WHERE subject_id=?',old.id);if(!d.self_enrol)run("DELETE FROM enrolments WHERE subject_id=? AND source IN ('qr','self')",old.id);}audit(a.id,'subject-edit',match[1]);});return send(200,{saved:true});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/archive$/))&&method==='POST'){
    const subject=get('SELECT * FROM subjects WHERE id=?',match[1]),d=payload;
    requireThat(subject,404,'Subject unavailable.');
    if(a.role==='instructor'){
     const access=instructorAccess(a,subject.id);
     requireThat(access.canRead&&subject.owner_id===a.id,404,'Subject unavailable.');
     requireThat(access.canEdit,403,'Read-only instructor access cannot delete this subject.');
    }else requireThat(a.role==='admin',404,'Subject unavailable.');
    requireThat(d.confirm_delete===true,400,'Confirm deleting this subject.');
    if(subject.archived)return send(200,{deleted:true});
    requireThat(d.expected_title===subject.title&&d.expected_description===subject.description&&d.expected_order_revision===subject.order_revision&&d.expected_eligibility_revision===subject.eligibility_revision,409,'This subject changed. Refresh and review it before deleting.');
    const items=all('SELECT id,edit_version FROM items WHERE subject_id=? AND archived=0',subject.id);
    requireThat(Array.isArray(d.expected_items)&&d.expected_items.length===items.length&&new Set(d.expected_items.map(i=>i?.id)).size===items.length&&items.every(item=>d.expected_items.some(expected=>expected?.id===item.id&&expected.edit_version===item.edit_version)),409,'Subject contents changed. Refresh and review them before deleting.');
    transaction(()=>{run('UPDATE subjects SET archived=1,order_revision=order_revision+1 WHERE id=?',subject.id);audit(a.id,'subject-delete',subject.id);});
    return send(200,{deleted:true});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/order$/))&&method==='POST'){
    const subject=subjectFor(a,match[1],true),d=payload;
    requireThat(Number.isInteger(d.expected_revision)&&d.expected_revision===subject.order_revision,409,'Entries changed. Refresh before moving them.');
    const current=all('SELECT id FROM items WHERE subject_id=? AND archived=0',subject.id).map(i=>i.id);
    requireThat(Array.isArray(d.item_ids)&&d.item_ids.length===current.length&&new Set(d.item_ids).size===current.length&&d.item_ids.every(id=>typeof id==='string'&&current.includes(id)),400,'Move the current entries of this subject only.');
    transaction(()=>{d.item_ids.forEach((id,index)=>run('UPDATE items SET sort_order=? WHERE id=?',index,id));run('UPDATE subjects SET order_revision=order_revision+1 WHERE id=?',subject.id);audit(a.id,'item-order',subject.id);});
    return send(200,{saved:true,revision:subject.order_revision+1});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/items$/))&&method==='POST'){
    subjectFor(a,match[1],true);requireThat(get('SELECT count(*) n FROM items WHERE subject_id=? AND archived=0',match[1]).n<200,409,'A subject can contain at most 200 current items.');const d=payload;const examination=d.kind==='examination';if(examination)d.kind='activity';requireThat(['material','activity','quiz'].includes(d.kind),400,'Choose material, activity, or quiz.');
    let options=null,answer=null,questions=null;
    if(d.kind==='quiz'){
     if(d.questions!==undefined){
      const normalized=validateQuestions(d.questions);questions=JSON.stringify(normalized);
      options=JSON.stringify(normalized[0].options);answer=normalized[0].correct_index;
     }else{
      requireThat(Array.isArray(d.options)&&d.options.length>=2&&d.options.length<=6,400,'Provide 2–6 answer choices.');options=JSON.stringify(d.options.map(o=>text(o,'choice',300)));
      requireThat(Number.isInteger(d.correct_index)&&d.correct_index>=0&&d.correct_index<d.options.length,400,'Choose the correct answer.');answer=d.correct_index;
     }
    }else if(d.kind==='activity'&&d.questions!==undefined){requireThat(Array.isArray(d.questions)&&d.questions.length>=1&&d.questions.length<=20,400,'Choose 1–20 activity or examination questions.');questions=JSON.stringify(validateQuestions(d.questions));}else requireThat(d.questions===undefined,400,'Materials cannot contain assessment questions.');
    requireThat(d.offline_allowed!==true,400,'Student material downloads are disabled.');
    const mode=d.material_mode??(materials?'file':'text');requireThat(['file','text'].includes(mode),400,'Choose text or file material mode.');
    requireThat(d.kind==='material'||d.material_mode===undefined,400,'Only materials have a material mode.');
    requireThat(d.kind!=='material'||mode!=='file'||materials,409,'File storage is disabled. Add material text and links instead.');
    requireThat(!('external_url'in d)&&!('link_type'in d),400,'Paste web links directly into material text.');
    requireThat(d.kind!=='material'||mode!=='text'||d.offline_allowed!==true,400,'External offline access is managed by the host platform.');
    const parentId=d.parent_id??null;validateParent(a,parentId,match[1],d.kind,examination);
    const id=randomUUID();transaction(()=>{run('INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,offline_allowed,options_json,correct_index,created_at,material_mode,assessment_type,parent_id,questions_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,match[1],a.id,d.kind,text(d.title,'title',160),text(d.body,'instructions',12000),d.published===true?1:0,d.offline_allowed===true?1:0,options,answer,now(),d.kind==='material'?mode:'file',examination?'examination':'standard',parentId,questions);run('UPDATE items SET sort_order=(SELECT COALESCE(MAX(sort_order),-1)+1 FROM items WHERE subject_id=? AND id<>?) WHERE id=?',match[1],id,id);run('UPDATE subjects SET order_revision=order_revision+1 WHERE id=?',match[1]);audit(a.id,'item-create',id);});return send(201,{id});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})$/))&&method==='GET')return send(200,{item:presentItem(a,itemFor(a,match[1]),String(req.headers['x-academy-features']||''))});
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})$/))&&['PATCH','POST'].includes(method)){
    const item=itemFor(a,match[1],true),d=payload;
    requireThat(d.expected_edit_version===undefined||d.expected_edit_version===item.edit_version,409,'This item changed. Refresh before editing.');
    // Ownership/kind/subject cannot be reassigned. Quiz answer changes require a new item.
    requireThat(!('owner_id'in d)&&!('subject_id'in d)&&!('correct_index'in d)&&!('questions'in d)&&!('options'in d)&&!('kind'in d)&&!('assessment_type'in d),400,'Create a new item when changing ownership, subject, or quiz answers.');
    const title=d.title===undefined?item.title:text(d.title,'title',160),body=d.body===undefined?item.body:text(d.body,'instructions',12000);
    requireThat(!('material_mode'in d)&&!('external_url'in d)&&!('link_type'in d),400,'Paste links into text. Create a new item when changing material mode.');
    const changed=title!==item.title||body!==item.body;
    const parentId='parent_id' in d?d.parent_id:item.parent_id;
    const moving=parentId!==item.parent_id;
    if(moving){
     requireThat(Number.isInteger(d.expected_edit_version)&&d.expected_edit_version===item.edit_version,409,'This entry changed. Refresh before moving it.');
     requireThat(Number.isInteger(d.expected_order_revision)&&d.expected_order_revision===subjectFor(a,item.subject_id,true).order_revision,409,'The subject tree changed. Refresh before moving it.');
     requireThat(['activity','quiz'].includes(item.kind)&&item.assessment_type!=='examination',400,'Only activities and quizzes can move into a material.');
     requireThat(parentId!==null,400,'Choose a material for this activity or quiz.');
     validateParent(a,parentId,item.subject_id,item.kind,false);
    }
    const children=item.kind==='material'&&d.archived===true?descendants(item.id):[];
    if(children.length){
     requireThat(d.archive_children===true,409,'This material contains activities or quizzes. Confirm removing the whole material group.');
     requireThat(d.expected_order_revision===subjectFor(a,item.subject_id,true).order_revision,409,'The material contents changed. Refresh before removing them.');
     requireThat(children.every(child=>canManage(a,child.owner_id)),403,'An administrator must remove entries created by another owner.');
    }
    transaction(()=>{
     run('UPDATE items SET title=?,body=?,published=?,archived=?,parent_id=?,revision=revision+?,edit_version=edit_version+1 WHERE id=?',title,body,d.published===undefined?item.published:d.published===true?1:0,d.archived===true?1:0,parentId,changed?1:0,item.id);
     if(moving)run('UPDATE items SET sort_order=(SELECT COALESCE(MAX(sort_order),-1)+1 FROM items WHERE subject_id=?) WHERE id=?',item.subject_id,item.id);
     for(const child of children)run('UPDATE items SET archived=1,edit_version=edit_version+1 WHERE id=?',child.id);
     if(d.archived===true||moving)run('UPDATE subjects SET order_revision=order_revision+1 WHERE id=?',item.subject_id);
     audit(a.id,'item-edit',item.id);
    });return send(200,{saved:true});
   }
   // Scheduling — One optimistic, audited write changes dates without invalidating submitted work.
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/schedule$/))&&method==='POST'){
    const item=itemFor(a,match[1],true),d=payload;
    requireThat(Number.isInteger(d.expected_edit_version)&&d.expected_edit_version===item.edit_version,409,'This entry changed. Reload before changing its schedule.');
    const dates=scheduleFields(d);
    requireThat(!dates.published||item.kind!=='material'||item.material_mode!=='file'||item.file_ref,409,'Upload the PDF before publishing or scheduling it.');
    transaction(()=>{run('UPDATE items SET publish_at=?,due_at=?,published=?,edit_version=edit_version+1 WHERE id=?',dates.publish_at,dates.due_at,dates.published,item.id);audit(a.id,'item-schedule',item.id);});
    return send(200,{saved:true,...timing({...item,...dates},now())});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/open-link$/))&&method==='POST'){
    const item=itemFor(a,match[1]);requireThat(Number.isInteger(payload.expected_revision)&&payload.expected_revision===item.revision,409,'This material changed. Refresh and review the link before opening it.');
    const destination=linkFromText(payload.url,item.body);return send(200,{url:destination,host:new URL(destination).hostname});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/open-link$/))&&method==='POST'){
    const subject=subjectFor(a,match[1]);requireThat(payload.expected_description===subject.description,409,'Subject text changed. Refresh and review the link before opening it.');
    const destination=linkFromText(payload.url,subject.description);return send(200,{url:destination,host:new URL(destination).hostname});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/complete$/))&&method==='POST'){
    const item=itemFor(a,match[1]);requireThat(a.role==='student',403,'Student access required.');requireThat(item.kind==='material',409,'Submit an answer or written output to record completion.');const d=payload;
    requireThat(typeof d.completed==='boolean',400,'Set completed true or false.');run('INSERT INTO progress VALUES(?,?,?,?,?) ON CONFLICT(student_id,item_id) DO UPDATE SET completed=excluded.completed,revision=excluded.revision,updated_at=CASE WHEN progress.completed=excluded.completed AND progress.revision=excluded.revision THEN progress.updated_at ELSE excluded.updated_at END',a.id,item.id,item.revision,d.completed?1:0,now());return send(200,{completed:d.completed});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/(?:quiz|answers)$/))&&method==='POST'){
    const item=itemFor(a,match[1]);requireThat(a.role==='student'&&item.kind==='quiz',403,'Student quiz submission required.');const d=payload,key=String(req.headers['idempotency-key']||'');
    requireThat(/^[a-f0-9-]{36}$/.test(key),400,'Provide a unique submission key.');
    const graded=gradeAnswers(item,d),encoded=JSON.stringify(graded.answers);
    const repeated=get('SELECT id,item_id,revision,choice,score,max_score,answers_json,created_at FROM attempts WHERE student_id=? AND request_key=?',a.id,key);
    if(repeated){requireThat(repeated.item_id===item.id&&repeated.revision===item.revision&&(repeated.answers_json??JSON.stringify([repeated.choice]))===encoded,409,'Submission key was already used for another answer.');return send(200,{attempt:{id:repeated.id,revision:repeated.revision,score:repeated.score,max_score:repeated.max_score,created_at:repeated.created_at},result:{answers:graded.answers,correct:repeated.score,total:repeated.max_score,score:Math.round(repeated.score*10000/repeated.max_score)/100}});}
    requireThat(!get('SELECT id FROM attempts WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision),409,'This quiz has already been submitted.');
    const id=randomUUID(),created=now();
    transaction(()=>{run('INSERT INTO attempts(id,student_id,item_id,revision,choice,score,request_key,created_at,answers_json,max_score) VALUES(?,?,?,?,?,?,?,?,?,?)',id,a.id,item.id,item.revision,graded.answers[0],graded.score,key,created,encoded,graded.max_score);audit(a.id,'quiz-submit',item.id);});
    return send(201,{attempt:{id,revision:item.revision,score:graded.score,max_score:graded.max_score,created_at:created},result:{answers:graded.answers,correct:graded.score,total:graded.max_score,score:Math.round(graded.score*10000/graded.max_score)/100}});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/file$/))&&method==='POST'){
    const item=itemFor(a,match[1],true);requireThat(item.kind==='material',400,'Choose a material item.');requireThat(item.material_mode==='file',409,'This is text/link material. Edit its text instead of uploading a copy.');requireThat(req.headers['x-item-version']===undefined||String(item.edit_version)===req.headers['x-item-version'],409,'This item changed. Refresh before uploading.');requireThat(materials,503,'Material storage is not configured.');requireThat((req.headers['content-type']||'').split(';')[0]==='application/pdf',415,'Upload a PDF.');
    requireThat(Number(req.headers['content-length']||0)<=MAX_FILE_BYTES,413,'PDF exceeds 50 MB.');requireThat(activeUploads<2,503,'Uploads are busy. Please try again shortly.');activeUploads++;let staging=null,stored=null;
    try{
     staging=await mkdtemp(join(tmpdir(),'academy-upload-'));
     const path=join(staging,'upload.pdf');let bytes=0;const limiter=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;done(bytes>MAX_FILE_BYTES?new ApiError(413,'PDF exceeds 50 MB.'):null,chunk);}});
     await pipeline(req,limiter,createWriteStream(path,{mode:0o600}));
     const data=await readFile(path);requireThat(data.subarray(0,5).toString()==='%PDF-'&&data.subarray(-1024).includes(Buffer.from('%%EOF')),400,'Upload a complete PDF, not a webpage.');
     // Revalidate authority after transfer, including account suspension and ownership changes.
     const fresh=authenticate(req);itemFor(fresh,item.id,true);stored=await materials.put(path,randomUUID(),bytes);
     const finalActor=authenticate(req),current=itemFor(finalActor,item.id,true);requireThat(current.edit_version===item.edit_version,409,'This item changed during upload. Refresh before uploading again.');
     transaction(()=>{run('UPDATE items SET file_ref=?,file_sha256=?,file_bytes=?,revision=revision+1,edit_version=edit_version+1 WHERE id=?',stored,digest(data),bytes,item.id);audit(a.id,'material-upload',item.id);});const result={saved:true,bytes};stored=null;return send(200,result);
    }finally{activeUploads--;if(stored)await materials.remove(stored);if(staging)await rm(staging,{recursive:true,force:true});}
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/content$/))&&method==='GET'){
    const item=itemFor(a,match[1]);requireThat(item.kind==='material'&&item.file_ref&&materials,404,'Material unavailable.');
    if(url.searchParams.has('download'))requireThat(a.role==='admin'||(a.role==='instructor'&&instructorAccess(a,item.subject_id).canEdit&&canManage(a,item.owner_id)),403,'Material downloads are disabled for students and read-only access.');
    const stream=await materials.get(item.file_ref);try{const fresh=authenticate(req);itemFor(fresh,item.id);}catch(e){stream.destroy();throw e;}
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':String(item.file_bytes),'Content-Disposition':'inline; filename="academy-material.pdf"','X-Content-SHA256':item.file_sha256,'X-Download-Options':'noopen','X-Robots-Tag':'noindex, nofollow'});
    let bytes=0;const limiter=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;done(bytes>MAX_FILE_BYTES?new ApiError(502,'Material size exceeded.'):null,chunk);}});await pipeline(stream,limiter,res);return;
   }
   throw new ApiError(404,'Action unavailable.');
  }catch(error){
   if(res.headersSent){res.destroy();return;}
   const status=error instanceof ApiError?error.status:500;
   if(status===500)console.error('academy request failed:',error.code||error.name||'Error');
   send(status,{error:status===500?'The request could not be completed. Please try again.':error.message});
  }
 });
 server.requestTimeout=150000;server.headersTimeout=15000;server.keepAliveTimeout=5000;server.maxHeadersCount=50;server.maxConnections=64;
 return {server,db,async close(){await new Promise(resolve=>server.listening?server.close(resolve):resolve());db.close();}};
}
