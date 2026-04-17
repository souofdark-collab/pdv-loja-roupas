const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Listar trocas
  router.get('/trocas', (req, res) => {
    const trocas = db.select('trocas');
    const vendas = db.select('vendas');
    const clientes = db.select('clientes');
    const produtos = db.select('produtos');
    const usuarios = db.select('usuarios');

    const result = trocas.map(t => {
      const venda = vendas.find(v => v.id === t.venda_id);
      return {
        ...t,
        cliente_nome: (clientes.find(c => c.id === (venda ? venda.cliente_id : null)) || {}).nome || '-',
        usuario_nome: (usuarios.find(u => u.id === t.usuario_id) || {}).nome || '',
        venda_data: venda ? venda.data : ''
      };
    }).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(result);
  });

  // Criar troca
  router.post('/trocas', (req, res) => {
    const { venda_id, produto_id, motivo, tipo, novo_produto_id, observacao, usuario_id } = req.body;

    const now = new Date().toISOString();
    const result = db.insert('trocas', {
      venda_id: venda_id || null,
      produto_id,
      motivo,
      tipo: tipo || 'troca', // 'troca' or 'devolucao'
      novo_produto_id: novo_produto_id || null,
      observacao: observacao || '',
      status: 'pendente', // 'pendente', 'concluida', 'recusada'
      usuario_id: usuario_id || null,
      criado_em: now
    });

    const troca = db.findOne('trocas', { id: result.lastInsertRowid });
    res.json(troca);
  });

  // Atualizar status da troca
  router.put('/trocas/:id', (req, res) => {
    const { status, observacao } = req.body;
    const troca = db.findOne('trocas', { id: Number(req.params.id) });
    if (!troca) return res.status(404).json({ error: 'Troca não encontrada' });

    const updateData = {};
    if (status) updateData.status = status;
    if (observacao !== undefined) updateData.observacao = observacao;

    if (status === 'concluida') {
      const now = new Date().toISOString();
      updateData.concluida_em = now;

      if (troca.tipo === 'devolucao') {
        // Calculate refund value from the original sale item
        const vendaItens = db.select('venda_itens');
        const item = vendaItens.find(vi => vi.venda_id === troca.venda_id && vi.produto_id === troca.produto_id);
        updateData.valor_devolvido = item ? item.preco_unitario * item.quantidade : 0;

        // Restore stock for the returned product
        const estoqueItem = db.select('estoque').find(e => e.produto_id === troca.produto_id);
        if (estoqueItem) {
          const qtdRestaurada = item ? item.quantidade : 1;
          db.update('estoque', estoqueItem.id, { quantidade: estoqueItem.quantidade + qtdRestaurada });
          db.insert('estoque_movimentacoes', {
            estoque_id: estoqueItem.id,
            tipo: 'entrada',
            quantidade: qtdRestaurada,
            motivo: `Devolução #${troca.id}`,
            usuario_id: troca.usuario_id,
            criado_em: now
          });
        }
      }

      if (troca.tipo === 'troca' && troca.novo_produto_id) {
        // Decrement stock of new product given to customer
        const estoqueNovo = db.select('estoque').find(e => e.produto_id === troca.novo_produto_id && e.quantidade > 0);
        if (estoqueNovo) {
          db.update('estoque', estoqueNovo.id, { quantidade: estoqueNovo.quantidade - 1 });
        }
        // Restore stock of returned product
        const estoqueDevolvido = db.select('estoque').find(e => e.produto_id === troca.produto_id);
        if (estoqueDevolvido) {
          db.update('estoque', estoqueDevolvido.id, { quantidade: estoqueDevolvido.quantidade + 1 });
        }
      }
    }

    db.update('trocas', req.params.id, updateData);

    const updated = db.findOne('trocas', { id: Number(req.params.id) });
    res.json(updated);
  });

  return router;
};
