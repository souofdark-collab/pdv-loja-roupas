const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // ===== CATEGORIAS =====

  router.get('/despesas-categorias', (req, res) => {
    res.json(db.select('despesas_categorias').sort((a, b) => a.nome.localeCompare(b.nome)));
  });

  router.post('/despesas-categorias', (req, res) => {
    const { nome, descricao } = req.body;
    const result = db.insert('despesas_categorias', { nome, descricao: descricao || '' });
    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  router.put('/despesas-categorias/:id', (req, res) => {
    const { nome, descricao } = req.body;
    db.update('despesas_categorias', req.params.id, { nome, descricao: descricao || '' });
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.delete('/despesas-categorias/:id', (req, res) => {
    db.delete('despesas_categorias', req.params.id);
    res.json({ success: true });
  });

  // ===== DESPESAS =====

  router.get('/despesas', (req, res) => {
    const despesas = db.select('despesas');
    const categorias = db.select('despesas_categorias');
    const result = despesas.map(d => ({
      ...d,
      categoria_nome: (categorias.find(c => c.id === Number(d.categoria_id)) || {}).nome || null
    }));
    res.json(result.sort((a, b) => (b.data || '').localeCompare(a.data || '')));
  });

  router.post('/despesas', (req, res) => {
    const { descricao, valor, categoria_id, recorrencia, vencimento } = req.body;
    const result = db.insert('despesas', {
      descricao,
      valor: valor || 0,
      categoria_id: categoria_id ? Number(categoria_id) : null,
      recorrencia: recorrencia || 'nenhuma',
      vencimento: vencimento || null,
      data: new Date().toISOString().split('T')[0],
      criado_em: new Date().toISOString()
    });
    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  router.put('/despesas/:id', (req, res) => {
    const { descricao, valor, categoria_id, recorrencia, vencimento } = req.body;
    db.update('despesas', req.params.id, { descricao, valor, categoria_id: categoria_id ? Number(categoria_id) : null, recorrencia, vencimento });
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.delete('/despesas/:id', (req, res) => {
    db.delete('despesas', req.params.id);
    res.json({ success: true });
  });

  return router;
};
