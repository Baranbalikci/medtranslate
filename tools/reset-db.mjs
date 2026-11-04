// Deletes the local SQLite database so the demo catalogue is re-seeded on next start.
import fs from 'node:fs';
import { config } from '../server/config.js';

for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffix, { force: true });
console.log(`Removed ${config.dbPath}. Start the server to re-seed the demo data.`);
