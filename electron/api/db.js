const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrator');
const { migrateFromJsonIfNeeded } = require('./json-migration');

const DATA_DIR = path.join(process.env.APPDATA || process.env.HOME, 'pdv-loja-roupas');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SQLITE_PATH = path.join(DATA_DIR, 'pdv.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const sqlite = new Database(SQLITE_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Cache of { table: [colname, ...] } populated after migrations run.
const columnsCache = {};
function loadColumns() {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  for (const { name } of tables) {
    const cols = sqlite.prepare(`PRAGMA table_info("${name}")`).all().map(r => r.name);
    columnsCache[name] = cols;
  }
}

function getColumns(table) {
  return columnsCache[table] || [];
}

// Coerce JS values to SQLite-compatible primitives. better-sqlite3 does not
// accept plain objects or booleans; we handle those explicitly.
function toSqlite(v) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function buildWhere(table, where) {
  const cols = getColumns(table);
  const parts = [];
  const params = [];
  for (const [k, v] of Object.entries(where || {})) {
    if (!cols.includes(k)) continue;
    if (v === null || v === undefined) {
      parts.push(`"${k}" IS NULL`);
    } else {
      parts.push(`"${k}" = ?`);
      params.push(toSqlite(v));
    }
  }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

function selectRows(table, where = {}) {
  const { sql, params } = buildWhere(table, where);
  return sqlite.prepare(`SELECT * FROM "${table}" ${sql}`).all(...params);
}

function insertRow(table, data) {
  const cols = getColumns(table);
  const entries = Object.entries(data).filter(([k]) => cols.includes(k));
  if (entries.length === 0) {
    throw new Error(`insert(${table}): nenhuma coluna válida em ${JSON.stringify(Object.keys(data))}`);
  }
  const names = entries.map(([k]) => `"${k}"`).join(',');
  const placeholders = entries.map(() => '?').join(',');
  const values = entries.map(([, v]) => toSqlite(v));
  const result = sqlite.prepare(`INSERT INTO "${table}" (${names}) VALUES (${placeholders})`).run(...values);
  return { lastInsertRowid: Number(result.lastInsertRowid) };
}

function updateRow(table, id, data) {
  const cols = getColumns(table);
  const entries = Object.entries(data).filter(([k]) => cols.includes(k) && k !== 'id');
  if (entries.length === 0) return false;
  const sets = entries.map(([k]) => `"${k}" = ?`).join(',');
  const values = entries.map(([, v]) => toSqlite(v));
  const result = sqlite.prepare(`UPDATE "${table}" SET ${sets} WHERE id = ?`).run(...values, Number(id));
  return result.changes > 0;
}

function deleteRow(table, id) {
  sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(Number(id));
}

// Serialized insert into log_acoes with hash-chain. Must be atomic relative to
// other log_acoes inserts so prev_hash is always the hash of the immediately
// preceding row.
const insertLogAcao = sqlite.transaction((data) => {
  const prev = sqlite.prepare('SELECT id, hash FROM log_acoes ORDER BY id DESC LIMIT 1').get();
  const prevHash = prev ? prev.hash : ZERO_HASH;

  const cols = getColumns('log_acoes');
  const record = {};
  for (const [k, v] of Object.entries(data)) {
    if (cols.includes(k) && k !== 'id' && k !== 'hash' && k !== 'prev_hash') {
      record[k] = v;
    }
  }

  // Insert without id — let SQLite assign, then patch hash fields so we can
  // use the actual id in the payload.
  const names = Object.keys(record);
  const placeholders = names.map(() => '?').join(',');
  const values = names.map(n => toSqlite(record[n]));
  // Placeholder hash (must satisfy NOT NULL + UNIQUE — use a random nonce).
  const nonce = crypto.randomBytes(32).toString('hex');
  const insertResult = sqlite.prepare(
    `INSERT INTO log_acoes (${names.map(n => `"${n}"`).join(',')}, prev_hash, hash) VALUES (${placeholders}, ?, ?)`
  ).run(...values, prevHash, nonce);

  const newId = Number(insertResult.lastInsertRowid);
  const payload = [
    newId,
    record.usuario_id || '',
    record.usuario_nome || '',
    record.acao || '',
    record.detalhes || '',
    record.criado_em || '',
    prevHash
  ].join('|');
  const hash = crypto.createHash('sha256').update(payload).digest('hex');

  sqlite.prepare('UPDATE log_acoes SET hash = ? WHERE id = ?').run(hash, newId);
  return { lastInsertRowid: newId };
});

// _data[table] = array of rows (SELECT *). Setting _data[table] = [rows] replaces
// the entire table atomically (used by backup/restore and wipe).
const dataProxy = new Proxy({}, {
  get(_t, table) {
    if (typeof table !== 'string') return undefined;
    if (!getColumns(table).length) return [];
    return sqlite.prepare(`SELECT * FROM "${table}"`).all();
  },
  set(_t, table, value) {
    if (typeof table !== 'string') return false;
    if (!Array.isArray(value)) return false;
    if (!getColumns(table).length) return false;
    const cols = getColumns(table);
    // FKs must be OFF because backup/restore replaces tables one at a time;
    // referencing rows from other tables are temporarily orphaned mid-restore.
    // The final consistency is the caller's responsibility.
    sqlite.pragma('foreign_keys = OFF');
    try {
      const replace = sqlite.transaction((rows) => {
        sqlite.prepare(`DELETE FROM "${table}"`).run();
        for (const row of rows) {
          const entries = Object.entries(row).filter(([k]) => cols.includes(k));
          if (!entries.length) continue;
          const names = entries.map(([k]) => `"${k}"`).join(',');
          const ph = entries.map(() => '?').join(',');
          const values = entries.map(([, v]) => toSqlite(v));
          sqlite.prepare(`INSERT INTO "${table}" (${names}) VALUES (${ph})`).run(...values);
        }
      });
      replace(value);
    } finally {
      sqlite.pragma('foreign_keys = ON');
    }
    return true;
  },
  has(_t, table) {
    return typeof table === 'string' && getColumns(table).length > 0;
  },
  ownKeys() {
    return Object.keys(columnsCache);
  },
  getOwnPropertyDescriptor(_t, table) {
    if (typeof table !== 'string') return undefined;
    if (!getColumns(table).length) return undefined;
    return { enumerable: true, configurable: true, value: dataProxy[table] };
  }
});

const db = {
  _sqlite: sqlite,
  _data: dataProxy,

  _save() {
    // no-op: SQLite persists synchronously
  },

  init() {
    runMigrations(sqlite, MIGRATIONS_DIR);
    loadColumns();
    migrateFromJsonIfNeeded(sqlite, DATA_DIR, { toSqlite, getColumns });

    // Seed default admin user.
    const admin = sqlite.prepare("SELECT * FROM usuarios WHERE login = ? LIMIT 1").get('admin');
    if (!admin) {
      const hash = bcrypt.hashSync('admin123', 10);
      sqlite.prepare(
        `INSERT INTO usuarios (nome, login, senha_hash, cargo, ativo, criado_em)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run('Administrador', 'admin', hash, 'admin', 1, new Date().toISOString());
    } else {
      if (admin.ativo !== 1) {
        sqlite.prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?').run(admin.id);
      }
      if (!admin.senha_hash) {
        sqlite.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')
          .run(bcrypt.hashSync('admin123', 10), admin.id);
      }
    }
  },

  select(table, where = {}) {
    return selectRows(table, where);
  },

  findOne(table, where = {}) {
    const rows = selectRows(table, where);
    return rows.length > 0 ? rows[0] : null;
  },

  insert(table, data) {
    if (table === 'log_acoes') return insertLogAcao(data);
    return insertRow(table, data);
  },

  update(table, id, data) {
    if (table === 'log_acoes') return false;
    return updateRow(table, id, data);
  },

  delete(table, id) {
    if (table === 'log_acoes') return;
    deleteRow(table, id);
  },

  // Expose SQLite transaction wrapper for callers that need atomicity across
  // multiple operations (POST /vendas, backup restore, etc.).
  transaction(fn) {
    return sqlite.transaction(fn);
  },

  // Online SQLite backup. Safe to call while the DB is being written to —
  // SQLite's backup API handles WAL and ongoing transactions transparently.
  // Returns a Promise.
  backupTo(destPath) {
    return sqlite.backup(destPath);
  },

  verifyAuditChain() {
    const items = sqlite.prepare('SELECT * FROM log_acoes ORDER BY id ASC').all();
    const broken = [];
    let prev_hash = ZERO_HASH;
    for (const item of items) {
      const payload = [
        item.id,
        item.usuario_id || '',
        item.usuario_nome || '',
        item.acao || '',
        item.detalhes || '',
        item.criado_em || '',
        prev_hash
      ].join('|');
      const expected = crypto.createHash('sha256').update(payload).digest('hex');
      if (expected !== item.hash) {
        broken.push({ id: item.id, expected, actual: item.hash });
      }
      prev_hash = item.hash || '';
    }
    return { ok: broken.length === 0, broken, total: items.length };
  }
};

db.init();
module.exports = db;
