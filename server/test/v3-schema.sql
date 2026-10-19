-- Published 0.4 additions after the v2 fixture; independent upgrade regression input.
ALTER TABLE items ADD COLUMN edit_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN student_number TEXT;
CREATE UNIQUE INDEX accounts_student_number ON accounts(student_number) WHERE student_number IS NOT NULL;
ALTER TABLE subjects ADD COLUMN eligibility_all INTEGER NOT NULL DEFAULT 0 CHECK(eligibility_all IN (0,1));
ALTER TABLE subjects ADD COLUMN eligibility_revision INTEGER NOT NULL DEFAULT 1;
UPDATE subjects SET eligibility_all=self_enrol;
ALTER TABLE enrolments ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy' CHECK(source IN ('legacy','admin','self','qr'));
CREATE TABLE eligible_students(subject_id TEXT NOT NULL REFERENCES subjects(id),student_number TEXT NOT NULL,PRIMARY KEY(subject_id,student_number)) STRICT;
CREATE INDEX eligible_student_number ON eligible_students(student_number,subject_id);
PRAGMA user_version=3;
