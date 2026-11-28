import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAcademy } from '../src/server.mjs';

test('PC authentication budgets survive reopen without storing raw identities',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'academy-auth-budget-'));let app;
 const start=async()=>{app=await createAcademy({dbPath:join(directory,'test.sqlite'),bootstrap:{email:'admin@example.test',name:'Synthetic admin',password:'Synthetic private passphrase!'},scryptN:16384});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));};
 const bad=()=>fetch('http://127.0.0.1:'+app.server.address().port+'/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@example.test',password:'incorrect'})});
 try{
  await start();for(let index=0;index<5;index++)assert.equal((await bad()).status,401);
  await app.close();app=null;await start();
  for(let index=0;index<5;index++)assert.equal((await bad()).status,401);
  assert.equal((await bad()).status,429);
  const rows=app.db.prepare('SELECT * FROM security_limits').all();assert.ok(rows.length>=2);
  assert.ok(rows.every(row=>/^[a-f0-9]{64}$/.test(row.key_hash)));assert.ok(!JSON.stringify(rows).includes('admin@example.test'));
 }finally{await app?.close();await rm(directory,{recursive:true,force:true});}
});
