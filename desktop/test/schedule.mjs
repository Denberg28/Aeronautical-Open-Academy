import {_electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'academy-schedule-ui-'));let app;
try{
 app=await _electron.launch({args:[resolve(import.meta.dirname,'..'),'--no-sandbox','--disable-gpu',...(process.platform==='linux'&&!process.env.DISPLAY?['--ozone-platform=headless']:[])],env:{...process.env,ACADEMY_TEST_DATA:directory},timeout:30000});
 const page=await app.firstWindow();page.setDefaultTimeout(20000);
 const idle=()=>page.waitForFunction(()=>!document.body.classList.contains('working'));
 const login=async role=>{await page.locator(`[data-demo="${role}"]`).click();await page.locator('#login-form button[type=submit]').click();await page.waitForSelector('#app:not([hidden]) .subject-hero');await idle();};
 const request=async(path,options)=>{const response=await page.evaluate(({path,options})=>window.academy.request(path,options),{path,options});assert.equal(response.ok,true,response.error);return response.value;};
 await login('instructor');const sid=(await request('/v1/subjects')).subjects[0].id,course=await request(`/v1/subjects/${sid}`);
 const entries=[course.items.find(i=>i.kind==='material'),course.items.find(i=>i.kind==='quiz'),course.items.find(i=>i.kind==='activity'&&i.assessment_type!=='examination'),course.items.find(i=>i.assessment_type==='examination')];
 for(const item of entries){
  await page.locator(`[data-action="schedule"][data-id="${item.id}"]`).click();
  await page.locator('.schedule-dialog select[name=mode]').selectOption('scheduled');
  await page.locator('.schedule-dialog input[name=publish]').fill('2030-01-01T09:00');
  await page.locator('.schedule-dialog input[name=hasDue]').check();await page.locator('.schedule-dialog input[name=due]').fill('2030-01-02T23:59');
  await page.locator('.schedule-dialog button[type=submit]').click();await page.waitForSelector('.schedule-dialog',{state:'detached'});await idle();
  const saved=(await request(`/v1/items/${item.id}`)).item;assert.equal(saved.publish_at,Date.parse('2030-01-01T09:00:00+08:00'));assert.equal(saved.revision,item.revision);assert.equal(saved.publication_state,'scheduled');
 }
 const first=entries[0];
 await page.locator(`[data-action="schedule"][data-id="${first.id}"]`).click();
 await page.locator('.schedule-dialog select[name=mode]').selectOption('published');await page.locator('.schedule-dialog input[name=due]').fill('2020-01-01T23:59');
 await page.locator('.schedule-dialog button[type=submit]').click();await page.waitForSelector('.schedule-dialog',{state:'detached'});await idle();
 assert.match(await page.locator(`[data-item="${first.id}"] .deadline`).textContent(),/Overdue|Due/);
 await page.locator('[data-action=logout]').click();await login('admin');
 assert.match(await page.locator(`[data-item="${first.id}"] .deadline`).textContent(),/Overdue|Due/);
 console.log('PASS: instructor schedules all four types with PHT conversion; immediate publication and overdue caption across instructor/admin');
}finally{await app?.windows()[0]?.evaluate(()=>{state.dirty=false;}).catch(()=>{});await app?.close();await rm(directory,{recursive:true,force:true});}
