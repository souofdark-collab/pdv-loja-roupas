const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/estoque', (req, res) => {
    const items = db.select('estoque');
    const produtos = db.select('produtos');
    const result = items.map(e => {
      const p = produtos.find(pr => pr.id === e.produto_id);
      return { ...e, produto_nome: p ? p.nome : '', codigo_barras: p ? p.codigo_barras : '' };
    });
    res.json(result);
  });

  router.get('/estoque/baixo', (req, res) => {
    const items = db.select('estoque').filter(e => e.quantidade <= e.minimo);
    const produtos = db.select('produtos');
    const result = items.map(e => {
      const p = produtos.find(pr => pr.id === e.produto_id);
      return { ...e, produto_nome: p ? p.nome : '' };
    });
    res.json(result.sort((a, b) => a.quantidade - b.quantidade));
  });

  router.get('/estoque/produto/:produtoId', (req, res) => {
    const items = db.select('estoque').filter(e => e.produto_id === Number(req.params.produtoId));
    res.json(items.sort((a, b) => (a.tamanho || '').localeCompare(b.tamanho || '')));
  });

  router.post('/estoque', (req, res) => {
    const { produto_id, tamanho, cor, quantidade, minimo } = req.body;
    const existing = db.select('estoque').find(e =>
      e.produto_id === produto_id && e.tamanho === tamanho && e.cor === cor
    );
    if (existing) {
      db.update('estoque', existing.id, { quantidade: existing.quantidade + (quantidade || 0), minimo: minimo || 5 });
      res.json(db.findOne('estoque', { id: existing.id }));
    } else {
      const result = db.insert('estoque', { produto_id, tamanho, cor, quantidade: quantidade || 0, minimo: minimo || 5 });
      res.json({ id: result.lastInsertRowid, ...req.body });
    }
  });

  router.put('/estoque/:id', (req, res) => {
    const { quantidade, minimo } = req.body;
    db.update('estoque', req.params.id, { quantidade, minimo });
    res.json(db.findOne('estoque', { id: Number(req.params.id) }));
  });

  router.delete('/estoque/:id', (req, res) => {
    db.delete('estoque', req.params.id);
    res.json({ success: true });
  });

  router.post('/estoque/movimentacao', (req, res) => {
    const { estoque_id, tipo, quantidade, motivo, usuario_id } = req.body;
    const result = db.insert('estoque_movimentacoes', { estoque_id, tipo, quantidade, motivo: motivo || '', usuario_id: usuario_id || null, criado_em: new Date().toISOString() });

    const item = db.findOne('estoque', { id: estoque_id });
    if (tipo === 'entrada') {
      db.update('estoque', estoque_id, { quantidade: item.quantidade + quantidade });
    } else if (tipo === 'saida') {
      db.update('estoque', estoque_id, { quantidade: item.quantidade - quantidade });
    } else if (tipo === 'ajuste') {
      db.update('estoque', estoque_id, { quantidade });
    }

    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  router.get('/estoque/movimentacoes', (req, res) => {
    const { estoque_id } = req.query;
    let movs = db.select('estoque_movimentacoes');
    if (estoque_id) movs = movs.filter(m => m.estoque_id === Number(estoque_id));
    movs.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    if (!estoque_id) movs = movs.slice(0, 100);
    res.json(movs);
  });

  return router;
};
