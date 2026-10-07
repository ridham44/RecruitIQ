// The demo dataset behind /live-demo. Build plan P9 replaced the original
// single-job demo set with the /recq agency-link demo — this command now runs
// scripts/seed-recq-demo.mjs (same flags):
//
//   node scripts/seed-demo.mjs           → create (skips if it already exists)
//   node scripts/seed-demo.mjs --reset   → remove the demo set, then recreate
//   add --yes to allow a non-local DATABASE_URL (dedicated demo DB only)
//
// Back the database up first (node scripts/backup-db.mjs before-demo).
await import('./seed-recq-demo.mjs');
