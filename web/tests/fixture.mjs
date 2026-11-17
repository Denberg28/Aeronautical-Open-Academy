// Isolated loopback fixture, never a production startup/default account.
import { createAcademy } from '../../server/src/server.mjs';
import { LocalMaterials } from '../../server/src/materials.mjs';
import { join } from 'node:path';

const app = await createAcademy({
  dbPath: join(process.argv[2], 'test.sqlite'),
  materials: new LocalMaterials(join(process.argv[2], 'files')),
  bootstrap: {email: 'admin@example.test', name: 'Test administrator', password: 'Private portal fixture password!'},
  scryptN: 16384,
});
app.server.listen(0, '127.0.0.1', () => console.log(app.server.address().port));
process.once('SIGTERM', async () => { await app.close(); process.exit(0); });
