const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// Tables in insertion order (parents before children) so FKs hold.
const JSON_IMPORT_ORDER = [
  'usuarios',
  'clientes',
  'categorias',
  'produtos',
  'estoque',
  'despesas_categorias',
  'despesas',
  'formas_pagamento',
  'configuracoes',
  'promocoes',
  'promocoes_regras',
  'vendas',
  'venda_itens',
  'estoque_movimentacoes',
  'historico_precos',
  'trocas',
  'abertura_caixa',
  'log_acoes',
  'fiado_pagamentos'
];

// Coerce legacy string values to match the new INTEGER columns. Example:
// produtos.categoria_id was saved as "1" (string) in the JSON era; SQLite
// stores it as INTEGER now.
const INT_FIELDS = new Set([
  'id', 'produto_id', 'estoque_id', 'cliente_id', 'usuario_id', 'vendedor_id',
  'categoria_id', 'novo_produto_id', 'novo_estoque_id', 'venda_id',
  'criado_por_usuario_id', 'promocao_id', 'quantidade', 'minimo',
  'parcelas', 'ativo', 'ativa', 'ordem'
]);

function coerceRow(row) {
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (INT_FIELDS.has(k) && out[k] !== null && out[k] !== undefined && out[k] !== '') {
      const n = Number(out[k]);
      if (!Number.isNaN(n)) out[k] = n;
    }
  }
  return out;
}

// Trigger: at least one JSON table file exists AND every SQLite table we're
// about to populate is empty. This keeps the migration one-shot and safe to
// run every boot.
function migrateFromJsonIfNeeded(sqlite, dataDir, { toSqlite, getColumns }) {
  const anyJsonExists = JSON_IMPORT_ORDER.some(t => fs.existsSync(path.join(dataDir, `${t}.json`)));
  if (!anyJsonExists) return { migrated: false, reason: 'no-json-files' };

  const totalRows = JSON_IMPORT_ORDER.reduce((s, t) => {
    if (!getColumns(t).length) return s;
    return s + sqlite.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  }, 0);
  if (totalRows > 0) return { migrated: false, reason: 'sqlite-not-empty' };

  console.log('[db] Migrando dados JSON → SQLite (one-shot)...');
  const summary = {};

  const doImport = sqlite.transaction(() => {
    // FKs are checked at commit when deferred; better-sqlite3 triggers at each
    // statement by default. We briefly relax during import to tolerate parents
    // being inserted after children in legacy ordering.
    sqlite.pragma('foreign_keys = OFF');

    for (const table of JSON_IMPORT_ORDER) {
      const file = path.join(dataDir, `${table}.json`);
      if (!fs.existsSync(file)) continue;
      const cols = getColumns(table);
      if (!cols.length) continue;

      let rows;
      try {
        rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.warn(`[db] JSON ${table} inválido, ignorando:`, e.message);
        continue;
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        summary[table] = 0;
        continue;
      }

      let inserted = 0;
      for (const raw of rows) {
        const row = coerceRow(raw);
        const entries = Object.entries(row).filter(([k]) => cols.includes(k));
        if (!entries.length) continue;
        const names = entries.map(([k]) => `"${k}"`).join(',');
        const ph = entries.map(() => '?').join(',');
        const values = entries.map(([, v]) => toSqlite(v));
        try {
          sqlite.prepare(`INSERT INTO "${table}" (${names}) VALUES (${ph})`).run(...values);
          inserted++;
        } catch (e) {
          console.warn(`[db] ${table} row ${row.id} falhou:`, e.message);
        }
      }
      summary[table] = inserted;
    }

    // Re-seal log_acoes hash-chain in canonical id ASC order. The legacy JSON
    // file stored entries in arbitrary array order, so the imported hashes
    // don't match when replayed by id. From this migration onward every new
    // insert uses insertLogAcao which respects id order, so this re-seal is
    // a one-shot normalization.
    const rows = sqlite.prepare('SELECT * FROM log_acoes ORDER BY id ASC').all();
    let prev = ZERO_HASH;
    for (const row of rows) {
      const payload = [
        row.id,
        row.usuario_id || '',
        row.usuario_nome || '',
        row.acao || '',
        row.detalhes || '',
        row.criado_em || '',
        prev
      ].join('|');
      const hash = crypto.createHash('sha256').update(payload).digest('hex');
      sqlite.prepare('UPDATE log_acoes SET prev_hash = ?, hash = ? WHERE id = ?').run(prev, hash, row.id);
      prev = hash;
    }

    sqlite.pragma('foreign_keys = ON');
  });

  try {
    doImport();
  } catch (e) {
    sqlite.pragma('foreign_keys = ON');
    throw e;
  }

  // Rename JSON files to keep them as a safety net but prevent re-import.
  for (const table of JSON_IMPORT_ORDER) {
    const src = path.join(dataDir, `${table}.json`);
    const dst = path.join(dataDir, `${table}.json.pre-sqlite`);
    if (fs.existsSync(src)) {
      try { fs.renameSync(src, dst); } catch {}
    }
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  console.log(`[db] Migração concluída: ${total} registros em ${Object.keys(summary).length} tabelas.`);
  console.log('[db] Resumo:', summary);

  return { migrated: true, summary };
}

module.exports = { migrateFromJsonIfNeeded };
