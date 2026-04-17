const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Default payment methods
  const defaultPagamentos = [
    { id: 1, nome: 'Dinheiro', ativa: 1, ordem: 1 },
    { id: 2, nome: 'Cartão Débito', ativa: 1, ordem: 2 },
    { id: 3, nome: 'Cartão Crédito', ativa: 1, ordem: 3 },
    { id: 4, nome: 'PIX', ativa: 1, ordem: 4 }
  ];

  // Init default configs
  router.get('/configuracoes', (req, res) => {
    let configs = db.select('configuracoes');
    if (configs.length === 0) {
      db.insert('configuracoes', { chave: 'empresa_nome', valor: 'TS Concept PDV' });
      db.insert('configuracoes', { chave: 'empresa_cnpj', valor: '' });
      db.insert('configuracoes', { chave: 'empresa_contato', valor: '' });
      db.insert('configuracoes', { chave: 'empresa_email', valor: '' });
      db.insert('configuracoes', { chave: 'empresa_endereco', valor: '' });
      db.insert('configuracoes', { chave: 'empresa_logo', valor: '' });
      db.insert('configuracoes', { chave: 'tema', valor: 'dark' });
      db.insert('configuracoes', { chave: 'cor_accent', valor: '#E94560' });
      db.insert('configuracoes', { chave: 'cor_bg', valor: '#0F0F1A' });
      db.insert('configuracoes', { chave: 'cor_bg_secondary', valor: '#1A1A2E' });
      db.insert('configuracoes', { chave: 'cor_card', valor: '#16213E' });
      db.insert('configuracoes', { chave: 'cor_text', valor: '#EAEAEA' });
      db.insert('configuracoes', { chave: 'cor_btn', valor: '#E94560' });
      db.insert('configuracoes', { chave: 'cor_sombra', valor: '#E94560' });
      configs = db.select('configuracoes');
    }
    // Convert key-value pairs to object
    const result = {};
    configs.forEach(c => { result[c.chave] = c.valor; });
    res.json(result);
  });

  router.put('/configuracoes', (req, res) => {
    const data = req.body;
    for (const [chave, valor] of Object.entries(data)) {
      const existing = db.findOne('configuracoes', { chave });
      if (existing) {
        db.update('configuracoes', existing.id, { valor: String(valor) });
      } else {
        db.insert('configuracoes', { chave, valor: String(valor) });
      }
    }
    res.json({ success: true });
  });

  // Payment methods
  router.get('/formas-pagamento', (req, res) => {
    let pagamentos = db.select('formas_pagamento');
    if (pagamentos.length === 0) {
      for (const p of defaultPagamentos) {
        db.insert('formas_pagamento', p);
      }
      pagamentos = db.select('formas_pagamento');
    }
    pagamentos.sort((a, b) => a.ordem - b.ordem);
    res.json(pagamentos);
  });

  router.post('/formas-pagamento', (req, res) => {
    const data = { ...req.body, ativa: Number(req.body.ativa || 1) };
    const maxOrdem = db.select('formas_pagamento').reduce((max, p) => Math.max(max, p.ordem || 0), 0);
    data.ordem = maxOrdem + 1;
    const result = db.insert('formas_pagamento', data);
    res.json({ id: result.lastInsertRowid, ...data });
  });

  router.put('/formas-pagamento/:id', (req, res) => {
    db.update('formas_pagamento', req.params.id, { ...req.body, ativa: Number(req.body.ativa || 1) });
    res.json({ success: true });
  });

  router.delete('/formas-pagamento/:id', (req, res) => {
    db.delete('formas_pagamento', req.params.id);
    res.json({ success: true });
  });

  return router;
};
