import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// QA — independent native suites all report results; any failed suite still blocks delivery.
let failed=false;
for(const name of ['ui.mjs','motion.mjs','subject-delete.mjs','grading.mjs','parity.mjs','reader.mjs','schedule.mjs','access-control.mjs']){
 console.log(`Native Windows suite: ${name}`);
 const result=spawnSync(process.execPath,[resolve(import.meta.dirname,name)],{stdio:'inherit',env:process.env,timeout:180000});
 if(result.status!==0||result.error){failed=true;console.error(`FAILED ${name}:`,result.error?.message||`exit ${result.status}`);}
}
process.exitCode=failed?1:0;
