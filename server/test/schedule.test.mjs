import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../src/store.mjs';
import {released,timing} from '../src/schedule.mjs';

test('release and advisory completion use exact server-time boundaries',()=>{
 const item={published:1,archived:0,publish_at:200,due_at:400};
 assert.equal(released(item,199),false);assert.equal(released(item,200),true);
 assert.equal(released({...item,published:0},999),false);assert.equal(released({...item,archived:1},999),false);
 assert.equal(timing(item,400).due_state,'upcoming');assert.equal(timing(item,401).due_state,'overdue');
 assert.equal(timing(item,999,400).due_state,'completed');assert.equal(timing(item,999,401).due_state,'late');
});

test('nullable scheduling migration preserves existing rows and reopens saved dates',()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-date-migration-')),path=join(directory,'test.sqlite');let db;
 try{
  db=openDatabase(path);const current=db.prepare('PRAGMA user_version').get().user_version;
  db.exec(`INSERT INTO accounts(id,email,name,role,password_hash,created_at) VALUES('i','i@example.test','Synthetic','instructor','fixture',1);
   INSERT INTO subjects(id,title,description,owner_id,created_at) VALUES('s','Dates','Synthetic','i',1);
   INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at) VALUES('entry','s','i','material','Existing','Unchanged',1,1);
   DROP INDEX items_release; ALTER TABLE items DROP COLUMN publish_at; ALTER TABLE items DROP COLUMN due_at;`);
  db.exec('PRAGMA user_version='+(current-1));db.close();db=openDatabase(path);
  let row=db.prepare("SELECT * FROM items WHERE id='entry'").get();assert.equal(row.publish_at,null);assert.equal(row.due_at,null);assert.equal(row.revision,1);assert.equal(row.published,1);
  db.prepare("UPDATE items SET publish_at=?,due_at=? WHERE id='entry'").run(1900000000000,1900000060000);db.close();db=openDatabase(path);
  row=db.prepare("SELECT * FROM items WHERE id='entry'").get();assert.equal(row.publish_at,1900000000000);assert.equal(row.due_at,1900000060000);assert.equal(row.revision,1);
 }finally{if(db?.isOpen)db.close();rmSync(directory,{recursive:true,force:true});}
});
