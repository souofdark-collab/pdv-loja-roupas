const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/clientes', (req, res) => {
    res.json(db.select('clientes').sort((a, b) => a.nome.localeCompare(b.nome)));
  });

  router.get('/clientes/buscar', (req, res) => {
    const { q } = req.query;
    const clientes = db.select('clientes').filter(c =>
      c.nome.toLowerCase().includes(q.toLowerCase()) ||
      (c.cpf && c.cpf.includes(q)) ||
      (c.telefone && c.telefone.includes(q))
    );
    res.json(clientes);
  });

  router.get('/clientes/:id', (req, res) => {
    const cliente = db.findOne('clientes', { id: Number(req.params.id) });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(cliente);
  });

  router.post('/clientes', (req, res) => {
    const { nome, cpf, telefone, email, endereco, criado_por_usuario_id } = req.body;
    const result = db.insert('clientes', { nome, cpf: cpf || '', telefone: telefone || '', email: email || '', endereco: endereco || '', criado_por_usuario_id: criado_por_usuario_id || null, criado_em: new Date().toISOString() });
    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  router.put('/clientes/:id', (req, res) => {
    const { nome, cpf, telefone, email, endereco } = req.body;
    db.update('clientes', req.params.id, { nome, cpf: cpf || '', telefone: telefone || '', email: email || '', endereco: endereco || '' });
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.delete('/clientes/:id', (req, res) => {
    db.delete('clientes', req.params.id);
    res.json({ success: true });
  });

  return router;
};
