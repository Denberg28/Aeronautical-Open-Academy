import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, openSync, closeSync, fchmodSync, constants } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path){
  // Storage — Create the database privately before SQLite creates WAL/SHM sidecars.
  if(path!==':memory:'){
    mkdirSync(dirname(path),{recursive:true,mode:0o700});
    const fd=openSync(path,constants.O_CREAT|constants.O_RDWR|constants.O_NOFOLLOW,0o600);
    try{fchmodSync(fd,0o600);}finally{closeSync(fd);}
  }
  const db=new DatabaseSync(path);
  try{
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>7){throw new Error('Database version is newer than this server. Restore a compatible server; do not downgrade data silently.');}
  db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  db.exec('BEGIN IMMEDIATE;');
  // Storage — All version migrations commit together; failures roll back before serving requests.
  // Additive, transactional v1 -> v2 migration. Existing identities, files and attempts survive.
  if(version<2){
    db.exec(`
      ALTER TABLE subjects ADD COLUMN self_enrol INTEGER NOT NULL DEFAULT 0 CHECK(self_enrol IN (0,1));
      ALTER TABLE items ADD COLUMN assessment_type TEXT NOT NULL DEFAULT 'standard' CHECK(assessment_type IN ('standard','examination'));
      CREATE TABLE enrolment_blocks (
        subject_id TEXT NOT NULL REFERENCES subjects(id), student_id TEXT NOT NULL REFERENCES accounts(id),
        PRIMARY KEY(subject_id,student_id)
      ) STRICT;
      CREATE TABLE submissions (
        id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES accounts(id), item_id TEXT NOT NULL REFERENCES items(id),
        revision INTEGER NOT NULL, output TEXT NOT NULL, score REAL CHECK(score>=0 AND score<=100),
        feedback TEXT NOT NULL DEFAULT '', grader_id TEXT REFERENCES accounts(id), submitted_at INTEGER NOT NULL,
        graded_at INTEGER, request_key TEXT NOT NULL,
        UNIQUE(student_id,item_id,revision), UNIQUE(student_id,request_key)
      ) STRICT;
      CREATE INDEX submissions_item ON submissions(item_id,revision,student_id);
      PRAGMA user_version=2;
      `);
  }
  if(version<3){
    db.exec(`
      ALTER TABLE items ADD COLUMN edit_version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE accounts ADD COLUMN student_number TEXT;
      CREATE UNIQUE INDEX accounts_student_number ON accounts(student_number) WHERE student_number IS NOT NULL;
      ALTER TABLE subjects ADD COLUMN eligibility_all INTEGER NOT NULL DEFAULT 0 CHECK(eligibility_all IN (0,1));
      ALTER TABLE subjects ADD COLUMN eligibility_revision INTEGER NOT NULL DEFAULT 1;
      UPDATE subjects SET eligibility_all=self_enrol;
      ALTER TABLE enrolments ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy' CHECK(source IN ('legacy','admin','self','qr'));
      CREATE TABLE eligible_students (
        subject_id TEXT NOT NULL REFERENCES subjects(id), student_number TEXT NOT NULL,
        PRIMARY KEY(subject_id,student_number)
      ) STRICT;
      CREATE INDEX eligible_student_number ON eligible_students(student_number,subject_id);
      PRAGMA user_version=3;
      `);
  }
  if(version<4){
    db.exec(`
      ALTER TABLE items ADD COLUMN material_mode TEXT NOT NULL DEFAULT 'file' CHECK(material_mode IN ('file','text'));
      PRAGMA user_version=4;
      `);
  }
  if(version<5){
    db.exec(`
      ALTER TABLE subjects ADD COLUMN order_revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      WITH ranked AS (SELECT id,ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY created_at,id)-1 AS position FROM items)
      UPDATE items SET sort_order=(SELECT position FROM ranked WHERE ranked.id=items.id);
      CREATE INDEX items_sequence ON items(subject_id,archived,sort_order,created_at,id);
      PRAGMA user_version=5;
      `);
  }
  if(version<6){
    db.exec(`CREATE TABLE security_limits (
      key_hash TEXT PRIMARY KEY, hits INTEGER NOT NULL CHECK(hits>0),
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX security_limits_expiry ON security_limits(expires_at);
    CREATE INDEX sessions_expiry ON sessions(expires_at);
    PRAGMA user_version=6;`);
  }
  // Storage — v7 adds optional choice questions; prior records remain unchanged.
  if(version<7)db.exec('ALTER TABLE items ADD COLUMN questions_json TEXT; PRAGMA user_version=7;');
  if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok')||db.prepare('PRAGMA foreign_key_check').all().length)
    throw new Error('Database integrity check failed. Restore a verified backup before starting the service.');
  db.exec('COMMIT; PRAGMA busy_timeout=5000;');
  return db;
  }catch(error){
    if(db.isTransaction)db.exec('ROLLBACK;');
    db.close();throw error;
  }
}
