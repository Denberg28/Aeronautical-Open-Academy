import {_electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Native Windows parity: the real default template, authoring, choices, results and fixed context.
const directory=await mkdtemp(join(tmpdir(),'academy-parity-'));let app;
try{
 app=await _electron.launch({args:[resolve(import.meta.dirname,'..'),'--no-sandbox','--disable-gpu'],env:{...process.env,ACADEMY_TEST_DATA:directory},timeout:30000});
 const page=await app.firstWindow();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{void dialog.dismiss();});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1480,960));
 const idle=()=>page.waitForFunction(()=>!document.body.classList.contains('working'));
 const action=async(name,extra='')=>{await page.locator(`[data-action="${name}"]${extra}`).first().click();await idle();};
 const login=async role=>{await page.locator(`[data-demo="${role}"]`).click();await page.locator('#login-form button[type=submit]').click();await page.waitForSelector('#app:not([hidden]) .subject-hero');await idle();};
 const request=async path=>{const response=await page.evaluate(path=>window.academy.request(path),path);assert.equal(response.ok,true,response.error);return response.value;};
 await login('instructor');assert.match(await page.locator('.subject-hero h1').textContent(),/AE 101/);
 const subject=(await request('/v1/subjects')).subjects[0],original=await request(`/v1/subjects/${subject.id}`);assert.equal(original.items.length,25);
 const lesson=original.items.find(item=>item.title.startsWith('Prelim - Lesson 1'));
 async function author(kind,title,parent=''){
  await action('add',`[data-parent="${parent}"]`);if(!parent)await page.locator('#entry-kind').selectOption(kind);
  await page.locator('#composer textarea[name=text]').fill(title+'\nChoose one answer.');await page.locator('#response-mode').selectOption('choice');
  await page.locator('[data-question-prompt]').fill('Which option is B?');await page.locator('[data-question-option="0"]').fill('A');await page.locator('[data-question-option="1"]').fill('B');await page.locator('input[name="key-0"][value="1"]').check();
  await page.locator('#composer button[type=submit]').click();await idle();assert.equal(await page.locator('#composer').count(),0);
 }
 await author('activity','UI selection activity',lesson.id);await author('examination','UI selection examination');
 const teacher=await request(`/v1/subjects/${subject.id}`),samples=[
  teacher.items.find(i=>i.kind==='quiz'),teacher.items.find(i=>i.kind==='activity'&&i.assessment_type!=='examination'&&i.questions),teacher.items.find(i=>i.assessment_type==='examination'),teacher.items.find(i=>i.title==='UI selection activity'),teacher.items.find(i=>i.title==='UI selection examination')
 ];
 assert.ok(samples.every(Boolean));await action('logout');await login('student');
 assert.ok((await request(`/v1/subjects/${subject.id}`)).items.every(i=>!JSON.stringify(i).includes('correct_index')));
 for(const [n,item] of samples.entries()){
  const card=page.locator(`[data-item="${item.id}"]`);await card.locator('[data-action="start-quiz"]').click();await page.locator('#confirm-yes').click();await idle();
  const form=card.locator('form');assert.equal(await form.evaluate(form=>form.checkValidity()),false);
  const answers=item.questions.map(q=>q.correct_index);if(n===1)answers[0]=(answers[0]+1)%item.questions[0].options.length;
  for(let q=0;q<answers.length;q++)await form.locator(`input[name="answer-${q}"][value="${answers[q]}"]`).check();
  await form.locator('button[type=submit]').click();await page.locator('#confirm-yes').click();await idle();
  const correct=answers.length-(n===1?1:0);assert.match(await card.locator('.result').textContent(),new RegExp(`${correct} / ${answers.length} correct`));assert.match(await card.locator('.result').textContent(),new RegExp(`${Math.round(correct*10000/answers.length)/100}%`));
  assert.equal(await card.locator('form').count(),0);assert.equal(await card.locator('.quiz-review').getAttribute('open'),null);
 }
 const reading=teacher.items.find(i=>i.title.startsWith('Prelim - Lesson 2'));
 const reader=page.locator(`[data-item="${reading.id}"] .reading-entry`);await reader.locator('summary').click();
 assert.ok(await reader.locator('.reading-copy p').count()>=5);const rhythm=await reader.locator('.reading-copy p').first().evaluate(el=>({gap:parseFloat(getComputedStyle(el).marginBottom),leading:parseFloat(getComputedStyle(el).lineHeight)}));assert.equal(rhythm.gap,12);assert.ok(rhythm.leading>=22);
 await mkdir('out/desktop-qa',{recursive:true});await page.screenshot({path:'out/desktop-qa/pc-reader-paragraphs.png'});
 const before=await page.locator('#subject-context').boundingBox();await page.locator('#center').evaluate(el=>{el.scrollTop+=300;});assert.deepEqual(await page.locator('#subject-context').boundingBox(),before);assert.ok(await page.locator('.subject-progress progress').isVisible());
 await page.screenshot({path:'out/desktop-qa/pc-pinned-progress.png'});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(900,700));await page.screenshot({path:'out/desktop-qa/pc-compact-layout.png'});assert.ok(await page.locator('.subject-progress').isVisible());assert.ok(await page.locator('.sidebar [data-action=announcements]').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS: native PC canonical template, activity/exam authoring, five scored selections, 75% mixed result, Read paragraphs and fixed context at desktop/compact widths');
}finally{await app?.close();await rm(directory,{recursive:true,force:true});}
