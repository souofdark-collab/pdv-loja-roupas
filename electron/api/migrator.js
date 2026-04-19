const fs = require('fs');
const path = require('path');

// Applies pending .sql files from electron/api/migrations in order.
// Each file is identified by its numeric prefix (e.g. 001_initial.sql → version 1).
// Applied versions are tracked in schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT).
function runMigrations(sqliteDb, migrationsDir) {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    sqliteDb.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^\d+_.*\.sql$/.test(f))
    .sort();

  const pending = [];
  for (const file of files) {
    const m = file.match(/^(\d+)_(.*)\.sql$/);
    if (!m) continue;
    const version = Number(m[1]);
    if (!applied.has(version)) {
      pending.push({ version, name: m[2], file });
    }
  }

  if (pending.length === 0) return { appliedNow: [] };

  const appliedNow = [];
  const applyAll = sqliteDb.transaction(() => {
    for (const mig of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, mig.file), 'utf8');
      sqliteDb.exec(sql);
      sqliteDb.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
      ).run(mig.version, mig.name, new Date().toISOString());
      appliedNow.push(mig);
    }
  });
  applyAll();

  return { appliedNow };
}

module.exports = { runMigrations };
