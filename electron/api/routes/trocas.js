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
      const produto = produtos.find(p => p.id === t.produto_id);
      const novoProduto = produtos.find(p => p.id === t.novo_produto_id);
      return {
        ...t,
        produto_nome: produto ? produto.nome : '',
        novo_produto_nome: novoProduto ? novoProduto.nome : '',
        cliente_nome: (clientes.find(c => c.id === (venda ? venda.cliente_id : null)) || {}).nome || '-',
        usuario_nome: (usuarios.find(u => u.id === t.usuario_id) || {}).nome || '',
        venda_data: venda ? venda.data : ''
      };
    }).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(result);
  });

  // Criar troca
  router.post('/trocas', (req, res) => {
    const { venda_id, produto_id, estoque_id, quantidade, motivo, tipo, novo_produto_id, novo_estoque_id, observacao, usuario_id } = req.body;

    const now = new Date().toISOString();
    const result = db.insert('trocas', {
      venda_id: venda_id || null,
      produto_id,
      estoque_id: estoque_id || null,
      quantidade: quantidade || 1,
      motivo,
      tipo: tipo || 'troca',
      novo_produto_id: novo_produto_id || null,
      novo_estoque_id: novo_estoque_id || null,
      observacao: observacao || '',
      status: 'pendente',
      usuario_id: usuario_id || null,
      criado_em: now
    });

    const troca = db.findOne('trocas', { id: result.lastInsertRowid });
    res.json(troca);
  });

  // Atualizar status da troca
  router.put('/trocas/:id', (req, res) => {
    const { status, observacao, novo_estoque_id } = req.body;
    const troca = db.findOne('trocas', { id: Number(req.params.id) });
    if (!troca) return res.status(404).json({ error: 'Troca não encontrada' });

    const updateData = {};
    if (status) updateData.status = status;
    if (observacao !== undefined) updateData.observacao = observacao;
    if (novo_estoque_id !== undefined) updateData.novo_estoque_id = novo_estoque_id;

    if (status === 'concluida' && troca.status !== 'concluida') {
      const now = new Date().toISOString();
      updateData.concluida_em = now;

      // Find original sale item to determine correct estoque_id and qty
      const vendaItens = db.select('venda_itens');
      let itemOriginal = null;
      if (troca.estoque_id) {
        itemOriginal = vendaItens.find(vi => vi.venda_id === troca.venda_id && vi.estoque_id === troca.estoque_id);
      }
      if (!itemOriginal) {
        itemOriginal = vendaItens.find(vi => vi.venda_id === troca.venda_id && vi.produto_id === troca.produto_id);
      }

      const qtdTroca = Number(troca.quantidade) || (itemOriginal ? itemOriginal.quantidade : 1);
      const estoqueIdAlvo = troca.estoque_id || (itemOriginal ? itemOriginal.estoque_id : null);

      // 1) Always restore stock of the returned item (both devolucao and troca)
      if (estoqueIdAlvo) {
        const estItem = db.findOne('estoque', { id: estoqueIdAlvo });
        if (estItem) {
          db.update('estoque', estoqueIdAlvo, { quantidade: (estItem.quantidade || 0) + qtdTroca });
          db.insert('estoque_movimentacoes', {
            estoque_id: estoqueIdAlvo,
            tipo: 'entrada',
            quantidade: qtdTroca,
            motivo: `${troca.tipo === 'devolucao' ? 'Devolução' : 'Troca'} #${troca.id}`,
            usuario_id: troca.usuario_id,
            criado_em: now
          });
        }
      }

      // 2) For devolucao, compute refund value
      if (troca.tipo === 'devolucao') {
        updateData.valor_devolvido = itemOriginal ? itemOriginal.preco_unitario * qtdTroca : 0;
      }

      // 3) For troca, decrement the NEW item given to the customer
      if (troca.tipo === 'troca') {
        const novoEstId = novo_estoque_id || troca.novo_estoque_id;
        if (novoEstId) {
          const estNovo = db.findOne('estoque', { id: Number(novoEstId) });
          if (estNovo) {
            if (estNovo.quantidade < qtdTroca) {
              return res.status(400).json({ error: `Estoque insuficiente no item de troca. Disponível: ${estNovo.quantidade}, necessário: ${qtdTroca}` });
            }
            db.update('estoque', estNovo.id, { quantidade: estNovo.quantidade - qtdTroca });
            db.insert('estoque_movimentacoes', {
              estoque_id: estNovo.id,
              tipo: 'saida',
              quantidade: qtdTroca,
              motivo: `Troca #${troca.id} (item entregue)`,
              usuario_id: troca.usuario_id,
              criado_em: now
            });
          }
        } else if (troca.novo_produto_id) {
          // Fallback: pick first available stock of novo_produto_id
          const estNovo = db.select('estoque').find(e => e.produto_id === troca.novo_produto_id && e.quantidade >= qtdTroca);
          if (estNovo) {
            db.update('estoque', estNovo.id, { quantidade: estNovo.quantidade - qtdTroca });
            updateData.novo_estoque_id = estNovo.id;
            db.insert('estoque_movimentacoes', {
              estoque_id: estNovo.id,
              tipo: 'saida',
              quantidade: qtdTroca,
              motivo: `Troca #${troca.id} (item entregue)`,
              usuario_id: troca.usuario_id,
              criado_em: now
            });
          }
        }
      }

      // 4) Audit log
      const user = troca.usuario_id ? db.findOne('usuarios', { id: troca.usuario_id }) : null;
      const produto = db.findOne('produtos', { id: troca.produto_id });
      db.insert('log_acoes', {
        usuario_id: troca.usuario_id || null,
        usuario_nome: user ? user.nome : 'Sistema',
        acao: troca.tipo === 'devolucao' ? 'Devolução Concluída' : 'Troca Concluída',
        detalhes: `${produto ? produto.nome : `Produto #${troca.produto_id}`} | Qtd: ${qtdTroca} | Venda #${troca.venda_id}`,
        criado_em: now
      });
    }

    db.update('trocas', req.params.id, updateData);

    const updated = db.findOne('trocas', { id: Number(req.params.id) });
    res.json(updated);
  });

  return router;
};
