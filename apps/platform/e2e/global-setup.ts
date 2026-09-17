import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const dbPath = path.join(root, 'e2e_casuya.db');

  process.chdir(root);
  process.env.JWT_SECRET ||= 'ci-e2e-only-jwt-secret-value-0123456789abcdefgh';
  process.env.DATABASE_URL = `sqlite:///${dbPath.replace(/\\/g, '/')}`;
  process.env.STORAGE_ROOT = path.join(root, 'storage-e2e');
  process.env.REDIS_URL ||= 'redis://127.0.0.1:6379/15';

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  execSync('python -m database.seeds.seed_dev_data', {
    stdio: 'inherit',
    env: process.env,
  });
}
