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
import { openDatabase } from './store.mjs';
import { ApiError, requireThat, text, email, password, hashPassword, verifyPassword, publicAccount, digest, token, canManage, MAX_FILE_BYTES, studentNumber } from './security.mjs';

export async function createAcademy({dbPath=':memory:',materials,bootstrap,clock=Date.now,scryptN=131072,sessionMs=8*60*60*1000}={}){
 const db=openDatabase(dbPath),now=()=>clock();
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const transaction=action=>{db.exec('BEGIN IMMEDIATE');try{const value=action();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 const audit=(actor,action,target)=>run('INSERT INTO audit(actor_id,action,target_id,created_at) VALUES(?,?,?,?)',actor,action,target,now());
 async function createAccount(data,role=data.role,mustChange=true,beforeCommit=()=>{}){
  requireThat(['admin','instructor','student'].includes(role),400,'Choose admin, instructor, or student.');
  const address=email(data.email),name=text(data.name,'name',100),number=data.student_number==null?null:studentNumber(data.student_number);
  requireThat(number===null||role==='student',400,'Student ID applies to student accounts only.');
  requireThat(number===null||!get('SELECT id FROM accounts WHERE student_number=?',number),409,'Student ID is already assigned.');
  requireThat(!get('SELECT id FROM accounts WHERE email=?',address),409,'An account already uses that email.');
  const hashed=await hashPassword(data.password,scryptN),id=randomUUID();beforeCommit();
  try{run('INSERT INTO accounts(id,email,name,role,password_hash,must_change_password,created_at,student_number) VALUES(?,?,?,?,?,?,?,?)',id,address,name,role,hashed,mustChange?1:0,now(),number);}
  catch(e){if(number&&get('SELECT id FROM accounts WHERE student_number=?',number))throw new ApiError(409,'Student ID is already assigned.');if(get('SELECT id FROM accounts WHERE email=?',address))throw new ApiError(409,'An account already uses that email.');throw e;}
  return publicAccount(get('SELECT * FROM accounts WHERE id=?',id));
 }
 if(!get('SELECT id FROM accounts LIMIT 1')&&bootstrap)await createAccount({...bootstrap,role:'admin'},'admin',false);
 const dummyHash=await hashPassword(token(),scryptN);
 const loginLimits=new Map();let activeUploads=0;
 function throttle(key){
  const current=now();for(const [k,v]of loginLimits)if(v.until<current)loginLimits.delete(k);
  if(loginLimits.size>5000)throw new ApiError(429,'Sign-in is busy. Try again later.');
  const entry=loginLimits.get(key)||{count:0,until:current+15*60*1000};entry.count++;loginLimits.set(key,entry);
  requireThat(entry.count<=10,429,'Too many sign-in attempts. Try again in 15 minutes.');
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
 function subjectFor(a,id,write=false){
  const subject=get('SELECT * FROM subjects WHERE id=? AND archived=0',id);requireThat(subject,404,'Subject unavailable.');
  if(write)requireThat(canManage(a,subject.owner_id),404,'Subject unavailable.');
  else requireThat(a.role==='admin'||a.role==='instructor'&&subject.owner_id===a.id||a.role==='student'&&get('SELECT 1 FROM enrolments WHERE student_id=? AND subject_id=?',a.id,id),404,'Subject unavailable.');
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
 function itemFor(a,id,write=false){
  const item=get('SELECT * FROM items WHERE id=? AND archived=0',id);requireThat(item,404,'Material or activity unavailable.');subjectFor(a,item.subject_id);
  if(write)requireThat(canManage(a,item.owner_id),403,'Only the creator or an administrator can edit this material.');
  else if(a.role==='student')requireThat(item.published,404,'Material or activity unavailable.');return item;
 }
 function presentItem(a,item){
  const copy={id:item.id,subject_id:item.subject_id,owner_id:item.owner_id,kind:item.kind,title:item.title,body:item.body,published:!!item.published,offline_allowed:!!item.offline_allowed,revision:item.revision,edit_version:item.edit_version,material_mode:item.material_mode,has_file:!!item.file_ref};
  if(item.kind==='quiz'){
   copy.options=JSON.parse(item.options_json);
   if(canManage(a,item.owner_id))copy.correct_index=item.correct_index;
   const attempt=get('SELECT id,revision,score,created_at FROM attempts WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision);
   if(attempt)copy.attempt=attempt;
  }
  const progress=get('SELECT completed,revision FROM progress WHERE student_id=? AND item_id=?',a.id,item.id);
  copy.assessment_type=item.assessment_type;
  if(item.kind==='activity')copy.submission=get('SELECT id,revision,output,score,feedback,submitted_at,graded_at FROM submissions WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision)||null;
  copy.completed=item.kind==='quiz'?!!copy.attempt:item.kind==='activity'?!!copy.submission:!!(progress?.completed&&progress.revision===item.revision);
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
   const result={id:item.id,title:item.title,kind:item.kind,assessment_type:item.assessment_type,revision:item.revision,completed:done,status:item.kind==='material'?(done?'Read (self-reported)':'Unread'):!done?'Not submitted':q||w?.score!=null?'Graded':'Awaiting assessment',score:q?q.score:w?.score??null,max_score:item.kind==='quiz'?1:item.kind==='activity'?100:null,feedback:w?.feedback||'',submission_id:w?.id||null,graded_at:w?.graded_at||null,submitted_at:q?.created_at||w?.submitted_at||null};
   if(detail){result.body=item.body;result.output=w?.output||'';if(q)result.answer=JSON.parse(item.options_json)[q.choice];}
   return result;
  });
  const pct=(n,d)=>d?Math.round(n*100/d):0;
  const summary={read,materials,read_percent:pct(read,materials),submitted,required,compliance_percent:pct(submitted,required),graded,awaiting_assessment:submitted-graded,completed:read+submitted,total:items.length,completion_percent:pct(read+submitted,items.length)};
  return {student:{id:student.id,name:student.name,email:student.email,status:student.status,student_number:student.student_number??null},summary,...(detail?{items:states}:{})};
 }
 const publishedItems=id=>all('SELECT * FROM items WHERE subject_id=? AND published=1 AND archived=0 ORDER BY created_at,id',id);
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
   if(path==='/health'&&method==='GET')return send(200,{status:'ok',version:'0.5.0-alpha.1'});
   if(['POST','PATCH'].includes(method)&&path!=='/v1/auth/logout'&&!/^\/v1\/items\/[a-f0-9-]{36}\/file$/.test(path))requireThat((req.headers['content-type']||'').startsWith('application/json'),415,'Send application/json.');
   const payload=(['POST','PATCH'].includes(method)&&(req.headers['content-type']||'').startsWith('application/json'))?await json(req):null;
   if(path==='/v1/auth/login'&&method==='POST'){
    const data=payload;throttle(String(req.socket.remoteAddress||'local')+':'+String(data.email||'').toLowerCase().slice(0,254));
    const address=email(data.email),a=get('SELECT * FROM accounts WHERE email=?',address);
    const valid=await verifyPassword(data.password,a?.password_hash||dummyHash);
    requireThat(a&&valid&&a.status==='active',401,'Email or password is incorrect, or this account is unavailable.');
    // Re-read after async hashing: suspension/deletion while hashing must win.
    const fresh=get('SELECT * FROM accounts WHERE id=?',a.id);requireThat(fresh.status==='active'&&fresh.password_hash===a.password_hash,401,'Account unavailable.');
    const raw=token();run('DELETE FROM sessions WHERE expires_at<=?',now());
    const old=all('SELECT token_hash FROM sessions WHERE account_id=? ORDER BY created_at DESC',a.id);for(const s of old.slice(4))run('DELETE FROM sessions WHERE token_hash=?',s.token_hash);
    run('INSERT INTO sessions VALUES(?,?,?,?,?)',digest(raw),a.id,now(),now(),now()+sessionMs);audit(a.id,'sign-in',a.id);
    return send(200,{token:raw,account:publicAccount(fresh)});
   }
   const a=authenticate(req);
   if(path==='/v1/me'&&method==='GET')return send(200,{account:publicAccount(a),capabilities:{external_links:true,material_upload:!!materials}});
   if(path==='/v1/auth/logout'&&method==='POST'){run('DELETE FROM sessions WHERE token_hash=?',a.token_hash);return send(200,{signed_out:true});}
   if(path==='/v1/auth/password'&&method==='POST'){
    const d=payload,current=get('SELECT * FROM accounts WHERE id=?',a.id);
    requireThat(await verifyPassword(d.current_password,current.password_hash),403,'Current password is incorrect.');
    const nextHash=await hashPassword(d.new_password,scryptN);authenticate(req);
    const fresh=get('SELECT * FROM accounts WHERE id=?',a.id);requireThat(fresh.status==='active'&&fresh.password_hash===current.password_hash,401,'Sign in again.');
    run('UPDATE accounts SET password_hash=?,must_change_password=0 WHERE id=?',nextHash,a.id);run('DELETE FROM sessions WHERE account_id=?',a.id);audit(a.id,'password-change',a.id);return send(200,{sign_in_again:true});
   }
   requireThat(!a.must_change_password,403,'Change your temporary password before continuing.');
   if(path==='/v1/admin/accounts'&&method==='GET'){admin(a);const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));return send(200,{accounts:all('SELECT * FROM accounts WHERE status<>? ORDER BY created_at DESC LIMIT 100 OFFSET ?','deleted',offset).map(publicAccount)});}
   if(path==='/v1/admin/audit'&&method==='GET'){admin(a);return send(200,{events:all('SELECT * FROM audit ORDER BY id DESC LIMIT 100')});}
   if(path==='/v1/admin/accounts'&&method==='POST'){admin(a);recent(a);const created=await createAccount(payload,undefined,true,()=>{const fresh=authenticate(req);admin(fresh);recent(fresh);});audit(a.id,'account-create',created.id);return send(201,{account:created});}
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
    run('UPDATE accounts SET password_hash=?,must_change_password=1 WHERE id=?',hashed,target.id);run('DELETE FROM sessions WHERE account_id=?',target.id);audit(a.id,'password-reset',target.id);return send(200,{reset:true});
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
    const subject=subjectFor(a,match[1],true);
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
    subjectFor(a,match[1],true);
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
    const details=[['Account ID','Name','Item ID','Title','Kind','Revision','Status','Score','Maximum score','Feedback','Submitted UTC','Student ID number']];
    for(const student of page.students){const view=learnerView(student,subject.id,page.items,true),m=view.summary;
     summary.push([student.id,student.name,student.email,student.status,m.read,m.materials,m.read_percent,m.submitted,m.required,m.compliance_percent,m.graded,m.awaiting_assessment,m.completed,m.total,m.completion_percent,student.student_number||'']);
     for(const i of view.items)details.push([student.id,student.name,i.id,i.title,i.assessment_type==='examination'?'examination':i.kind,i.revision,i.status,i.score??'',i.max_score??'',i.feedback,i.submitted_at?new Date(i.submitted_at).toISOString():'',student.student_number||'']);
    }
    const bytes=workbook([{name:'Summary',rows:summary},{name:'Assessments',rows:details},{name:'Report notes',rows:[['Field','Value'],['Subject',subject.title],['Subject ID',subject.id],['Generated UTC',new Date(now()).toISOString()],['Roster offset',offset],['Students in this file',page.students.length],['Total enrolled students',page.total],['Next offset',page.next_offset??'None'],['Scope','Current published item revisions; up to 100 enrolled students per export.'],['Reading','Student-reported reading; not evidence of comprehension.'],['Compliance','Submitted activities, written examinations and quizzes / required published assessments. No due dates are defined.'],['Completion','Read materials plus submitted assessments / published items. Not a pass or qualification.'],['Grades','Quiz 0–1; written work 0–100. No inferred pass/fail or weighted course grade.'],['Privacy','Confidential learner report. Keep in approved organization storage; exported files cannot be revoked.']]}]);
    audit(a.id,'gradebook-export',subject.id);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Length':bytes.length,'Content-Disposition':'attachment; filename="academy-progress.xlsx"'});res.end(bytes);return;
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/submission$/))&&method==='POST'){
    const item=itemFor(a,match[1]),d=payload;requireThat(a.role==='student'&&item.kind==='activity',403,'Student written submission required.');
    const output=text(d.output,'written output',12000),key=String(req.headers['idempotency-key']||'');requireThat(/^[a-f0-9-]{36}$/.test(key),400,'Provide a unique submission key.');
    const old=get('SELECT * FROM submissions WHERE student_id=? AND request_key=?',a.id,key);
    if(old){requireThat(old.item_id===item.id&&old.revision===item.revision&&old.output===output,409,'This submission key was used for different work.');return send(200,{submitted:true});}
    requireThat(!get('SELECT id FROM submissions WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision),409,'Work has already been submitted for this version.');
    run('INSERT INTO submissions(id,student_id,item_id,revision,output,submitted_at,request_key) VALUES(?,?,?,?,?,?,?)',randomUUID(),a.id,item.id,item.revision,output,now(),key);audit(a.id,'work-submit',item.id);return send(201,{submitted:true});
   }
   if((match=path.match(/^\/v1\/submissions\/([a-f0-9-]{36})\/grade$/))&&method==='POST'){
    const submission=get('SELECT * FROM submissions WHERE id=?',match[1]);requireThat(submission,404,'Submission unavailable.');
    const item=itemFor(a,submission.item_id);subjectFor(a,item.subject_id,true);requireThat(submission.revision===item.revision,409,'This work belongs to an older item revision.');
    requireThat(get("SELECT 1 FROM enrolments e JOIN accounts a ON a.id=e.student_id WHERE e.subject_id=? AND e.student_id=? AND a.status='active' AND a.role='student'",item.subject_id,submission.student_id),404,'Student is no longer enrolled.');
    const d=payload;requireThat(typeof d.score==='number'&&Number.isFinite(d.score)&&d.score>=0&&d.score<=100,400,'Score must be 0–100.');
    const feedback=d.feedback===''?'':text(d.feedback,'feedback',1000);
    requireThat((d.expected_graded_at??null)===submission.graded_at,409,'The assessment changed. Refresh before saving.');
    const gradedAt=Math.max(now(),(submission.graded_at||0)+1);
    run('UPDATE submissions SET score=?,feedback=?,grader_id=?,graded_at=? WHERE id=?',d.score,feedback,a.id,gradedAt,submission.id);audit(a.id,'work-grade',submission.id);return send(200,{graded:true});
   }
   if(path==='/v1/subjects'&&method==='GET'){
    const rows=a.role==='admin'?all('SELECT * FROM subjects WHERE archived=0 ORDER BY title LIMIT 200'):a.role==='instructor'?all('SELECT * FROM subjects WHERE archived=0 AND owner_id=? ORDER BY title LIMIT 200',a.id):all('SELECT s.* FROM subjects s JOIN enrolments e ON e.subject_id=s.id WHERE e.student_id=? AND s.archived=0 ORDER BY s.title LIMIT 200',a.id);
    return send(200,{subjects:rows.map(s=>a.role==='student'?{...s,summary:learnerView(a,s.id,publishedItems(s.id)).summary}:s)});
   }
   if(path==='/v1/subjects'&&method==='POST'){
    requireThat(a.role==='admin'||a.role==='instructor',403,'Instructor access required.');const d=payload,id=randomUUID();
    const owner=a.role==='admin'&&d.owner_id?d.owner_id:a.id;requireThat(get("SELECT id FROM accounts WHERE id=? AND role IN ('admin','instructor') AND status='active'",owner),400,'Choose an active subject owner.');
    run('INSERT INTO subjects(id,title,description,owner_id,created_at) VALUES(?,?,?,?,?)',id,text(d.title,'title',160),text(d.description,'description',1000),owner,now());audit(a.id,'subject-create',id);return send(201,{id});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})$/))&&method==='GET'){
    const subject=subjectFor(a,match[1]);const items=all('SELECT * FROM items WHERE subject_id=? AND archived=0 ORDER BY created_at,id LIMIT 200',subject.id).filter(i=>a.role!=='student'||i.published).map(i=>presentItem(a,i));
    return send(200,{subject,items,...(a.role==='student'?{summary:learnerView(a,subject.id,publishedItems(subject.id)).summary}:{})});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})$/))&&['PATCH','POST'].includes(method)){
    const old=subjectFor(a,match[1],true),d=payload;
    requireThat((d.expected_description===undefined||d.expected_description===old.description)&&(d.expected_title===undefined||d.expected_title===old.title),409,'Subject text changed. Refresh before saving.');
    requireThat(d.self_enrol===undefined||typeof d.self_enrol==='boolean',400,'Set self_enrol true or false.');
    transaction(()=>{run('UPDATE subjects SET title=?,description=?,self_enrol=? WHERE id=?',d.title===undefined?old.title:text(d.title,'title',160),d.description===undefined?old.description:text(d.description,'description',1000),d.self_enrol===undefined?old.self_enrol:d.self_enrol?1:0,match[1]);if(d.self_enrol!==undefined){run('UPDATE subjects SET eligibility_all=?,eligibility_revision=eligibility_revision+1 WHERE id=?',d.self_enrol?1:0,old.id);run('DELETE FROM eligible_students WHERE subject_id=?',old.id);if(!d.self_enrol)run("DELETE FROM enrolments WHERE subject_id=? AND source IN ('qr','self')",old.id);}audit(a.id,'subject-edit',match[1]);});return send(200,{saved:true});
   }
   if((match=path.match(/^\/v1\/subjects\/([a-f0-9-]{36})\/items$/))&&method==='POST'){
    subjectFor(a,match[1],true);requireThat(get('SELECT count(*) n FROM items WHERE subject_id=? AND archived=0',match[1]).n<200,409,'A subject can contain at most 200 current items.');const d=payload;const examination=d.kind==='examination';if(examination)d.kind='activity';requireThat(['material','activity','quiz'].includes(d.kind),400,'Choose material, activity, or quiz.');
    let options=null,answer=null;
    if(d.kind==='quiz'){
     requireThat(Array.isArray(d.options)&&d.options.length>=2&&d.options.length<=6,400,'Provide 2–6 answer choices.');options=JSON.stringify(d.options.map(o=>text(o,'choice',300)));
     requireThat(Number.isInteger(d.correct_index)&&d.correct_index>=0&&d.correct_index<d.options.length,400,'Choose the correct answer.');answer=d.correct_index;
    }
    const mode=d.material_mode??(materials?'file':'text');requireThat(['file','text'].includes(mode),400,'Choose text or file material mode.');
    requireThat(d.kind==='material'||d.material_mode===undefined,400,'Only materials have a material mode.');
    requireThat(d.kind!=='material'||mode!=='file'||materials,409,'File storage is disabled. Add material text and links instead.');
    requireThat(!('external_url'in d)&&!('link_type'in d),400,'Paste web links directly into material text.');
    requireThat(d.kind!=='material'||mode!=='text'||d.offline_allowed!==true,400,'External offline access is managed by the host platform.');
    const id=randomUUID();transaction(()=>{run('INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,offline_allowed,options_json,correct_index,created_at,material_mode,assessment_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,match[1],a.id,d.kind,text(d.title,'title',160),text(d.body,'instructions',12000),d.published===true?1:0,d.offline_allowed===true?1:0,options,answer,now(),d.kind==='material'?mode:'file',examination?'examination':'standard');audit(a.id,'item-create',id);});return send(201,{id});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})$/))&&method==='GET')return send(200,{item:presentItem(a,itemFor(a,match[1]))});
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})$/))&&['PATCH','POST'].includes(method)){
    const item=itemFor(a,match[1],true),d=payload;
    requireThat(d.expected_edit_version===undefined||d.expected_edit_version===item.edit_version,409,'This item changed. Refresh before editing.');
    // Ownership/kind/subject cannot be reassigned. Quiz answer changes require a new item.
    requireThat(!('owner_id'in d)&&!('subject_id'in d)&&!('correct_index'in d)&&!('kind'in d)&&!('assessment_type'in d),400,'Create a new item when changing ownership, subject, or quiz answers.');
    const title=d.title===undefined?item.title:text(d.title,'title',160),body=d.body===undefined?item.body:text(d.body,'instructions',12000);
    requireThat(!('material_mode'in d)&&!('external_url'in d)&&!('link_type'in d),400,'Paste links into text. Create a new item when changing material mode.');
    const changed=title!==item.title||body!==item.body;
    transaction(()=>{run('UPDATE items SET title=?,body=?,published=?,archived=?,revision=revision+?,edit_version=edit_version+1 WHERE id=?',title,body,d.published===undefined?item.published:d.published===true?1:0,d.archived===true?1:0,changed?1:0,item.id);audit(a.id,'item-edit',item.id);});return send(200,{saved:true});
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
    requireThat(typeof d.completed==='boolean',400,'Set completed true or false.');run('INSERT INTO progress VALUES(?,?,?,?,?) ON CONFLICT(student_id,item_id) DO UPDATE SET completed=excluded.completed,revision=excluded.revision,updated_at=excluded.updated_at',a.id,item.id,item.revision,d.completed?1:0,now());return send(200,{completed:d.completed});
   }
   if((match=path.match(/^\/v1\/items\/([a-f0-9-]{36})\/quiz$/))&&method==='POST'){
    const item=itemFor(a,match[1]);requireThat(a.role==='student'&&item.kind==='quiz',403,'Student quiz submission required.');const d=payload,key=String(req.headers['idempotency-key']||'');
    requireThat(/^[a-f0-9-]{36}$/.test(key),400,'Provide a unique submission key.');requireThat(Number.isInteger(d.choice)&&d.choice>=0&&d.choice<JSON.parse(item.options_json).length,400,'Choose one answer.');
    const repeated=get('SELECT id,item_id,revision,choice,score,created_at FROM attempts WHERE student_id=? AND request_key=?',a.id,key);
    if(repeated){requireThat(repeated.item_id===item.id&&repeated.revision===item.revision&&repeated.choice===d.choice,409,'Submission key was already used for another answer.');return send(200,{attempt:repeated});}
    requireThat(!get('SELECT id FROM attempts WHERE student_id=? AND item_id=? AND revision=?',a.id,item.id,item.revision),409,'This quiz has already been submitted.');
    const id=randomUUID(),score=d.choice===item.correct_index?1:0;run('INSERT INTO attempts VALUES(?,?,?,?,?,?,?,?)',id,a.id,item.id,item.revision,d.choice,score,key,now());audit(a.id,'quiz-submit',item.id);return send(201,{attempt:{id,revision:item.revision,score,created_at:now()}});
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
    if(url.searchParams.get('download')==='1')requireThat(canManage(a,item.owner_id)||item.offline_allowed,403,'Offline download is disabled for this material.');
    const stream=await materials.get(item.file_ref);try{const fresh=authenticate(req);itemFor(fresh,item.id);}catch(e){stream.destroy();throw e;}
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':String(item.file_bytes),'Content-Disposition':'inline; filename="academy-material.pdf"','X-Content-SHA256':item.file_sha256});
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
