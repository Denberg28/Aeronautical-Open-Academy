import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/store.mjs';

test('v1 data migrates without changing identity, enrollment, file references or results; v2 reopens safely',()=>{
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
   db=openDatabase(path);assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);
   assert.equal(db.prepare('SELECT self_enrol FROM subjects').get().self_enrol,0);
   assert.equal(db.prepare('SELECT file_ref FROM items').get().file_ref,'private-file');
   assert.equal(db.prepare('SELECT score FROM attempts').get().score,1);
   assert.equal(db.prepare('SELECT count(*) n FROM enrolments').get().n,1);
   assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();db=null;
  }
  db=new DatabaseSync(path);db.exec('PRAGMA user_version=99');db.close();db=null;assert.throws(()=>openDatabase(path),/newer than this server/);
 }finally{if(db)db.close();rmSync(dir,{recursive:true,force:true});}
});
