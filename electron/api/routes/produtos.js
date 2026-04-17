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

  router.get('/produtos/buscar', (req, res) => {
    const { q } = req.query;
    const produtos = db.select('produtos', { ativo: 1 }).filter(p =>
      p.nome.toLowerCase().includes((q || '').toLowerCase()) || (p.codigo_barras && p.codigo_barras.includes(q))
    );
    const categorias = db.select('categorias');
    const result = produtos.map(p => {
      const pCatId = typeof p.categoria_id === 'string' ? Number(p.categoria_id) : p.categoria_id;
      return { ...p, categoria_nome: (categorias.find(c => c.id === pCatId) || {}).nome || null };
    });
    res.json(result);
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
    if (codigo_barras) {
      const dup = db.select('produtos', { ativo: 1 }).find(p => p.codigo_barras === codigo_barras);
      if (dup) return res.status(400).json({ error: `Código de barras já cadastrado no produto "${dup.nome}"` });
    }
    const result = db.insert('produtos', { nome, descricao: descricao || '', preco_custo: preco_custo || 0, preco_venda: preco_venda || 0, codigo_barras: codigo_barras || '', categoria_id: categoria_id || null, ativo: 1, criado_em: new Date().toISOString() });
    db.insert('estoque', { produto_id: result.lastInsertRowid, tamanho: 'M', cor: 'Única', quantidade: 0, minimo: 5 });
    const { usuario_id: uid } = req.body;
    if (uid) {
      db.insert('log_acoes', {
        usuario_id: uid,
        usuario_nome: (db.findOne('usuarios', { id: uid }) || {}).nome || '',
        acao: 'Produto Cadastrado',
        detalhes: `${nome} | R$ ${preco_venda}`,
        criado_em: new Date().toISOString()
      });
    }
    res.json({ id: result.lastInsertRowid, ...req.body });
  });

  router.put('/produtos/:id', (req, res) => {
    const { nome, descricao, preco_custo, preco_venda, codigo_barras, categoria_id, ativo, usuario_id } = req.body;
    if (codigo_barras) {
      const dup = db.select('produtos', { ativo: 1 }).find(p => p.codigo_barras === codigo_barras && p.id !== Number(req.params.id));
      if (dup) return res.status(400).json({ error: `Código de barras já cadastrado no produto "${dup.nome}"` });
    }
    const atual = db.findOne('produtos', { id: Number(req.params.id) });
    if (atual && (Number(preco_custo) !== Number(atual.preco_custo) || Number(preco_venda) !== Number(atual.preco_venda))) {
      db.insert('historico_precos', {
        produto_id: Number(req.params.id),
        produto_nome: atual.nome,
        preco_custo_anterior: atual.preco_custo,
        preco_venda_anterior: atual.preco_venda,
        preco_custo_novo: preco_custo,
        preco_venda_novo: preco_venda,
        usuario_id: usuario_id || null,
        criado_em: new Date().toISOString()
      });
      if (usuario_id) {
        db.insert('log_acoes', {
          usuario_id,
          usuario_nome: (db.findOne('usuarios', { id: usuario_id }) || {}).nome || '',
          acao: 'Alteração de Preço',
          detalhes: `${atual.nome}: R$ ${atual.preco_venda} → R$ ${preco_venda}`,
          criado_em: new Date().toISOString()
        });
      }
    }
    db.update('produtos', req.params.id, { nome, descricao: descricao || '', preco_custo, preco_venda, codigo_barras: codigo_barras || '', categoria_id, ativo: ativo !== undefined ? ativo : 1 });
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.delete('/produtos/:id', (req, res) => {
    const p = db.findOne('produtos', { id: Number(req.params.id) });
    db.update('produtos', req.params.id, { ativo: 0 });
    const uid = req.body?.usuario_id;
    if (p) {
      db.insert('log_acoes', {
        usuario_id: uid || null,
        usuario_nome: uid ? (db.findOne('usuarios', { id: uid }) || {}).nome || '' : 'Sistema',
        acao: 'Produto Desativado',
        detalhes: p.nome,
        criado_em: new Date().toISOString()
      });
    }
    res.json({ success: true });
  });

  router.get('/produtos/:id/historico-precos', (req, res) => {
    const historico = db.select('historico_precos')
      .filter(h => h.produto_id === Number(req.params.id))
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    res.json(historico);
  });

  return router;
};
