import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, openSync, closeSync, fchmodSync, constants } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path){
  if(path!==':memory:'){
    mkdirSync(dirname(path),{recursive:true,mode:0o700});
    const fd=openSync(path,constants.O_CREAT|constants.O_RDWR|constants.O_NOFOLLOW,0o600);
    try{fchmodSync(fd,0o600);}finally{closeSync(fd);}
  }
  const db=new DatabaseSync(path);
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>15){db.close();throw new Error('Database version is newer than this server. Restore a compatible server; do not downgrade data silently.');}
  if(version>=6&&!db.prepare('PRAGMA table_info(items)').all().some(column=>column.name==='parent_id')){db.close();throw new Error('This is not a PC backend database. Use its matching server and a validated migration.');}
  db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  // Additive, transactional v1 -> v2 migration. Existing identities, files and attempts survive.
  if(version<2){
    db.exec(`BEGIN IMMEDIATE;
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
      COMMIT;`);
  }
  if(version<3){
    db.exec(`BEGIN IMMEDIATE;
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
      COMMIT;`);
  }
  if(version<4){
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE items ADD COLUMN material_mode TEXT NOT NULL DEFAULT 'file' CHECK(material_mode IN ('file','text'));
      PRAGMA user_version=4;
      COMMIT;`);
  }
  if(version<5){
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE subjects ADD COLUMN order_revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      WITH ranked AS (SELECT id,ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY created_at,id)-1 AS position FROM items)
      UPDATE items SET sort_order=(SELECT position FROM ranked WHERE ranked.id=items.id);
      CREATE INDEX items_sequence ON items(subject_id,archived,sort_order,created_at,id);
      PRAGMA user_version=5;
      COMMIT;`);
  }
  if(version<6){
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE items ADD COLUMN parent_id TEXT REFERENCES items(id);
      CREATE INDEX items_parent ON items(parent_id,archived,sort_order);
      CREATE TRIGGER items_tree_insert BEFORE INSERT ON items WHEN NEW.parent_id IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.kind NOT IN ('activity','quiz') OR NEW.assessment_type='examination'
          OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND p.parent_id IS NULL);
      END;
      CREATE TRIGGER items_tree_update BEFORE UPDATE OF parent_id,subject_id,kind,assessment_type ON items WHEN NEW.parent_id IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.kind NOT IN ('activity','quiz') OR NEW.assessment_type='examination'
          OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND p.parent_id IS NULL);
      END;
      PRAGMA user_version=6;
      COMMIT;`);
  }
  if(version<7){
    db.exec(`BEGIN IMMEDIATE;
      DROP TRIGGER items_tree_insert;
      DROP TRIGGER items_tree_update;
      CREATE TRIGGER items_tree_insert BEFORE INSERT ON items WHEN NEW.parent_id IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.assessment_type='examination' OR NEW.id=NEW.parent_id
          OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND (NEW.kind<>'material' OR p.parent_id IS NULL));
      END;
      CREATE TRIGGER items_tree_update BEFORE UPDATE OF parent_id,subject_id,kind,assessment_type ON items WHEN NEW.parent_id IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.assessment_type='examination' OR NEW.id=NEW.parent_id
          OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND (NEW.kind<>'material' OR p.parent_id IS NULL))
          OR (NEW.kind='material' AND EXISTS(SELECT 1 FROM items c WHERE c.parent_id=NEW.id AND c.kind='material' AND c.archived=0));
      END;
      PRAGMA user_version=7;
      COMMIT;`);
  }
  if(version<8){
    db.exec('BEGIN IMMEDIATE;');
    try {
      const nested=db.prepare("SELECT i.id,i.subject_id,p.published parent_published,p.archived parent_archived FROM items i JOIN items p ON p.id=i.parent_id WHERE i.kind='material'").all();
      for(const subjectId of new Set(nested.map(item=>item.subject_id))){
        const rows=db.prepare('SELECT id,parent_id FROM items WHERE subject_id=? AND archived=0 ORDER BY sort_order,created_at,id').all(subjectId);
        const visit=parent=>rows.filter(item=>(item.parent_id||null)===parent).flatMap(item=>[item,...visit(item.id)]);
        visit(null).forEach((item,index)=>db.prepare('UPDATE items SET sort_order=? WHERE id=?').run(index,item.id));
        db.prepare('UPDATE subjects SET order_revision=order_revision+1 WHERE id=?').run(subjectId);
      }
      for(const item of nested)db.prepare('UPDATE items SET parent_id=NULL,published=CASE WHEN ?=1 AND ?=0 THEN published ELSE 0 END,edit_version=edit_version+1 WHERE id=?').run(item.parent_published,item.parent_archived,item.id);
      db.exec(`DROP TRIGGER items_tree_insert;
        DROP TRIGGER items_tree_update;
        CREATE TRIGGER items_tree_insert BEFORE INSERT ON items WHEN NEW.parent_id IS NOT NULL
        BEGIN
          SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.kind NOT IN ('activity','quiz') OR NEW.assessment_type='examination'
            OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND p.parent_id IS NULL);
        END;
        CREATE TRIGGER items_tree_update BEFORE UPDATE OF parent_id,subject_id,kind,assessment_type ON items WHEN NEW.parent_id IS NOT NULL
        BEGIN
          SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.kind NOT IN ('activity','quiz') OR NEW.assessment_type='examination'
            OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0 AND p.parent_id IS NULL);
        END;
        PRAGMA user_version=8;
        COMMIT;`);
    } catch(error) { db.exec('ROLLBACK;'); db.close(); throw error; }
  }
  if(version<9){
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`ALTER TABLE items ADD COLUMN questions_json TEXT;
        CREATE TABLE attempts_v9 (
          id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES accounts(id), item_id TEXT NOT NULL REFERENCES items(id),
          revision INTEGER NOT NULL, choice INTEGER NOT NULL, score INTEGER NOT NULL CHECK(score>=0),
          request_key TEXT NOT NULL, created_at INTEGER NOT NULL,
          answers_json TEXT, max_score INTEGER NOT NULL DEFAULT 1 CHECK(max_score BETWEEN 1 AND 50 AND score<=max_score),
          UNIQUE(student_id,item_id,revision), UNIQUE(student_id,request_key)
        ) STRICT;
        INSERT INTO attempts_v9(id,student_id,item_id,revision,choice,score,request_key,created_at)
          SELECT id,student_id,item_id,revision,choice,score,request_key,created_at FROM attempts;
        DROP TABLE attempts;
        ALTER TABLE attempts_v9 RENAME TO attempts;
        PRAGMA user_version=9;
        COMMIT;`);
    } catch(error) { db.exec('ROLLBACK;'); db.close(); throw error; }
  }
  if(version<10)db.exec(`BEGIN IMMEDIATE; CREATE TABLE desktop_templates(template_key TEXT PRIMARY KEY,subject_id TEXT NOT NULL REFERENCES subjects(id),version INTEGER NOT NULL) STRICT; PRAGMA user_version=10; COMMIT;`);
  // Authentication — Persist hashed login budgets in the PC database, schema 11.
  if(version<11)db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE security_limits(key_hash TEXT PRIMARY KEY,hits INTEGER NOT NULL CHECK(hits>0),expires_at INTEGER NOT NULL) STRICT;
    CREATE INDEX security_limits_expiry ON security_limits(expires_at);
    CREATE INDEX sessions_expiry ON sessions(expires_at);
    PRAGMA user_version=11; COMMIT;`);
  // Scheduling — Nullable dates preserve existing immediate publication and all learning revisions.
  if(version<12){try{db.exec(`BEGIN IMMEDIATE; ALTER TABLE items ADD COLUMN publish_at INTEGER;
    ALTER TABLE items ADD COLUMN due_at INTEGER;
    CREATE INDEX items_release ON items(subject_id,archived,published,publish_at);
    PRAGMA user_version=12; COMMIT;`);}catch(error){if(db.isTransaction)db.exec('ROLLBACK;');db.close();throw error;}}
  // Instructor subject access — Admin-managed per-subject read_only/editor and active/suspended grants, schema 13.
  if(version<13){try{db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS subject_instructors (
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      instructor_id TEXT NOT NULL REFERENCES accounts(id),
      access_level TEXT NOT NULL CHECK(access_level IN ('read_only','editor')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
      updated_by TEXT REFERENCES accounts(id),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(subject_id,instructor_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS subject_instructors_instructor ON subject_instructors(instructor_id,status,access_level);
    INSERT OR IGNORE INTO subject_instructors(subject_id,instructor_id,access_level,status,updated_by,updated_at)
      SELECT s.id,s.owner_id,'editor','active',s.owner_id,s.created_at
      FROM subjects s JOIN accounts a ON a.id=s.owner_id WHERE a.role='instructor';
    PRAGMA user_version=13; COMMIT;`);}catch(error){if(db.isTransaction)db.exec('ROLLBACK;');db.close();throw error;}}
  // Subject folders — Admin-managed hierarchical subject folders in left pane, schema 14.
  if(version<14){try{
    const hasFolder=db.prepare('PRAGMA table_info(subjects)').all().some(col=>col.name==='folder_id');
    db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS subject_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES subject_folders(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES accounts(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS subject_folders_parent ON subject_folders(parent_id,sort_order,name);
    ${hasFolder?'':'ALTER TABLE subjects ADD COLUMN folder_id TEXT REFERENCES subject_folders(id);'}
    CREATE INDEX IF NOT EXISTS subjects_folder ON subjects(folder_id,title);
    PRAGMA user_version=14; COMMIT;`);}catch(error){if(db.isTransaction)db.exec('ROLLBACK;');db.close();throw error;}}
  // Rich content entries, pasted images & multi-level entry tree — schema 15.
  if(version<15){try{
    const cols=db.prepare('PRAGMA table_info(items)').all().map(col=>col.name);
    db.exec(`BEGIN IMMEDIATE;
    ${cols.includes('body_html')?'':'ALTER TABLE items ADD COLUMN body_html TEXT;'}
    ${cols.includes('paragraph_spacing')?'':"ALTER TABLE items ADD COLUMN paragraph_spacing TEXT NOT NULL DEFAULT 'normal' CHECK(paragraph_spacing IN ('compact','normal','relaxed','loose'));"}
    CREATE TABLE IF NOT EXISTS item_images (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      item_id TEXT REFERENCES items(id),
      owner_id TEXT NOT NULL REFERENCES accounts(id),
      mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp','image/gif')),
      sha256 TEXT NOT NULL,
      bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 5242880),
      data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS item_images_item ON item_images(item_id,created_at);
    CREATE INDEX IF NOT EXISTS item_images_subject ON item_images(subject_id,created_at);
    DROP TRIGGER IF EXISTS items_tree_insert;
    DROP TRIGGER IF EXISTS items_tree_update;
    CREATE TRIGGER items_tree_insert BEFORE INSERT ON items WHEN NEW.parent_id IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.id=NEW.parent_id
        OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0);
    END;
    CREATE TRIGGER items_tree_update BEFORE UPDATE OF parent_id,subject_id,kind,assessment_type ON items WHEN NEW.parent_id IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT,'Invalid material parent') WHERE NEW.id=NEW.parent_id
        OR NOT EXISTS(SELECT 1 FROM items p WHERE p.id=NEW.parent_id AND p.subject_id=NEW.subject_id AND p.kind='material' AND p.archived=0);
    END;
    PRAGMA user_version=15; COMMIT;`);}catch(error){if(db.isTransaction)db.exec('ROLLBACK;');db.close();throw error;}}
  if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok')||db.prepare('PRAGMA foreign_key_check').all().length){db.close();throw new Error('Database integrity check failed. Restore a verified backup.');}
  db.exec('PRAGMA busy_timeout=5000;');

  return db;
}
