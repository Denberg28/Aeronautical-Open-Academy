PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','instructor','student')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
 password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
 created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS subjects (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
 owner_id TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX IF NOT EXISTS subjects_owner ON subjects(owner_id);
CREATE TABLE IF NOT EXISTS enrolments (
 subject_id TEXT NOT NULL REFERENCES subjects(id), student_id TEXT NOT NULL REFERENCES accounts(id),
 PRIMARY KEY(subject_id,student_id)
) STRICT;
CREATE INDEX IF NOT EXISTS enrolments_student ON enrolments(student_id,subject_id);
CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id), owner_id TEXT NOT NULL REFERENCES accounts(id),
 kind TEXT NOT NULL CHECK(kind IN ('material','activity','quiz')), title TEXT NOT NULL, body TEXT NOT NULL,
 published INTEGER NOT NULL DEFAULT 0, offline_allowed INTEGER NOT NULL DEFAULT 0,
 options_json TEXT, correct_index INTEGER, revision INTEGER NOT NULL DEFAULT 1,
 file_ref TEXT, file_sha256 TEXT, file_bytes INTEGER, created_at INTEGER NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX IF NOT EXISTS items_subject ON items(subject_id,archived,published,created_at);
CREATE INDEX IF NOT EXISTS items_owner ON items(owner_id);
CREATE TABLE IF NOT EXISTS progress (
 student_id TEXT NOT NULL REFERENCES accounts(id), item_id TEXT NOT NULL REFERENCES items(id),
 revision INTEGER NOT NULL, completed INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(student_id,item_id)
) STRICT;
CREATE TABLE IF NOT EXISTS attempts (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES accounts(id), item_id TEXT NOT NULL REFERENCES items(id),
 revision INTEGER NOT NULL, choice INTEGER NOT NULL, score INTEGER NOT NULL CHECK(score IN (0,1)),
 request_key TEXT NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(student_id,item_id,revision), UNIQUE(student_id,request_key)
) STRICT;
CREATE TABLE IF NOT EXISTS announcements (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
 author_id TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target_id TEXT,
 created_at INTEGER NOT NULL
) STRICT;
-- user_version is advanced transactionally by store.mjs.
