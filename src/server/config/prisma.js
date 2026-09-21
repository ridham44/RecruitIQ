import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Cache the client on `globalThis` so repeated serverless invocations (and
// dev hot-reloads) reuse one connection instead of exhausting the Postgres
// connection limit. Standard pattern for Prisma on Vercel/serverless.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.nodeEnv !== 'production') {
  globalForPrisma.__prisma = prisma;
}
