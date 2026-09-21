import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env.js';

// Development-only driver. Writes to a local folder — never used in
// production (Section 19/21: no persistent filesystem on Vercel).
export async function save(buffer, { fileName, candidateId }) {
  const dir = path.resolve(env.uploadDir, candidateId);
  await fs.mkdir(dir, { recursive: true });

  const safeName = `${Date.now()}-${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fullPath = path.join(dir, safeName);
  await fs.writeFile(fullPath, buffer);

  return {
    storageKey: path.join(candidateId, safeName).replace(/\\/g, '/'),
    storageUrl: null,
  };
}

export async function read(storageKey) {
  const fullPath = path.resolve(env.uploadDir, storageKey);
  return fs.readFile(fullPath);
}
