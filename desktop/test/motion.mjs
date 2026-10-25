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
  const subject=await post('/v1/subjects',{title:'Long subject',description:'Drag stability'});await loadSubject(subject.id);
  const roots=[];for(let n=0;n<24;n++)roots.push((await post(`/v1/subjects/${subject.id}/items`,{kind:'material',title:`Lesson ${n+1}`,body:`Lesson ${n+1}\nDiscussion notes.`,published:true,material_mode:'text'})).id);
  const first=(await post(`/v1/subjects/${subject.id}/items`,{kind:'activity',title:'First practice',body:'Write your response',published:true,parent_id:roots[12]})).id;
  const second=(await post(`/v1/subjects/${subject.id}/items`,{kind:'activity',title:'Second practice',body:'Write your response',published:true,parent_id:roots[12]})).id;
  const otherChild=(await post(`/v1/subjects/${subject.id}/items`,{kind:'activity',title:'Other material practice',body:'Write your response',published:true,parent_id:roots[13]})).id;
  await reloadActive();window.originalCenter=document.querySelector('#center');window.originalSidebar=document.querySelector('.sidebar');
  return {root:roots[12],other:roots[13],first,second,otherChild};
 });
 const wait=()=>page.waitForFunction(()=>!state.busy);
 const action=async(name,id)=>{await page.locator(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`).first().click();await wait();};
 const card=id=>page.locator(`[data-item="${id}"]`);
 assert.equal(await page.locator('[data-action=add-subsection]').count(),0);
 await page.locator(`[data-action=add][data-parent="${ids.root}"]`).click();await wait();
 assert.deepEqual(await page.locator('#entry-kind option').evaluateAll(options=>options.map(o=>o.value)),['activity','quiz']);
 await action('cancel-compose');
 await action('toggle-material',ids.root);assert.equal(await card(ids.first).isVisible(),false);
 await page.locator('#search').fill('First practice');assert.equal(await card(ids.first).isVisible(),true);
 await page.locator('#search').fill('');assert.equal(await card(ids.first).isVisible(),false);
 await card(ids.root).evaluate(el=>{document.querySelector('#center').scrollTop+=el.getBoundingClientRect().top-document.querySelector('#center').getBoundingClientRect().top-100;});
 const offset=id=>card(id).evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#center').getBoundingClientRect().top);
 const original=await offset(ids.root);assert.ok(await page.locator('#center').evaluate(el=>el.scrollTop)>1000);
 await page.evaluate(()=>act(()=>reloadActive()));await wait();await page.waitForTimeout(250);
 assert.ok(Math.abs((await offset(ids.root))-original)<3,'Refresh retains position');
 await page.evaluate(({root,first})=>{window.heldGroup=groupFor(root);window.heldChild=groupFor(first);window.orderWrites=0;window.realRequest=desktopApi.request;desktopApi.request=async(path,...args)=>{if(path.endsWith('/order'))window.orderWrites++;return window.realRequest(path,...args);};},ids);
 // Keyboard ordering moves the whole group without replacing any cards.
 await page.locator(`[data-drag="${ids.root}"]`).press('Alt+ArrowDown');await wait();await page.waitForTimeout(250);
 assert.ok(Math.abs((await offset(ids.root))-original)<3,`Keyboard retains moved header position: ${original} -> ${await offset(ids.root)}; ${JSON.stringify(await page.locator('#center').evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scrollHeight:el.scrollHeight})))}`);
 assert.equal(await page.evaluate(({root,first})=>heldGroup===groupFor(root)&&heldChild===groupFor(first),ids),true);
 assert.equal(await page.locator(`[data-action=toggle-material][data-id="${ids.root}"]`).getAttribute('aria-expanded'),'false');
 // Native drop keeps the moved header at its chosen boundary, not at the subject top.
 await card(ids.other).scrollIntoViewIfNeeded();
 const dropOffset=await offset(ids.other);
 await page.locator(`[data-drag="${ids.root}"]`).dragTo(card(ids.other),{targetPosition:{x:80,y:8}});await wait();await page.waitForTimeout(250);
 assert.ok(Math.abs((await offset(ids.root))-Math.max(24,dropOffset))<3,'Moved material lands at its drop location');
 assert.equal(await page.evaluate(({root,first})=>heldGroup===groupFor(root)&&heldChild===groupFor(first),ids),true);
 // A material dropped on another material's child resolves to that whole material.
 const otherChildBounds=await card(ids.otherChild).boundingBox();
 await page.locator(`[data-drag="${ids.root}"]`).dragTo(card(ids.otherChild),{targetPosition:{x:80,y:otherChildBounds.height-8}});await wait();await page.waitForTimeout(220);
 assert.equal(await page.evaluate(({root,other})=>{const roots=rootsOf().map(i=>i.id);return roots.indexOf(root)===roots.indexOf(other)+1;},ids),true);
 await action('toggle-material',ids.root);
 // Before/after child placement and repeated moves persist the exact sibling order.
 for(const after of [false,true,false]){
  const target=card(ids.first);await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();
  await page.locator(`[data-drag="${ids.second}"]`).dragTo(target,{targetPosition:{x:80,y:after?box.height-8:8}});await wait();await page.waitForTimeout(220);
  assert.deepEqual(await page.evaluate(id=>childrenOf(id).map(i=>i.id),ids.root),after?[ids.first,ids.second]:[ids.second,ids.first]);
 }
 // Gaps/add-slot space resolve to the last sibling boundary.
 await page.locator(`[data-drag="${ids.first}"]`).dragTo(page.locator(`[data-add-parent="${ids.root}"]`),{targetPosition:{x:80,y:20}});await wait();await page.waitForTimeout(220);
 assert.deepEqual(await page.evaluate(id=>childrenOf(id).map(i=>i.id),ids.root),[ids.second,ids.first]);
 const beforeInvalid=await page.evaluate(()=>({order:state.items.map(i=>i.id),writes:window.orderWrites}));
 await page.locator(`[data-drag="${ids.first}"]`).dragTo(card(ids.other),{targetPosition:{x:80,y:8}});await wait();
 assert.deepEqual(await page.evaluate(()=>({order:state.items.map(i=>i.id),writes:window.orderWrites})),beforeInvalid,'Cross-parent drag is rejected without a write');
 const persisted=await page.evaluate(async()=> (await api(`/v1/subjects/${state.active.id}`)).items.map(i=>i.id));
 assert.deepEqual(persisted,await page.evaluate(()=>state.items.map(i=>i.id)));
 assert.equal(await page.evaluate(()=>originalCenter===document.querySelector('#center')&&originalSidebar===document.querySelector('.sidebar')),true);
 // Reordering has no refresh dependency, and a no-op produces no request.
 const writesBeforeNoop=await page.evaluate(()=>window.orderWrites);
 await page.evaluate(async({root})=>{const saved=reloadActive;reloadActive=async()=>{throw new Error('Unexpected reorder refresh');};try{await act(()=>reorder(flattenTree(rootsOf()),root));}finally{reloadActive=saved;}},ids);
 assert.equal(await page.evaluate(()=>window.orderWrites),writesBeforeNoop);
 const failed=await page.evaluate(async({root})=>{
  const before=state.items.map(i=>i.id),revision=state.active.order_revision,nodes=[...document.querySelectorAll('[data-group]')];
  const real=desktopApi.request;desktopApi.request=async(path,...args)=>{if(path.endsWith('/order'))throw Object.assign(new Error('Synthetic stale order'),{status:409});return real(path,...args);};
  try{const roots=rootsOf();[roots[0],roots[1]]=[roots[1],roots[0]];await act(()=>reorder(flattenTree(roots),root));}finally{desktopApi.request=real;}
  return {sameOrder:JSON.stringify(before)===JSON.stringify(state.items.map(i=>i.id)),sameNodes:nodes.every((node,index)=>node===document.querySelectorAll('[data-group]')[index]),sameRevision:revision===state.active.order_revision};
 },ids);
 assert.deepEqual(failed,{sameOrder:true,sameNodes:true,sameRevision:true});
 // Moving across elements inside one target must not flicker the insertion marker.
 await card(ids.first).scrollIntoViewIfNeeded();
 const marker=await page.evaluate(({first,second})=>{
  const grip=document.querySelector(`[data-drag="${second}"]`),target=groupFor(first),rect=target.getBoundingClientRect(),dataTransfer=new DataTransfer();
  grip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer,clientX:rect.left+30,clientY:rect.top+20}));
  let changes=0;const observer=new MutationObserver(records=>changes+=records.length);observer.observe(target,{attributes:true,attributeFilter:['class']});
  for(const element of [target.querySelector('h3'),target.querySelector('p'),target.querySelector('button')].filter(Boolean)){
   element.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer,clientX:rect.left+80,clientY:rect.top+12}));
   element.dispatchEvent(new DragEvent('dragleave',{bubbles:true,relatedTarget:target.querySelector('h3'),clientX:rect.left+80,clientY:rect.top+12}));
  }
  changes+=observer.takeRecords().length;observer.disconnect();
  const result={markers:document.querySelectorAll('.drop-before,.drop-after').length,changes};
  grip.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer}));return {...result,remaining:document.querySelectorAll('.drop-before,.drop-after,.is-dragging,.drag-preview').length};
 },ids);
 assert.equal(marker.markers,1);assert.ok(marker.changes<=1,`One stable marker: ${JSON.stringify(marker)}`);assert.equal(marker.remaining,0);
 // Edge scrolling is bounded to the center and stops on cancellation.
 await page.evaluate(({second})=>{const grip=document.querySelector(`[data-drag="${second}"]`),rect=document.querySelector('#center').getBoundingClientRect(),dataTransfer=new DataTransfer();grip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer,clientX:rect.left+60,clientY:rect.bottom-10}));dragSession.x=rect.left+60;dragSession.y=rect.bottom-10;},ids);
 const beforeEdge=await page.locator('#center').evaluate(el=>el.scrollTop);await page.waitForTimeout(180);
 const afterEdge=await page.locator('#center').evaluate(el=>el.scrollTop);assert.ok(afterEdge>beforeEdge&&afterEdge-beforeEdge<100,'Bounded edge scrolling');
 await page.evaluate(()=>document.dispatchEvent(new DragEvent('dragleave',{bubbles:true,clientX:0,clientY:0})));
 const left=await page.locator('#center').evaluate(el=>el.scrollTop);await page.waitForTimeout(100);assert.equal(await page.locator('#center').evaluate(el=>el.scrollTop),left,'Leaving the pane stops auto-scroll');
 await page.evaluate(()=>endDrag());const stopped=await page.locator('#center').evaluate(el=>el.scrollTop);await page.waitForTimeout(100);assert.equal(await page.locator('#center').evaluate(el=>el.scrollTop),stopped);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator(`[data-drag="${ids.root}"]`).press('Alt+ArrowDown');await wait();
 assert.equal(await page.locator('#center').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
 await action('edit',ids.root);await page.locator('#composer textarea[name=text]').fill('Updated lesson\nDiscussion notes.');
 const beforeSave=await page.locator('#center').evaluate(el=>el.scrollTop);await page.locator('#composer button[type=submit]').click();await wait();
 assert.ok(Math.abs(await page.locator('#center').evaluate(el=>el.scrollTop)-beforeSave)<500,'Save stays near the update');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1060,720));
 for(const zoom of [1,1.25,1.5,2]){await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(value),zoom);assert.ok(await page.locator('#center').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Fits at zoom ${zoom}`);}
 assert.deepEqual(errors,[]);
 console.log('PASS: Activity/Quiz-only creation; stable pane/card identities; refresh/keyboard/drop anchors; repeated native before/after drops; exact persisted order; stale-save recovery; marker stability/cancellation; bounded edge scroll; reduced motion; save continuity and enlarged layouts.');
} finally {
 if(page)await page.evaluate(()=>{endDrag();state.dirty=false;}).catch(()=>{});
 if(app)await app.close();await rm(directory,{recursive:true,force:true});
}
