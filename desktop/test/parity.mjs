import {_electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Native Windows parity: canonical AE 101 template, selection authoring, typography/rhythm, compact top actions, and fixed context.
const directory=await mkdtemp(join(tmpdir(),'academy-parity-')),qa=resolve(import.meta.dirname,'../../out/desktop-qa');let app,page;
try{
 app=await _electron.launch({args:[resolve(import.meta.dirname,'..'),'--no-sandbox','--disable-gpu'],env:{...process.env,ACADEMY_TEST_DATA:directory},timeout:30000});
 page=await app.firstWindow();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{void dialog.dismiss();});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1480,960));
 const idle=()=>page.waitForFunction(()=>!document.body.classList.contains('working'));
 const action=async(name,extra='')=>{await page.locator(`[data-action="${name}"]${extra}`).first().click();await idle();};
 const login=async role=>{await page.locator(`[data-demo="${role}"]`).click();await page.locator('#login-form button[type=submit]').click();await page.waitForSelector('#app:not([hidden]) .subject-hero');await idle();};
 const request=async path=>{const response=await page.evaluate(path=>window.academy.request(path),path);assert.equal(response.ok,true,response.error);return response.value;};
 await page.locator('#toggle-password').click();assert.equal(await page.locator('#login-form [name=password]').getAttribute('type'),'text');
 await login('instructor');assert.match(await page.locator('.subject-hero h1').textContent(),/AE 101/);
 const noticeSizes=await page.evaluate(()=>({heading:parseFloat(getComputedStyle(document.querySelector('.notice h3')).fontSize),body:parseFloat(getComputedStyle(document.querySelector('.notice .reading-copy p')).fontSize)}));assert.ok(noticeSizes.heading>noticeSizes.body,`Rightbar notice heading (${noticeSizes.heading}) must exceed body (${noticeSizes.body})`);
 await action('edit-subject');assert.equal(await page.locator('#subject-context').isVisible(),false,'Editing subject hides pinned context');await action('subject');
 const subject=(await request('/v1/subjects')).subjects[0],original=await request(`/v1/subjects/${subject.id}`);assert.equal(original.items.length,25);
 const lesson=original.items.find(item=>item.title.startsWith('Prelim - Lesson 1'));
 async function author(kind,title,parent=''){
  await action('add',`[data-parent="${parent}"]`);if(!parent)await page.locator('#entry-kind').selectOption(kind);
  await page.locator('#composer input[name=title]').fill(title);await page.locator('#rich-editor').fill('Choose one answer.');await page.locator('#response-mode').selectOption('choice');
  await page.locator('[data-question-prompt]').fill('Which option is B?');await page.locator('[data-question-option="0"]').fill('A');await page.locator('[data-question-option="1"]').fill('B');await page.locator('input[name="key-0"][value="1"]').check();
  await page.locator('#composer button[type=submit]').click();await idle();assert.equal(await page.locator('#composer').count(),0);
 }
 await author('activity','UI selection activity',lesson.id);await author('examination','UI selection examination');
 const teacher=await request(`/v1/subjects/${subject.id}`),samples=[
  original.items.find(i=>i.kind==='quiz'),original.items.find(i=>i.kind==='activity'&&i.assessment_type!=='examination'&&i.questions),original.items.find(i=>i.assessment_type==='examination'),teacher.items.find(i=>i.title==='UI selection activity'),teacher.items.find(i=>i.title==='UI selection examination')
 ];
 assert.equal(teacher.items.length,27);assert.equal(new Set(samples.map(i=>i?.id)).size,5,'Five distinct assessments exist regardless of tree order');
 assert.ok(samples.every(item=>item&&item.questions?.length),'All selected assessments must have questions');
 // Verify compact top actions exist on all four entry kinds and collapsed review summary keeps even padding.
 for(const item of [lesson,...samples.slice(0,3)]){
  const card=page.locator(`[data-item="${item.id}"]`);
  assert.equal(await card.locator('.entry-topbar .entry-actions [data-action="edit"]').count(),1);
  assert.equal(await card.locator('.entry-topbar .entry-actions [data-action="delete"]').count(),1);
 }
 assert.equal(await page.locator('.quiz-review > summary').first().evaluate(el=>parseFloat(getComputedStyle(el).marginBottom)),0,'Collapsed review summary keeps even padding');
 const reading=teacher.items.find(i=>i.title.startsWith('Prelim - Lesson 2'));
 const readingCard=page.locator(`[data-item="${reading.id}"]`);
 assert.ok(await readingCard.locator('.reading-copy p').count()>=5);
 const rhythm=await readingCard.locator('.reading-copy p').first().evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),gap:parseFloat(getComputedStyle(el).marginBottom),leading:parseFloat(getComputedStyle(el).lineHeight)}));
 assert.equal(rhythm.size,16);assert.equal(rhythm.gap,12);assert.ok(rhythm.leading>=22);
 await mkdir(qa,{recursive:true});await page.screenshot({path:join(qa,'pc-reader-paragraphs.png')});
 const before=await page.locator('#subject-context').boundingBox();await page.locator('#center').evaluate(el=>{el.scrollTop+=300;});assert.deepEqual(await page.locator('#subject-context').boundingBox(),before);
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setMinimumSize(800,600);window.setContentSize(900,700);});assert.equal(await page.evaluate(()=>innerWidth),900);
 await page.screenshot({path:join(qa,'pc-compact-layout.png')});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.ok(await page.locator('.sidebar [data-action=announcements]').isVisible());
 await action('logout');assert.equal(await page.locator('#login-form [name=password]').getAttribute('type'),'password','Password field resets hidden on sign-out');
 assert.deepEqual(errors,[]);console.log('PASS: native PC canonical template, activity/exam authoring, compact top actions, reading typography rhythm, UI standardization and fixed context at desktop/compact widths');
}catch(error){
 if(page){await mkdir(qa,{recursive:true});await page.screenshot({path:join(qa,'pc-parity-failure.png')});await writeFile(join(qa,'pc-parity-failure.html'),await page.content());console.error('Parity state',await page.evaluate(()=>({role:state.account?.role,active:state.active?.title,view:state.view,loginError:document.querySelector('#login-error')?.textContent,toast:document.querySelector('#toast')?.textContent})));}
 throw error;
}finally{await app?.close();await rm(directory,{recursive:true,force:true});}
