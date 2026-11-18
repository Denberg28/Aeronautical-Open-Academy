import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID,createHash } from 'node:crypto';

// An original two-page PDF fixture exercises the actual packaged rendering pipeline.
function fixturePdf(){
 const stream=n=>`BT /F1 18 Tf 50 700 Td (Synthetic reading page ${n}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${stream(1).length} >>\nstream\n${stream(1)}\nendstream`,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
  `<< /Length ${stream(2).length} >>\nstream\n${stream(2)}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let text='%PDF-1.4\n',offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(text));text+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(text);text+=`xref\n0 8\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
 return Buffer.from(text+`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
const directory=await mkdtemp(join(tmpdir(),'academy-reader-'));let application;
try{
 application=await _electron.launch({args:[resolve(import.meta.dirname,'..'),'--no-sandbox','--disable-gpu',...(process.platform==='linux'&&!process.env.DISPLAY?['--ozone-platform=headless']:[])],
  env:{...process.env,ACADEMY_TEST_DATA:directory,ACADEMY_TEST_LEGACY_SEED:'1',ACADEMY_TEST_PDFS:'1'},timeout:30000});
 const page=await application.firstWindow();page.setDefaultTimeout(20000);
 const login=async role=>{await page.locator(`[data-demo="${role}"]`).click();await page.locator('#login-form button[type=submit]').click();await page.waitForSelector('#app:not([hidden]) .center');await page.waitForFunction(()=>!document.body.classList.contains('working'));};
 await login('instructor');
 const {id}=await page.evaluate(async()=>{const list=await window.academy.request('/v1/subjects');return window.academy.request(`/v1/subjects/${list.value.subjects[0].id}/items`,{method:'POST',body:{kind:'material',material_mode:'file',title:'Private PDF fixture',body:'Read inside Academy.',published:true}}).then(result=>result.value);});
 const database=join(directory,'local-test-workspace','academy.sqlite'),file=randomUUID(),bytes=fixturePdf();
 await mkdir(join(directory,'local-test-workspace','files'),{recursive:true});await writeFile(join(directory,'local-test-workspace','files',file+'.pdf'),bytes);
 const db=new DatabaseSync(database);db.prepare('UPDATE items SET file_ref=?,file_sha256=?,file_bytes=? WHERE id=?').run(file,createHash('sha256').update(bytes).digest('hex'),bytes.length,id);db.close();
 await page.locator('[data-action=logout]').click();await login('student');
 await page.locator(`[data-item="${id}"] details.reading-entry > summary`).click();
 await page.locator(`[data-action="read-pdf"][data-id="${id}"]`).click();
 await page.getByText('Page 1 of 2',{exact:true}).waitFor();
 assert.ok(await page.locator('.pdf-reader canvas').evaluate(canvas=>canvas.width>0&&canvas.height>0));
 assert.equal(await page.locator('.pdf-reader a[download],.pdf-reader [data-action=download]').count(),0);
 await page.locator('.pdf-reader [data-next]').click();await page.getByText('Page 2 of 2',{exact:true}).waitFor();
 await page.locator('.pdf-reader [data-close]').click();
 const cancelled=await page.evaluate(async id=>{
  const opened=window.academyReader.open(id,1);
  await window.academyReader.close();await opened;
  return document.querySelectorAll('.pdf-reader').length;
 },id);
 assert.equal(cancelled,0,'closing during load must not reopen private content');
 await page.locator(`[data-action="read-pdf"][data-id="${id}"]`).click();
 await page.getByText('Page 1 of 2',{exact:true}).waitFor();
 // A revoked account must lose the next page, not continue using cached PDF bytes.
 const revoke=new DatabaseSync(database);revoke.prepare("UPDATE accounts SET status='suspended' WHERE role='student'").run();revoke.close();
 await page.locator('.pdf-reader [data-next]').click();await page.locator('#signin').waitFor({state:'visible'});
 assert.equal(await page.locator('.pdf-reader canvas').count(),0);
 console.log('PASS: native private PDF pages, no export controls, page-turn revocation');
}finally{await application?.close();await rm(directory,{recursive:true,force:true});}
