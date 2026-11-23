import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateQuestions } from '../server/src/quizzes.mjs';

// Content — reuse the mobile practice course; only exact untouched factory content is replaced.
export async function installPracticeTemplate(db) {
  const template=JSON.parse(await readFile(new URL('./assets/subject-template.json',import.meta.url),'utf8'));
  if(db.prepare('SELECT 1 FROM desktop_templates WHERE template_key=?').get(template.key))return false;
  const owner=db.prepare("SELECT id FROM accounts WHERE email='instructor@academy.test' AND role='instructor' AND status='active'").get();
  if(!owner)return false;
  const factory=db.prepare("SELECT * FROM subjects WHERE title='Introduction to Aeronautics' AND description='A place for your lessons, references and learning activities.' AND owner_id=? AND archived=0 AND self_enrol=1 AND eligibility_all=1").all(owner.id).find(subject=>{
    const items=db.prepare('SELECT * FROM items WHERE subject_id=? ORDER BY sort_order,created_at,id').all(subject.id);
    return items.length===2&&items.every(item=>!item.archived&&item.published&&item.revision===1&&item.edit_version===1)&&
      items[0].title==='The principles of flight'&&items[0].body==='The principles of flight\nExplore NASA’s guide to the forces that act on an aircraft.\nhttps://www1.grc.nasa.gov/beginners-guide-to-aeronautics/'&&
      items[1].title==='Reflect on the four forces'&&items[1].body==='In your own words, describe how lift, weight, thrust and drag interact during steady flight.';
  });
  const subjectId=factory?.id||randomUUID(),now=Date.now();db.exec('BEGIN IMMEDIATE');
  try {
    if(factory){db.prepare('UPDATE items SET archived=1,edit_version=edit_version+1 WHERE subject_id=?').run(subjectId);db.prepare('UPDATE subjects SET title=?,description=?,order_revision=order_revision+1 WHERE id=?').run(template.title,template.description,subjectId);}
    else db.prepare('INSERT INTO subjects(id,title,description,owner_id,created_at,self_enrol,eligibility_all) VALUES(?,?,?,?,?,1,1)').run(subjectId,template.title,template.description,owner.id,now);
    db.prepare("INSERT OR IGNORE INTO subject_instructors(subject_id,instructor_id,access_level,status,updated_by,updated_at) VALUES(?,?,'editor','active',?,?)").run(subjectId,owner.id,owner.id,now);
    let order=0;
    const add=(entry,parent=null)=>{
      const questions=entry.questions?validateQuestions(entry.questions):null,id=randomUUID(),kind=entry.kind==='examination'?'activity':entry.kind;
      db.prepare('INSERT INTO items(id,subject_id,owner_id,kind,title,body,published,created_at,material_mode,sort_order,parent_id,assessment_type,questions_json,options_json,correct_index) VALUES(?,?,?,?,?,?,1,?,?,?,?,?,?,?,?)').run(id,subjectId,owner.id,kind,entry.title,entry.body,now,kind==='material'?'text':'file',order++,parent,entry.kind==='examination'?'examination':'standard',questions?JSON.stringify(questions):null,kind==='quiz'?JSON.stringify(questions[0].options):null,kind==='quiz'?questions[0].correct_index:null);
      return id;
    };
    add(template.overview);
    for(const period of template.periods){let material=null;for(const entry of period.entries){const id=add(entry,entry.kind==='material'||entry.kind==='examination'?null:material);if(entry.kind==='material')material=id;}}
    const student=db.prepare("SELECT id FROM accounts WHERE email='student@academy.test' AND role='student' AND status='active'").get();
    if(student&&!db.prepare('SELECT 1 FROM enrolment_blocks WHERE subject_id=? AND student_id=?').get(subjectId,student.id))db.prepare("INSERT OR IGNORE INTO enrolments(subject_id,student_id,source) VALUES(?,?,'admin')").run(subjectId,student.id);
    db.prepare('INSERT INTO desktop_templates VALUES(?,?,?)').run(template.key,subjectId,template.templateVersion);db.exec('COMMIT');return true;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
