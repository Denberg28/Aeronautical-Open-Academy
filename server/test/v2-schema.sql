-- Published 0.3 schema additions to the v1 bootstrap, used only for upgrade regression.
ALTER TABLE subjects ADD COLUMN self_enrol INTEGER NOT NULL DEFAULT 0 CHECK(self_enrol IN (0,1));
ALTER TABLE items ADD COLUMN assessment_type TEXT NOT NULL DEFAULT 'standard' CHECK(assessment_type IN ('standard','examination'));
CREATE TABLE enrolment_blocks(subject_id TEXT NOT NULL REFERENCES subjects(id),student_id TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(subject_id,student_id)) STRICT;
CREATE TABLE submissions(id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES accounts(id),item_id TEXT NOT NULL REFERENCES items(id),revision INTEGER NOT NULL,output TEXT NOT NULL,score REAL CHECK(score>=0 AND score<=100),feedback TEXT NOT NULL DEFAULT '',grader_id TEXT REFERENCES accounts(id),submitted_at INTEGER NOT NULL,graded_at INTEGER,request_key TEXT NOT NULL,UNIQUE(student_id,item_id,revision),UNIQUE(student_id,request_key)) STRICT;
CREATE INDEX submissions_item ON submissions(item_id,revision,student_id);
PRAGMA user_version=2;
