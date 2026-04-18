const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(process.env.APPDATA || process.env.HOME, 'pdv-loja-roupas');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TABLES = [
  'usuarios', 'clientes', 'categorias', 'produtos',
  'estoque', 'estoque_movimentacoes', 'vendas',
  'venda_itens', 'promocoes', 'promocoes_regras',
  'despesas_categorias', 'despesas',
  'configuracoes', 'formas_pagamento',
  'trocas', 'historico_precos', 'log_acoes', 'abertura_caixa',
  'fiado_pagamentos'
];

// In-memory storage
const db = {
  _data: {},
  _lastIds: {},
  _save(table) {
    const filePath = path.join(DATA_DIR, `${table}.json`);
    const tmpPath = filePath + '.tmp';
    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeSync(fd, JSON.stringify(this._data[table] || [], null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, filePath);
  },
  _load(table) {
    const file = path.join(DATA_DIR, `${table}.json`);
    if (fs.existsSync(file)) {
      try {
        this._data[table] = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        console.error(`[db] Arquivo ${table}.json corrompido, reiniciando tabela.`);
        this._data[table] = [];
        this._save(table);
      }
    } else {
      this._data[table] = [];
    }
    const items = this._data[table] || [];
    this._lastIds[table] = items.length > 0 ? Math.max(...items.map(i => Number(i.id) || 0)) : 0;
  },
  _nextId(table) {
    const items = this._data[table] || [];
    const fromData = items.length > 0 ? Math.max(...items.map(i => Number(i.id) || 0)) : 0;
    const next = Math.max(fromData, this._lastIds[table] || 0) + 1;
    this._lastIds[table] = next;
    return next;
  },
  init() {
    for (const table of TABLES) {
      this._load(table);
    }
    // Seal pre-existing log_acoes entries missing hash (one-time migration)
    const logs = this._data.log_acoes || [];
    let needsSeal = false;
    let prev_hash = '0000000000000000000000000000000000000000000000000000000000000000';
    for (const item of logs) {
      if (!item.hash) {
        const payload = [item.id, item.usuario_id || '', item.usuario_nome || '', item.acao || '', item.detalhes || '', item.criado_em || '', prev_hash].join('|');
        item.prev_hash = prev_hash;
        item.hash = crypto.createHash('sha256').update(payload).digest('hex');
        needsSeal = true;
      }
      prev_hash = item.hash;
    }
    if (needsSeal) this._save('log_acoes');
    // Create default admin user
    const adminExists = this._data.usuarios?.find(u => u.login === 'admin');
    if (!adminExists) {
      const hash = bcrypt.hashSync('admin123', 10);
      this._data.usuarios.push({
        id: 1, nome: 'Administrador', login: 'admin',
        senha_hash: hash, cargo: 'admin', ativo: 1,
        criado_em: new Date().toISOString()
      });
      this._save('usuarios');
    } else {
      let changed = false;
      if (adminExists.ativo !== 1) { adminExists.ativo = 1; changed = true; }
      if (!adminExists.senha_hash) { adminExists.senha_hash = bcrypt.hashSync('admin123', 10); changed = true; }
      if (changed) this._save('usuarios');
    }
  },
  // Query helpers
  select(table, where = {}) {
    let items = this._data[table] || [];
    for (const [key, value] of Object.entries(where)) {
      items = items.filter(i => i[key] === value);
    }
    return items;
  },
  findOne(table, where = {}) {
    const items = this.select(table, where);
    return items.length > 0 ? items[0] : null;
  },
  insert(table, data) {
    const id = this._nextId(table);
    let record = { id, ...data };
    if (table === 'log_acoes') {
      const items = this._data[table] || [];
      const prev = items.length > 0 ? items[items.length - 1] : null;
      const prev_hash = prev ? (prev.hash || '') : '0000000000000000000000000000000000000000000000000000000000000000';
      const payload = [id, record.usuario_id || '', record.usuario_nome || '', record.acao || '', record.detalhes || '', record.criado_em || '', prev_hash].join('|');
      const hash = crypto.createHash('sha256').update(payload).digest('hex');
      record = { ...record, prev_hash, hash };
    }
    if (!this._data[table]) this._data[table] = [];
    this._data[table].push(record);
    this._save(table);
    return { lastInsertRowid: id };
  },
  update(table, id, data) {
    if (table === 'log_acoes') return false;
    const idx = (this._data[table] || []).findIndex(i => i.id === Number(id));
    if (idx === -1) return false;
    this._data[table][idx] = { ...this._data[table][idx], ...data };
    this._save(table);
    return true;
  },
  delete(table, id) {
    if (table === 'log_acoes') return;
    this._data[table] = (this._data[table] || []).filter(i => i.id !== Number(id));
    this._save(table);
  },
  verifyAuditChain() {
    const items = this._data.log_acoes || [];
    const broken = [];
    let prev_hash = '0000000000000000000000000000000000000000000000000000000000000000';
    for (const item of items) {
      const payload = [item.id, item.usuario_id || '', item.usuario_nome || '', item.acao || '', item.detalhes || '', item.criado_em || '', prev_hash].join('|');
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
