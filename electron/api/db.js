const path = require('path');
const fs = require('fs');
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
  'trocas', 'historico_precos', 'log_acoes', 'abertura_caixa'
];

// In-memory storage
const db = {
  _data: {},
  _save(table) {
    const filePath = path.join(DATA_DIR, `${table}.json`);
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(this._data[table] || [], null, 2));
    fs.renameSync(tmpPath, filePath);
  },
  _load(table) {
    const file = path.join(DATA_DIR, `${table}.json`);
    if (fs.existsSync(file)) {
      this._data[table] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } else {
      this._data[table] = [];
    }
  },
  _nextId(table) {
    const items = this._data[table] || [];
    return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  },
  init() {
    for (const table of TABLES) {
      this._load(table);
    }
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
    const record = { id, ...data };
    if (!this._data[table]) this._data[table] = [];
    this._data[table].push(record);
    this._save(table);
    return { lastInsertRowid: id };
  },
  update(table, id, data) {
    const idx = (this._data[table] || []).findIndex(i => i.id === Number(id));
    if (idx === -1) return false;
    this._data[table][idx] = { ...this._data[table][idx], ...data };
    this._save(table);
    return true;
  },
  delete(table, id) {
    this._data[table] = (this._data[table] || []).filter(i => i.id !== Number(id));
    this._save(table);
  }
};

db.init();
module.exports = db;
