// Restores a backup made by scripts/backup-db.mjs onto a NEW, EMPTY database.
//
//   set RESTORE_DATABASE_URL=postgresql://…new-db…   (PowerShell: $env:RESTORE_DATABASE_URL="…")
//   node scripts/restore-db.mjs backups/<folder> [--data-only]
//
// 1. runs schema.sql on the target (skipped with --data-only, e.g. when the
//    tables were already created with `npx prisma db push`)
// 2. refuses to continue if any target table already has rows
// 3. inserts every table's rows in foreign-key order, in one transaction —
//    any error rolls back the whole data load
//
// The target is read from RESTORE_DATABASE_URL only, never DATABASE_URL, so
// it can't overwrite the live database by accident. Afterwards point
// DATABASE_URL in .env at the new database.
import 'dotenv/config';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const dir = process.argv[2];
const dataOnly = process.argv.includes('--data-only');
const target = process.env.RESTORE_DATABASE_URL;

if (!dir || !target) {
  console.error('Usage: RESTORE_DATABASE_URL=<new empty db> node scripts/restore-db.mjs backups/<folder> [--data-only]');
  process.exit(1);
}
if (process.env.DATABASE_URL && new URL(target).hostname.replace('-pooler.', '.') === new URL(process.env.DATABASE_URL).hostname.replace('-pooler.', '.') &&
    new URL(target).pathname === new URL(process.env.DATABASE_URL).pathname) {
  console.error('RESTORE_DATABASE_URL points at the same database as DATABASE_URL — refusing.');
  process.exit(1);
}

const { meta, tables } = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
console.log(`Restoring backup of ${meta.database} from ${meta.createdAt} (${meta.label})`);

const url = new URL(target);
url.hostname = url.hostname.replace('-pooler.', '.');

if (!dataOnly) {
  console.log('\n1. Creating schema from schema.sql…');
  const prismaCli = path.resolve('node_modules', 'prisma', 'build', 'index.js');
  const run = spawnSync(
    process.execPath,
    [prismaCli, 'db', 'execute', '--file', path.join(dir, 'schema.sql'), '--url', url.toString()],
    { stdio: 'inherit' }
  );
  if (run.status !== 0) {
    console.error('Schema creation FAILED — is the target database empty?');
    process.exit(1);
  }
}

const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  console.log('\n2. Checking target tables are empty…');
  for (const t of Object.keys(tables)) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`);
    if (n > 0) throw new Error(`target table "${t}" already has ${n} rows — restore only into an empty database`);
  }

  // Parents before children. Self-references are fine: Postgres checks
  // foreign keys at the end of each INSERT statement.
  const fks = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    WHERE c.contype = 'f' AND child.relname <> parent.relname`);
  const order = [];
  const pending = new Set(Object.keys(tables));
  while (pending.size) {
    const ready = [...pending].filter((t) => !fks.some((f) => f.child === t && pending.has(f.parent)));
    if (!ready.length) throw new Error(`foreign-key cycle between: ${[...pending].join(', ')}`);
    ready.sort().forEach((t) => { order.push(t); pending.delete(t); });
  }

  console.log('\n3. Loading data…');
  await prisma.$transaction(
    async (tx) => {
      for (const t of order) {
        const rows = tables[t];
        for (let i = 0; i < rows.length; i += 200) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "${t}" SELECT * FROM json_populate_recordset(null::"${t}", $1::json)`,
            JSON.stringify(rows.slice(i, i + 200))
          );
        }
        console.log(`   ${t.padEnd(24)} ${String(rows.length).padStart(5)} rows`);
      }
    },
    { timeout: 10 * 60 * 1000, maxWait: 60 * 1000 }
  );

  console.log('\nRestore complete. Now set DATABASE_URL in .env to the new database.');
} catch (err) {
  console.error('\nRestore FAILED (data load rolled back):', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
