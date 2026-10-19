import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DriveMaterials } from '../src/materials.mjs';

// Generated test-only key; no service account credential is stored in source.
const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const credentials={client_email:'fixture@example.test',private_key:key};
test('Drive token/upload stay server-side, stream bytes, and preserve private references',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-drive-test-')),path=join(directory,'sample.pdf'),pdf=Buffer.from('%PDF-1.4\nfixture\n%%EOF');await writeFile(path,pdf);const seen=[];
 const driver=new DriveMaterials(credentials,'approvedFolder12345',async(url,options)=>{
  seen.push({url:String(url),options});
  if(String(url)==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture-token',expires_in:3600});
  if(String(url).includes('uploadType=resumable')){const metadata=JSON.parse(options.body);assert.deepEqual(metadata.parents,['approvedFolder12345']);assert.ok(!('permissions'in metadata));return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture'}});}
  if(options.method==='PUT'){const parts=[];for await(const chunk of options.body)parts.push(chunk);assert.deepEqual(Buffer.concat(parts),pdf);return Response.json({id:'privateDriveFile12345'});}
  return new Response(pdf,{headers:{'Content-Length':String(pdf.length)}});
 });
 try{
  const ref=await driver.put(path,randomUUID(),pdf.length);assert.equal(ref,'privateDriveFile12345');
  const chunks=[];for await(const chunk of await driver.get(ref))chunks.push(chunk);assert.deepEqual(Buffer.concat(chunks),pdf);
  assert.equal(seen.filter(x=>x.url==='https://oauth2.googleapis.com/token').length,1);
  assert.ok(seen.filter(x=>x.url.includes('googleapis.com/')).every(x=>x.options.redirect==='error'));
  assert.equal(seen[1].options.headers.Authorization,'Bearer fixture-token');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('Drive upload cannot redirect a server credential to an unapproved host',async()=>{
 const driver=new DriveMaterials(credentials,'approvedFolder12345',async url=>String(url)==='https://oauth2.googleapis.com/token'?Response.json({access_token:'fixture-token'}):new Response(null,{status:200,headers:{location:'https://evil.example/upload'}}));
 await assert.rejects(()=>driver.put('/unused',randomUUID(),10),e=>e.status===502&&e.message==='Invalid Drive upload destination.');
});
