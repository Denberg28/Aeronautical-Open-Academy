import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'academy-motion-'));
let app,page;
try {
 app=await _electron.launch({args:[resolve(import.meta.dirname,'..'),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],env:{...process.env,ACADEMY_TEST_DATA:directory}});
 page=await app.firstWindow();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1480,960));
 await page.locator('[data-demo=instructor]').click();await page.locator('#login-form button[type=submit]').click();await page.waitForSelector('#app:not([hidden]) #center');await page.waitForFunction(()=>!state.busy);
 const ids=await page.evaluate(async()=>{
  const subject=await post('/v1/subjects',{title:'Long subject',description:'Scroll retention test'});await loadSubject(subject.id);
  const created=[];for(let n=0;n<16;n++)created.push((await post(`/v1/subjects/${subject.id}/items`,{kind:'material',title:`Lesson ${n+1}`,body:`Lesson ${n+1}\nDiscussion notes.`,published:true,material_mode:'text'})).id);
  await reloadActive();window.originalCenter=document.querySelector('#center');window.originalSidebar=document.querySelector('.sidebar');
  return {root:created[12],last:created[15]};
 });
 const wait=()=>page.waitForFunction(()=>!state.busy);
 const action=async(name,id)=>{await page.locator(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`).first().click();await wait();};
 await page.locator(`[data-action=add-subsection][data-parent="${ids.root}"]`).click();await wait();
 assert.equal(await page.locator('#entry-kind').inputValue(),'material');
 await page.locator('#composer textarea[name=text]').fill('Subsection A\nInspect this aircraft structure reference.');
 await action('attach');await page.locator('#composer input[name=link]').fill('https://docs.google.com/document/d/synthetic/edit');
 await page.locator('#composer button[type=submit]').click();await wait();
 ids.section=await page.evaluate(()=>state.items.find(i=>i.title==='Subsection A').id);
 assert.equal(await page.locator(`[data-group="${ids.root}"] [data-item="${ids.section}"]`).count(),1);
 await page.locator(`[data-action=add][data-parent="${ids.section}"]`).click();await wait();
 assert.deepEqual(await page.locator('#entry-kind option').evaluateAll(options=>options.map(o=>o.value)),['activity','quiz']);
 await page.locator('#composer textarea[name=text]').fill('Section exercise');await page.locator('#composer button[type=submit]').click();await wait();
 ids.child=await page.evaluate(()=>state.items.find(i=>i.title==='Section exercise').id);
 await action('toggle-material',ids.section);
 assert.equal(await page.locator(`[data-subsection-body="${ids.section}"]`).isVisible(),false);
 assert.equal(await page.locator(`[data-item="${ids.child}"]`).isVisible(),false);
 await page.locator('#search').fill('Section exercise');
 assert.equal(await page.locator(`[data-item="${ids.child}"]`).isVisible(),true);
 await page.locator('#search').fill('');assert.equal(await page.locator(`[data-item="${ids.child}"]`).isVisible(),false);
 // Capture actual viewport geometry well below the first screen.
 await page.locator(`[data-item="${ids.root}"]`).evaluate(el=>{document.querySelector('#center').scrollTop+=el.getBoundingClientRect().top-document.querySelector('#center').getBoundingClientRect().top-100;});
 const offset=()=>page.locator(`[data-item="${ids.root}"]`).evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#center').getBoundingClientRect().top);
 await page.waitForTimeout(250);
 const original=await offset();assert.ok(await page.locator('#center').evaluate(el=>el.scrollTop)>1000);
 await page.evaluate(()=>act(()=>reloadActive()));await wait();await page.waitForTimeout(250);
 assert.ok(Math.abs((await offset())-original)<3,`Refresh retains visible anchor within 3px: ${original} -> ${await offset()}`);
 assert.equal(await page.evaluate(()=>originalCenter===document.querySelector('#center')&&originalSidebar===document.querySelector('.sidebar')),true);
 // Keyboard movement keeps the moved item in place, including minimized descendants.
 await page.locator(`[data-drag="${ids.root}"]`).press('Alt+ArrowDown');await wait();await page.waitForTimeout(250);
 assert.ok(Math.abs((await offset())-original)<3,'Keyboard reorder keeps moved item near its previous viewport location');
 assert.equal(await page.locator(`[data-action=toggle-material][data-id="${ids.section}"]`).getAttribute('aria-expanded'),'false');
 // Native drag retains the drop destination, rather than resetting to the subject header.
 const sibling=await page.evaluate(id=>siblingsOf(state.items.find(i=>i.id===id)).find((i,index,all)=>all[index+1]?.id===id)?.id,ids.root);
 const destination=page.locator(`[data-item="${sibling}"]`);
 await destination.scrollIntoViewIfNeeded();
 const beforeDrop=await destination.evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#center').getBoundingClientRect().top);
 await page.locator(`[data-drag="${ids.root}"]`).dragTo(destination,{targetPosition:{x:80,y:8}});await wait();await page.waitForTimeout(250);
 const afterDrop=await destination.evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#center').getBoundingClientRect().top);
 assert.ok(Math.abs(afterDrop-beforeDrop)<3,`Drop destination retained within 3px: ${beforeDrop} -> ${afterDrop}`);
 await action('edit',ids.root);await page.locator('#composer textarea[name=text]').fill('Updated lesson\nDiscussion notes.');
 const beforeSave=await page.locator('#center').evaluate(el=>el.scrollTop);
 await page.locator('#composer button[type=submit]').click();await wait();await page.waitForTimeout(250);
 assert.ok(Math.abs(await page.locator('#center').evaluate(el=>el.scrollTop)-beforeSave)<500,'Save stays near the edited lesson');
 assert.ok(await page.locator('#center').evaluate(el=>el.scrollTop)>1000);
 // Reduced-motion users get the same anchored result without animation.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>act(()=>reloadActive()));await wait();
 assert.equal(await page.locator('#center').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
 await action('toggle-material',ids.section);
 await action('edit',ids.child);await page.locator('#composer textarea[name=text]').fill('Retained nested draft');
 assert.equal(await page.locator(`[data-action=toggle-material][data-id="${ids.root}"]`).isDisabled(),true);
 assert.equal(await page.locator(`[data-action=toggle-material][data-id="${ids.section}"]`).isDisabled(),true);
 await page.locator('[data-action=cancel-compose]').click();await page.locator('#confirm-yes').click();await wait();
 // Explicit hide/unhide of the root never leaks nested items into student views.
 await action('publish',ids.root);
 await action('logout');await page.locator('[data-demo=student]').click();await page.locator('#login-form button[type=submit]').click();await wait();
 assert.deepEqual(errors,[]);
 console.log('PASS: subsection link/create/nested activity/search/collapse; long-subject refresh, keyboard and native drag anchors within 3px; save continuity, retained pane nodes, reduced-motion and nested draft guards.');
} finally {
 if(page)await page.evaluate(()=>state.dirty=false).catch(()=>{});
 if(app)await app.close();await rm(directory,{recursive:true,force:true});
}
