import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/store.mjs';

test('v1 data migrates without changing identity, enrollment, file references or results; v3 reopens safely',()=>{
 const dir=mkdtempSync(join(tmpdir(),'academy-migration-')),path=join(dir,'v1.sqlite');let db;
 try{
  db=new DatabaseSync(path);db.exec(readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8'));
  db.exec(`INSERT INTO accounts VALUES('student','s@example.test','Student','student','active','fixture',0,1);
   INSERT INTO accounts VALUES('teacher','t@example.test','Teacher','instructor','active','fixture',0,1);
   INSERT INTO subjects VALUES('subject','Subject A','Sample','teacher',1,0);
   INSERT INTO enrolments VALUES('subject','student');
   INSERT INTO items VALUES('item','subject','teacher','quiz','Quiz','Question',1,0,'["A","B"]',1,1,'private-file','sha',12,1,0);
   INSERT INTO attempts VALUES('attempt','student','item',1,1,1,'request',1);
   INSERT INTO progress VALUES('student','item',1,1,1);PRAGMA user_version=1;`);db.close();db=null;
  for(let n=0;n<2;n++){
   db=openDatabase(path);assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);
   assert.equal(db.prepare('SELECT self_enrol FROM subjects').get().self_enrol,0);
   assert.equal(db.prepare('SELECT file_ref FROM items').get().file_ref,'private-file');
   assert.equal(db.prepare('SELECT score FROM attempts').get().score,1);
   assert.equal(db.prepare('SELECT count(*) n FROM enrolments').get().n,1);
   assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();db=null;
  }
  db=new DatabaseSync(path);db.exec('PRAGMA user_version=99');db.close();db=null;assert.throws(()=>openDatabase(path),/newer than this server/);
 }finally{if(db)db.close();rmSync(dir,{recursive:true,force:true});}
});

test('published v2 database upgrades to v3 with prior enrollments, open courses and assessed work intact',()=>{
 const dir=mkdtempSync(join(tmpdir(),'academy-v2-')),path=join(dir,'v2.sqlite');let db;
 try{
  db=new DatabaseSync(path);db.exec(readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('./v2-schema.sql',import.meta.url),'utf8'));
  db.exec(`INSERT INTO accounts VALUES('s','s@example.test','Student','student','active','fixture',0,1);
   INSERT INTO accounts VALUES('i','i@example.test','Teacher','instructor','active','fixture',0,1);
   INSERT INTO subjects(id,title,description,owner_id,created_at,self_enrol) VALUES('subject','Subject A','Sample','i',1,1);
   INSERT INTO enrolments VALUES('subject','s');
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at) VALUES('work','subject','i','activity','Activity','Write',1,1);
   INSERT INTO submissions VALUES('output','s','work',1,'Prior output',0,'Prior feedback','i',1,2,'request');`);
  db.close();db=openDatabase(path);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);
  assert.equal(db.prepare('SELECT eligibility_all FROM subjects').get().eligibility_all,1);
  assert.equal(db.prepare('SELECT source FROM enrolments').get().source,'legacy');
  assert.equal(db.prepare('SELECT student_number FROM accounts WHERE id=?').get('s').student_number,null);
  assert.equal(db.prepare('SELECT score FROM submissions').get().score,0);
  assert.equal(db.prepare('SELECT feedback FROM submissions').get().feedback,'Prior feedback');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(db)db.close();rmSync(dir,{recursive:true,force:true});}
});
