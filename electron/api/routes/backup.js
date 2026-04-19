const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const hashPayload = (data) => {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
};

const ALL_TABLES = [
  'usuarios', 'clientes', 'categorias', 'produtos',
  'estoque', 'estoque_movimentacoes', 'vendas',
  'venda_itens', 'promocoes', 'promocoes_regras',
  'despesas_categorias', 'despesas',
  'configuracoes', 'formas_pagamento',
  'trocas', 'historico_precos', 'log_acoes', 'abertura_caixa',
  'fiado_pagamentos'
];

const WIPE_TABLES = [
  'clientes', 'categorias', 'produtos', 'estoque', 'estoque_movimentacoes',
  'vendas', 'venda_itens', 'promocoes', 'promocoes_regras',
  'despesas_categorias', 'despesas', 'formas_pagamento',
  'trocas', 'historico_precos', 'log_acoes', 'abertura_caixa',
  'fiado_pagamentos'
];


module.exports = (db) => {
  const router = express.Router();

  // Export raw data from all tables (no computed fields)
  router.get('/backup/export', (req, res) => {
    const data = {};
    for (const table of ALL_TABLES) {
      data[table] = db._data[table] || [];
    }
    res.json({ version: '2.1', exportDate: new Date().toISOString(), data, integrity: hashPayload(data) });
  });

  // Direct restore endpoint — bypasses individual route validators (e.g. bcrypt on usuarios)
  router.post('/backup/restore', (req, res) => {
    const { data, integrity } = req.body;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Dados inválidos.' });
    if (integrity) {
      const expected = hashPayload(data);
      if (integrity !== expected) {
        return res.status(400).json({ error: 'Integridade do backup falhou. Arquivo corrompido ou modificado.' });
      }
    }
    try {
      // Each Proxy-set is atomic per table (DELETE+INSERT) and toggles FKs off
      // internally. A single outer transaction wouldn't help because PRAGMA
      // foreign_keys is silently ignored inside a transaction — so we accept
      // non-atomicity across tables here. If one table fails mid-restore, the
      // admin re-runs the import (operation is idempotent).
      for (const table of ALL_TABLES) {
        if (!data[table] || !Array.isArray(data[table])) continue;
        db._data[table] = data[table];
      }
      res.json({ success: true, integrity_verified: !!integrity });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/backup/wipe', (req, res) => {
    const { login, senha } = req.body;
    if (!login || !senha) return res.status(400).json({ error: 'Login e senha obrigatórios.' });

    const user = db.findOne('usuarios', { login: login.trim() });
    if (!user || !bcrypt.compareSync(senha, user.senha_hash)) {
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }

    // Only the original admin (lowest id among admins) can wipe
    const admins = db.select('usuarios').filter(u => u.cargo === 'admin').sort((a, b) => a.id - b.id);
    if (!admins.length || admins[0].id !== user.id) {
      return res.status(403).json({ error: 'Apenas o administrador principal pode realizar esta ação.' });
    }

    // Wipe all data tables
    for (const table of WIPE_TABLES) {
      db._data[table] = [];
    }

    // Keep only the original admin user
    db._data.usuarios = db._data.usuarios.filter(u => u.id === admins[0].id);

    res.json({ success: true });
  });

  return router;
};
