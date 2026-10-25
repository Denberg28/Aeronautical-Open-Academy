import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/store.mjs';

test('v1 data migrates without changing identity, enrollment, file references or results; v4 reopens safely',()=>{
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
   db=openDatabase(path);assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
   assert.equal(db.prepare('SELECT self_enrol FROM subjects').get().self_enrol,0);
   assert.equal(db.prepare('SELECT file_ref FROM items').get().file_ref,'private-file');
   assert.equal(db.prepare('SELECT score FROM attempts').get().score,1);
   assert.equal(db.prepare('SELECT count(*) n FROM enrolments').get().n,1);
   assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();db=null;
  }
  db=new DatabaseSync(path);db.exec('PRAGMA user_version=99');db.close();db=null;assert.throws(()=>openDatabase(path),/newer than this server/);
 }finally{if(db)db.close();rmSync(dir,{recursive:true,force:true});}
});

test('published v2 database upgrades to v4 with prior enrollments, open courses and assessed work intact',()=>{
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
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
  assert.equal(db.prepare('SELECT eligibility_all FROM subjects').get().eligibility_all,1);
  assert.equal(db.prepare('SELECT source FROM enrolments').get().source,'legacy');
  assert.equal(db.prepare('SELECT student_number FROM accounts WHERE id=?').get('s').student_number,null);
  assert.equal(db.prepare('SELECT score FROM submissions').get().score,0);
  assert.equal(db.prepare('SELECT feedback FROM submissions').get().feedback,'Prior feedback');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(db)db.close();rmSync(dir,{recursive:true,force:true});}
});

test('published v3 upgrades to v4 without changing IDs, eligibility, file materials, or source authority',()=>{
 const dir=mkdtempSync(join(tmpdir(),'academy-v3-')),path=join(dir,'v3.sqlite');let db;
 try{
  db=new DatabaseSync(path);for(const resource of ['../src/schema.sql','./v2-schema.sql','./v3-schema.sql'])db.exec(readFileSync(new URL(resource,import.meta.url),'utf8'));
  db.exec(`INSERT INTO accounts(id,email,name,role,password_hash,created_at,student_number) VALUES('s','s@example.test','Student','student','fixture',1,'0001-X');
   INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@example.test','Teacher','instructor','fixture',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at,self_enrol) VALUES('subject','Subject A','Original','i',1,1);
   INSERT INTO eligible_students VALUES('subject','0001-X');INSERT INTO enrolments VALUES('subject','s','qr');
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,file_ref,edit_version) VALUES('pdf','subject','i','material','PDF','Original',1,1,'private-file',7);`);
  db.close();db=openDatabase(path);assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
  assert.equal(db.prepare('SELECT student_number FROM accounts WHERE id=?').get('s').student_number,'0001-X');
  assert.equal(db.prepare('SELECT student_number FROM eligible_students').get().student_number,'0001-X');assert.equal(db.prepare('SELECT source FROM enrolments').get().source,'qr');
  const item=db.prepare('SELECT * FROM items').get();assert.equal(item.material_mode,'file');assert.equal(item.file_ref,'private-file');assert.equal(item.edit_version,7);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(db)db.close();rmSync(dir,{recursive:true,force:true});}
});

