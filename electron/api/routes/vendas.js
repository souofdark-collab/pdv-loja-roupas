const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/vendas', (req, res) => {
    const { inicio, fim } = req.query;
    let vendas = db.select('vendas');
    if (inicio && fim) {
      vendas = vendas.filter(v => v.data >= inicio && v.data <= fim + 'T23:59:59');
    }
    const clientes = db.select('clientes');
    const usuarios = db.select('usuarios');
    const result = vendas.map(v => ({
      ...v,
      cliente_nome: (clientes.find(c => c.id === v.cliente_id) || {}).nome || null,
      usuario_nome: (usuarios.find(u => u.id === v.usuario_id) || {}).nome || ''
    }));
    result.sort((a, b) => new Date(b.data) - new Date(a.data));
    res.json(result);
  });

  router.get('/vendas/:id', (req, res) => {
    const venda = db.findOne('vendas', { id: Number(req.params.id) });
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    const clientes = db.select('clientes');
    const usuarios = db.select('usuarios');
    const itens = db.select('venda_itens').filter(i => i.venda_id === Number(req.params.id));
    const produtos = db.select('produtos');

    const itensComNome = itens.map(i => ({
      ...i,
      produto_nome: (produtos.find(p => p.id === i.produto_id) || {}).nome || ''
    }));

    res.json({
      ...venda,
      cliente_nome: (clientes.find(c => c.id === venda.cliente_id) || {}).nome || null,
      usuario_nome: (usuarios.find(u => u.id === venda.usuario_id) || {}).nome || '',
      itens: itensComNome
    });
  });

  router.put('/vendas/:id', (req, res) => {
    const { forma_pagamento, status, usuario_id, motivo_cancelamento } = req.body;
    const venda = db.findOne('vendas', { id: Number(req.params.id) });
    const updateData = { forma_pagamento: forma_pagamento || venda?.forma_pagamento, status };
    if (motivo_cancelamento) updateData.motivo_cancelamento = motivo_cancelamento;
    db.update('vendas', req.params.id, updateData);
    if (status === 'cancelada' && venda && venda.status !== 'cancelada') {
      const u = usuario_id ? db.findOne('usuarios', { id: usuario_id }) : null;
      db.insert('log_acoes', {
        usuario_id: usuario_id || null,
        usuario_nome: u ? u.nome : 'Desconhecido',
        acao: 'Cancelamento de Venda',
        detalhes: `Venda #${req.params.id} | Total: R$ ${Number(venda.total).toFixed(2)}${motivo_cancelamento ? ` | Motivo: ${motivo_cancelamento}` : ''}`,
        criado_em: new Date().toISOString()
      });
    }
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.post('/vendas', (req, res) => {
    const { cliente_id, usuario_id, vendedor_id, itens, forma_pagamento, desconto, parcelas } = req.body;

    if (!usuario_id) return res.status(400).json({ error: 'Usuário obrigatório' });
    if (!forma_pagamento) return res.status(400).json({ error: 'Forma de pagamento obrigatória' });
    if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });

    // Validate stock before writing anything
    for (const item of itens) {
      if (!item.estoque_id || !item.produto_id || !item.quantidade || item.quantidade <= 0) {
        return res.status(400).json({ error: 'Item de venda inválido' });
      }
      const estoqueItem = db.findOne('estoque', { id: item.estoque_id });
      if (!estoqueItem) {
        return res.status(400).json({ error: `Item de estoque #${item.estoque_id} não encontrado` });
      }
      if (estoqueItem.quantidade < item.quantidade) {
        const produto = db.findOne('produtos', { id: item.produto_id });
        return res.status(400).json({
          error: `Estoque insuficiente para "${produto ? produto.nome : 'produto #' + item.produto_id}". Disponível: ${estoqueItem.quantidade}, Solicitado: ${item.quantidade}`
        });
      }
    }

    let subtotal = 0;
    for (const item of itens) {
      subtotal += item.preco_unitario * item.quantidade;
    }
    const descontoVal = desconto || 0;
    const total = subtotal - descontoVal;

    const now = new Date().toISOString();
    const result = db.insert('vendas', {
      cliente_id: cliente_id || null, usuario_id, vendedor_id: vendedor_id || null,
      subtotal, desconto: descontoVal, total, forma_pagamento,
      parcelas: parcelas || null,
      status: 'finalizada', data: now
    });

    const vendaId = result.lastInsertRowid;

    for (const item of itens) {
      db.insert('venda_itens', {
        venda_id: vendaId,
        produto_id: item.produto_id,
        estoque_id: item.estoque_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto_item: item.desconto_item || 0
      });

      const estoqueItem = db.findOne('estoque', { id: item.estoque_id });
      if (estoqueItem) {
        db.update('estoque', item.estoque_id, { quantidade: estoqueItem.quantidade - item.quantidade });
      }

      db.insert('estoque_movimentacoes', {
        estoque_id: item.estoque_id,
        tipo: 'saida',
        quantidade: item.quantidade,
        motivo: `Venda #${vendaId}`,
        usuario_id,
        criado_em: now
      });
    }

    const u = db.findOne('usuarios', { id: usuario_id });
    db.insert('log_acoes', {
      usuario_id,
      usuario_nome: u ? u.nome : 'Desconhecido',
      acao: 'Nova Venda',
      detalhes: `Venda #${vendaId} | Total: R$ ${total.toFixed(2)} | ${itens.length} item(s) | ${forma_pagamento}`,
      criado_em: now
    });

    // Return full sale data
    const venda = db.findOne('vendas', { id: vendaId });
    const clientes = db.select('clientes');
    const produtos = db.select('produtos');
    const vendaItens = db.select('venda_itens').filter(i => i.venda_id === vendaId).map(i => ({
      ...i,
      produto_nome: (produtos.find(p => p.id === i.produto_id) || {}).nome || ''
    }));

    res.json({ ...venda, itens: vendaItens });
  });

  return router;
};
