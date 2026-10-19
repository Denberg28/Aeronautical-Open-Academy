import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const db=new DatabaseSync(path);
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>1){db.close();throw new Error('Database version is newer than this server. Restore a compatible server; do not downgrade data silently.');}
  db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  db.exec('PRAGMA busy_timeout=5000;');
  if(path!==':memory:')chmodSync(path,0o600);
  return db;
}