test('published v4 upgrades to v5 preserving chronological order and reopening saved sequence',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-v4-order-'));const path=join(directory,'academy.sqlite');let db;
 try{
  db=new DatabaseSync(path);for(const resource of ['../src/schema.sql','./v2-schema.sql','./v3-schema.sql'])db.exec(readFileSync(new URL(resource,import.meta.url),'utf8'));
  db.exec(`ALTER TABLE items ADD COLUMN material_mode TEXT NOT NULL DEFAULT 'file';
   INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@test.example','Instructor','instructor','private-hash',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at) VALUES('s','Subject','Notes','i',1);
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,edit_version) VALUES('late','s','i','material','Later','Body',1,20,3),('early','s','i','material','Earlier','Body',1,10,4);
   PRAGMA user_version=4;`);db.close();db=openDatabase(path);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);assert.deepEqual(db.prepare('SELECT id FROM items ORDER BY sort_order').all().map(r=>r.id),['early','late']);assert.equal(db.prepare("SELECT edit_version FROM items WHERE id='early'").get().edit_version,4);
  db.prepare("UPDATE items SET sort_order=8 WHERE id='early'").run();db.close();db=openDatabase(path);assert.deepEqual(db.prepare('SELECT id FROM items ORDER BY sort_order').all().map(r=>r.id),['late','early']);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('published v5 upgrade preserves standalone entries, IDs and work without guessing material parents',()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-v5-tree-')),path=join(directory,'academy.sqlite');let db;
 try{
  db=new DatabaseSync(path);
  for(const resource of ['../src/schema.sql','./v2-schema.sql','./v3-schema.sql'])db.exec(readFileSync(new URL(resource,import.meta.url),'utf8'));
  db.exec(`ALTER TABLE items ADD COLUMN material_mode TEXT NOT NULL DEFAULT 'file';
   ALTER TABLE items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE subjects ADD COLUMN order_revision INTEGER NOT NULL DEFAULT 1;
   INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@test.example','Instructor','instructor','fixture',1),('s','s@test.example','Student','student','fixture',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at,order_revision) VALUES('subject','Subject','Notes','i',1,9);
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,edit_version,sort_order) VALUES('material','subject','i','material','Material','Body',1,1,4,0),('activity','subject','i','activity','Activity','Work',1,2,7,1);
   INSERT INTO submissions VALUES('work','s','activity',1,'Keep this answer',88,'Keep feedback','i',1,2,'key');
   PRAGMA user_version=5;`);
  db.close();db=openDatabase(path);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
  assert.deepEqual(db.prepare('SELECT id,parent_id,edit_version FROM items ORDER BY sort_order').all().map(x=>({...x})),[{id:'material',parent_id:null,edit_version:4},{id:'activity',parent_id:null,edit_version:7}]);
  assert.equal(db.prepare('SELECT order_revision FROM subjects').get().order_revision,9);
  assert.equal(db.prepare('SELECT output FROM submissions').get().output,'Keep this answer');
  db.prepare("UPDATE items SET parent_id='material' WHERE id='activity'").run();
  assert.throws(()=>db.prepare("UPDATE items SET parent_id='activity' WHERE id='material'").run(),/Invalid material parent/);
  db.close();db=openDatabase(path);assert.equal(db.prepare("SELECT parent_id FROM items WHERE id='activity'").get().parent_id,'material');
  assert.equal(db.prepare('SELECT score FROM submissions').get().score,88);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('schema-6 grouping upgrades and reopens without subsections without changing existing content or learning',()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-v6-sections-')),path=join(directory,'academy.sqlite');let db;
 try{
  db=openDatabase(path);
  db.exec(`INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@example.test','Teacher','instructor','fixture',1),('s','s@example.test','Student','student','fixture',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at,order_revision) VALUES('subject','Subject','Notes','i',1,4);
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,parent_id,edit_version) VALUES('root','subject','i','material','Root','Original',1,1,NULL,3),('child','subject','i','activity','Practice','Instructions',1,2,'root',2);
   INSERT INTO submissions VALUES('work','s','child',1,'Student work',93,'Feedback','i',1,2,'key');
   ALTER TABLE items DROP COLUMN questions_json; PRAGMA user_version=6;`);
  const before=JSON.stringify(db.prepare('SELECT * FROM items ORDER BY id').all());
  db.close();db=openDatabase(path);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM items ORDER BY id').all().map(({questions_json,...item})=>item)),before);
  assert.equal(db.prepare('SELECT score FROM submissions').get().score,93);
  assert.throws(()=>db.exec(`INSERT INTO items(id,subject_id,owner_id,kind,title,body,created_at,parent_id) VALUES('section','subject','i','material','Subsection','Reference',3,'root');`),/Invalid material parent/);
  assert.throws(()=>db.exec("UPDATE items SET parent_id='section' WHERE id='root'"),/Invalid material parent/);
  db.close();db=openDatabase(path);
  assert.equal(db.prepare("SELECT parent_id FROM items WHERE id='child'").get().parent_id,'root');
  assert.equal(db.prepare('SELECT output FROM submissions').get().output,'Student work');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('schema-7 subsections become root materials retaining learner work and effective visibility',()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-v7-remove-')),path=join(directory,'academy.sqlite');let db;
 try{
  db=openDatabase(path);
  // Reproduce the published v7 data shape. Its triggers are replaced by v8 on open.
  db.exec(`DROP TRIGGER items_tree_insert;DROP TRIGGER items_tree_update;
   CREATE TRIGGER items_tree_insert BEFORE INSERT ON items WHEN NEW.parent_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.assessment_type='examination' OR NEW.id=NEW.parent_id OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND (NEW.kind<>'material' OR p.parent_id IS NULL)); END;
   CREATE TRIGGER items_tree_update BEFORE UPDATE OF parent_id ON items WHEN NEW.parent_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.id=NEW.parent_id; END;
   INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@example.test','Teacher','instructor','fixture',1),('s','s@example.test','Student','student','fixture',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at,order_revision) VALUES('subject','Subject','Notes','i',1,9);
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,parent_id,sort_order,revision,edit_version) VALUES
     ('root','subject','i','material','Original root','Notes',0,1,NULL,0,2,3),
     ('section','subject','i','material','Keep links','https://docs.google.com/document/d/example/edit',1,2,'root',1,4,5),
     ('child','subject','i','activity','Practice','Instructions',1,3,'section',2,2,3),
     ('last','subject','i','material','Last material','Notes',1,4,NULL,3,1,1);
   INSERT INTO progress VALUES('s','section',4,1,1);
   INSERT INTO submissions VALUES('work','s','child',2,'Keep this answer',96,'Keep feedback','i',1,2,'key');
   ALTER TABLE items DROP COLUMN questions_json; PRAGMA user_version=7;`);
  db.close();db=openDatabase(path);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
  const material=db.prepare("SELECT * FROM items WHERE id='section'").get();
  assert.equal(material.parent_id,null);assert.equal(material.published,0);assert.equal(material.revision,4);assert.equal(material.edit_version,6);
  assert.equal(material.body,'https://docs.google.com/document/d/example/edit');
  assert.equal(db.prepare("SELECT parent_id FROM items WHERE id='child'").get().parent_id,'section');
  assert.equal(db.prepare('SELECT score FROM submissions').get().score,96);
  assert.equal(db.prepare('SELECT completed FROM progress').get().completed,1);
  assert.equal(db.prepare('SELECT order_revision FROM subjects').get().order_revision,10);
  assert.deepEqual(db.prepare('SELECT id FROM items ORDER BY sort_order').all().map(i=>i.id),['root','section','child','last']);
  assert.throws(()=>db.exec("UPDATE items SET parent_id='root' WHERE id='section'"),/Invalid material parent/);
  db.close();db=openDatabase(path);assert.equal(db.prepare('SELECT order_revision FROM subjects').get().order_revision,10);
  assert.equal(db.prepare('SELECT output FROM submissions').get().output,'Keep this answer');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('schema-8 quiz attempts retain IDs and one-point scores through schema-9 migration and reopen',()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-v8-quiz-')),path=join(directory,'academy.sqlite');let db;
 try{
  db=openDatabase(path);
  db.exec(`INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@example.test','Teacher','instructor','fixture',1),('s','s@example.test','Student','student','fixture',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at) VALUES('subject','Subject','Notes','i',1);
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,options_json,correct_index) VALUES('quiz','subject','i','quiz','Quiz','Legacy question',1,1,'["A","B"]',1);
   ALTER TABLE items DROP COLUMN questions_json;
   DROP TABLE attempts;
   CREATE TABLE attempts(id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES accounts(id),item_id TEXT NOT NULL REFERENCES items(id),revision INTEGER NOT NULL,choice INTEGER NOT NULL,score INTEGER NOT NULL CHECK(score IN (0,1)),request_key TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(student_id,item_id,revision),UNIQUE(student_id,request_key)) STRICT;
   INSERT INTO attempts VALUES('legacy-attempt','s','quiz',1,1,1,'legacy-key',12);
   PRAGMA user_version=8;`);
  db.close();db=openDatabase(path);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);
  const attempt=db.prepare('SELECT * FROM attempts').get();
  assert.equal(attempt.id,'legacy-attempt');assert.equal(attempt.score,1);assert.equal(attempt.max_score,1);assert.equal(attempt.request_key,'legacy-key');assert.equal(attempt.answers_json,null);
  assert.equal(db.prepare("SELECT correct_index FROM items WHERE id='quiz'").get().correct_index,1);
  db.exec(`INSERT INTO attempts VALUES('multi-attempt','s','quiz',2,0,2,'multi-key',13,'[0,1,0]',3);`);
  db.close();db=openDatabase(path);
  assert.equal(db.prepare("SELECT score FROM attempts WHERE id='multi-attempt'").get().score,2);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();rmSync(directory,{recursive:true,force:true});}
});
