// Local database backup before each build-plan phase's migration
// (docs/implementation-plan.html, Phase 0). Needs no pg_dump or Docker —
// only Prisma, which the project already has.
//
//   node scripts/backup-db.mjs [label]        e.g. node scripts/backup-db.mjs before-p1
//
// Writes backups/<db>-<timestamp>-<label>/ (git-ignored — real candidate data):
//   schema.sql  full DDL of the live database (tables, enums, indexes, FKs)
//   data.json   every row of every table
// Restore onto a new, empty database with scripts/restore-db.mjs.
//
// Read-only: it never writes to the database.
import 'dotenv/config';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

// Neon's "-pooler" host → direct host, so Prisma's schema introspection
// gets a real session instead of PgBouncer.
const url = new URL(raw);
url.hostname = url.hostname.replace('-pooler.', '.');
url.searchParams.delete('pgbouncer');
const dbName = url.pathname.slice(1);

const label = (process.argv[2] || 'manual').replace(/[^a-z0-9_-]/gi, '-');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve('backups', `${dbName}-${stamp}-${label}`);
fs.mkdirSync(outDir, { recursive: true });

console.log(`Backing up ${url.hostname}/${dbName}\n  → ${outDir}\n`);

// 1. Schema — introspected from the live DB, not schema.prisma, so it
//    matches what's really there.
const prismaCli = path.resolve('node_modules', 'prisma', 'build', 'index.js');
const diff = spawnSync(
  process.execPath,
  [prismaCli, 'migrate', 'diff', '--from-empty', '--to-url', url.toString(), '--script'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
if (diff.status !== 0 || !diff.stdout.includes('CREATE TABLE')) {
  console.error('Schema export FAILED:\n', diff.stderr || diff.stdout);
  process.exit(1);
}
fs.writeFileSync(path.join(outDir, 'schema.sql'), diff.stdout);
console.log(`schema.sql  ${(diff.stdout.match(/CREATE TABLE/g) || []).length} tables`);

// 2. Data — one JSON array per table. bytea comes out as "\x…" hex text,
//    which json_populate_recordset reads straight back on restore.
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name`);

  const data = {};
  const counts = {};
  for (const { table_name: t } of tables) {
    const [{ rows }] = await prisma.$queryRawUnsafe(
      `SELECT coalesce(json_agg(x), '[]'::json)::text AS rows FROM "${t}" x`
    );
    data[t] = JSON.parse(rows);
    counts[t] = data[t].length;

    // Proves every row converts back into this table's column types
    // (enums, arrays, json, bytea, timestamps) — a pure SELECT, writes nothing.
    const [{ n }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM json_populate_recordset(null::"${t}", $1::json)`,
      rows
    );
    if (n !== counts[t]) throw new Error(`${t}: re-read ${n} rows, expected ${counts[t]}`);
    console.log(`data.json   ${t.padEnd(24)} ${String(counts[t]).padStart(5)} rows`);
  }

  const meta = { createdAt: new Date().toISOString(), host: url.hostname, database: dbName, label, counts };
  fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify({ meta, tables: data }));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sizeKb = (fs.statSync(path.join(outDir, 'data.json')).size / 1024).toFixed(1);
  console.log(`\nBackup saved: ${total} rows in ${tables.length} tables (${sizeKb} KB)\n  ${outDir}`);
} catch (err) {
  console.error('\nData export FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
