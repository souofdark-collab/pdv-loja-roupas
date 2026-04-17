const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/categorias', (req, res) => {
    res.json(db.select('categorias').sort((a, b) => a.nome.localeCompare(b.nome)));
  });

  router.post('/categorias', (req, res) => {
    const { nome, descricao } = req.body;
    const result = db.insert('categorias', { nome, descricao: descricao || '' });
    res.json({ id: result.lastInsertRowid, nome, descricao: descricao || '' });
  });

  router.put('/categorias/:id', (req, res) => {
    const { nome, descricao } = req.body;
    db.update('categorias', req.params.id, { nome, descricao: descricao || '' });
    res.json({ id: Number(req.params.id), nome, descricao: descricao || '' });
  });

  router.delete('/categorias/:id', (req, res) => {
    db.delete('categorias', req.params.id);
    res.json({ success: true });
  });

  return router;
};
