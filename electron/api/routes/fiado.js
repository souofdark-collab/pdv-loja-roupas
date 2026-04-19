const express = require('express');
const { validate, FiadoPagamentoSchema } = require('../validation');

module.exports = (db) => {
  const router = express.Router();

  const isFiado = (fp) => /fiado|crediario|crediário/i.test(String(fp || ''));

  router.get('/fiado/clientes', (req, res) => {
    const vendas = db.select('vendas').filter(v => isFiado(v.forma_pagamento) && v.status === 'finalizada' && Number(v.saldo_devedor || 0) > 0);
    const clientes = db.select('clientes');
    const map = new Map();
    for (const v of vendas) {
      if (!v.cliente_id) continue;
      const prev = map.get(v.cliente_id) || { cliente_id: v.cliente_id, total_aberto: 0, qtd_vendas: 0 };
      prev.total_aberto += Number(v.saldo_devedor || 0);
      prev.qtd_vendas += 1;
      map.set(v.cliente_id, prev);
    }
    const result = Array.from(map.values()).map(x => ({
      ...x,
      cliente_nome: (clientes.find(c => c.id === x.cliente_id) || {}).nome || '',
      telefone: (clientes.find(c => c.id === x.cliente_id) || {}).telefone || ''
    })).sort((a, b) => b.total_aberto - a.total_aberto);
    res.json(result);
  });

  router.get('/fiado/cliente/:cliente_id', (req, res) => {
    const clienteId = Number(req.params.cliente_id);
    const vendas = db.select('vendas')
      .filter(v => isFiado(v.forma_pagamento) && v.cliente_id === clienteId && v.status === 'finalizada')
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    const pagamentos = db.select('fiado_pagamentos').filter(p => p.cliente_id === clienteId);
    res.json({ vendas, pagamentos });
  });

  router.post('/fiado/pagamento', validate(FiadoPagamentoSchema), (req, res) => {
    const { venda_id, valor, forma_pagamento, usuario_id, observacao } = req.body;
    const venda = db.findOne('vendas', { id: venda_id });
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
    if (!isFiado(venda.forma_pagamento)) return res.status(400).json({ error: 'Venda não é fiado' });
    const valorNum = valor;
    const saldoAtual = Number(venda.saldo_devedor || venda.total);
    if (valorNum > saldoAtual + 0.001) return res.status(400).json({ error: `Valor maior que saldo devedor (R$ ${saldoAtual.toFixed(2)})` });

    const now = new Date().toISOString();
    db.insert('fiado_pagamentos', {
      venda_id: venda.id,
      cliente_id: venda.cliente_id,
      valor: valorNum,
      forma_pagamento: forma_pagamento || 'dinheiro',
      usuario_id: usuario_id || null,
      observacao: observacao || '',
      criado_em: now
    });
    const novoSaldo = Math.max(0, saldoAtual - valorNum);
    db.update('vendas', venda.id, { saldo_devedor: novoSaldo });

    const u = usuario_id ? db.findOne('usuarios', { id: usuario_id }) : null;
    db.insert('log_acoes', {
      usuario_id: usuario_id || null,
      usuario_nome: u ? u.nome : 'Desconhecido',
      acao: 'Pagamento Fiado',
      detalhes: `Venda #${venda.id} | Valor: R$ ${valorNum.toFixed(2)} | Saldo: R$ ${novoSaldo.toFixed(2)}`,
      criado_em: now
    });

    res.json({ ok: true, novo_saldo: novoSaldo });
  });

  return router;
};
