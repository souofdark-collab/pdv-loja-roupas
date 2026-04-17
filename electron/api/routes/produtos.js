const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/produtos', (req, res) => {
    const produtos = db.select('produtos', { ativo: 1 });
    const categorias = db.select('categorias');
    const result = produtos.map(p => {
      const pCatId = typeof p.categoria_id === 'string' ? Number(p.categoria_id) : p.categoria_id;
      return {
        ...p,
        categoria_nome: (categorias.find(c => c.id === pCatId) || {}).nome || null
      };
    });
    res.json(result.sort((a, b) => a.nome.localeCompare(b.nome)));
  });

  router.get('/produtos/:id', (req, res) => {
    const produto = db.findOne('produtos', { id: Number(req.params.id) });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    const pCatId = typeof produto.categoria_id === 'string' ? Number(produto.categoria_id) : produto.categoria_id;
    const cat = db.select('categorias').find(c => c.id === pCatId);
    res.json({ ...produto, categoria_nome: cat ? cat.nome : null });
  });

  router.post('/produtos', (req, res) => {
    const { nome, descricao, preco_custo, preco_venda, codigo_barras, categoria_id } = req.body;
    const result = db.insert('produtos', { nome, descricao: descricao || '', preco_custo: preco_custo || 0, preco_venda: preco_venda || 0, codigo_barras: codigo_barras || '', categoria_id: categoria_id || null, ativo: 1, criado_em: new Date().toISOString() });
    // Auto-create default stock entry for the product
    db.insert('estoque', { produto_id: result.lastInsertRowid, tamanho: 'M', cor: 'Única', quantidade: 0, minimo: 5 });
    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  router.put('/produtos/:id', (req, res) => {
    const { nome, descricao, preco_custo, preco_venda, codigo_barras, categoria_id, ativo } = req.body;
    db.update('produtos', req.params.id, { nome, descricao: descricao || '', preco_custo, preco_venda, codigo_barras: codigo_barras || '', categoria_id, ativo: ativo !== undefined ? ativo : 1 });
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.delete('/produtos/:id', (req, res) => {
    db.update('produtos', req.params.id, { ativo: 0 });
    res.json({ success: true });
  });

  router.get('/produtos/buscar', (req, res) => {
    const { q } = req.query;
    const produtos = db.select('produtos', { ativo: 1 }).filter(p =>
      p.nome.toLowerCase().includes(q.toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(q))
    );
    const categorias = db.select('categorias');
    const result = produtos.map(p => {
      const pCatId = typeof p.categoria_id === 'string' ? Number(p.categoria_id) : p.categoria_id;
      return {
        ...p,
        categoria_nome: (categorias.find(c => c.id === pCatId) || {}).nome || null
      };
    });
    res.json(result);
  });

  return router;
};
