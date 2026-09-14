// Sovereign Local Authentication — evaluation suite (launcher).
// Spawns the isolated child suite with a temp sovereign SQLite store and env
// vars set before imports, so the test never depends on ambient .env state.
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-auth-'));

const env = {
  ...process.env,
  SOVEREIGN_DATA_DIR: tmpDir,
  SOVEREIGN_ADMIN_EMAIL: 'admin@plant.local',
  SOVEREIGN_ADMIN_PASSWORD: 'AdminPass1234!',
  SOVEREIGN_ADMIN_NAME: 'Chief Admin',
  NODE_ENV: 'development',
  DEMO_MODE: '',
};

const child = path.join(__dirname, 'auth-suite-child.js');
const result = spawnSync(process.execPath, [child], { encoding: 'utf8', cwd: root, env });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.status || 0);