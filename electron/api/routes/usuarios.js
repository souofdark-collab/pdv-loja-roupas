const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = (db) => {
  const router = express.Router();

  router.get('/usuarios', (req, res) => {
    const users = db.select('usuarios').map(u => {
      const { senha_hash, ...safe } = u;
      return safe;
    });
    res.json(users);
  });

  router.post('/usuarios', (req, res) => {
    const { nome, login, senha, cargo } = req.body;
    const hash = bcrypt.hashSync(senha, 10);
    const result = db.insert('usuarios', { nome, login, senha_hash: hash, cargo: cargo || 'caixa', ativo: 1, criado_em: new Date().toISOString() });
    res.json({ id: result.lastInsertRowid, nome, login, cargo: cargo || 'caixa' });
  });

  router.put('/usuarios/:id', (req, res) => {
    const { nome, login, cargo, ativo, senha } = req.body;
    const updates = { nome, login, cargo, ativo: ativo !== undefined ? ativo : 1 };
    if (senha) updates.senha_hash = bcrypt.hashSync(senha, 10);
    db.update('usuarios', req.params.id, updates);
    res.json({ id: Number(req.params.id), ...updates });
  });

  router.delete('/usuarios/:id', (req, res) => {
    db.update('usuarios', req.params.id, { ativo: 0 });
    res.json({ success: true });
  });

  return router;
};
