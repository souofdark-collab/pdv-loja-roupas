const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Abertura atual (sem fechamento)
  router.get('/caixa/atual', (req, res) => {
    const aberturas = db.select('abertura_caixa').filter(a => !a.fechado_em);
    const atual = aberturas.sort((a, b) => new Date(b.aberto_em) - new Date(a.aberto_em))[0] || null;
    if (atual) {
      const u = db.findOne('usuarios', { id: atual.usuario_id });
      res.json({ ...atual, usuario_nome: u ? u.nome : '' });
    } else {
      res.json(null);
    }
  });

  // Histórico de aberturas
  router.get('/caixa/historico', (req, res) => {
    const usuarios = db.select('usuarios');
    const historico = db.select('abertura_caixa')
      .map(a => ({ ...a, usuario_nome: (usuarios.find(u => u.id === a.usuario_id) || {}).nome || '' }))
      .sort((a, b) => new Date(b.aberto_em) - new Date(a.aberto_em))
      .slice(0, 50);
    res.json(historico);
  });

  // Abrir caixa
  router.post('/caixa/abertura', (req, res) => {
    const { usuario_id, valor_inicial, observacao } = req.body;
    // Fechar qualquer abertura em aberto
    db.select('abertura_caixa').filter(a => !a.fechado_em).forEach(a => {
      db.update('abertura_caixa', a.id, { fechado_em: new Date().toISOString(), observacao: 'Fechado automaticamente' });
    });
    const result = db.insert('abertura_caixa', {
      usuario_id,
      valor_inicial: valor_inicial || 0,
      aberto_em: new Date().toISOString(),
      fechado_em: null,
      observacao: observacao || ''
    });
    db.insert('log_acoes', {
      usuario_id,
      usuario_nome: (db.findOne('usuarios', { id: usuario_id }) || {}).nome || '',
      acao: 'Abertura de Caixa',
      detalhes: `Valor inicial: R$ ${Number(valor_inicial || 0).toFixed(2)}`,
      criado_em: new Date().toISOString()
    });
    res.json({ id: result.lastInsertRowid });
  });

  // Fechar caixa
  router.put('/caixa/fechamento/:id', (req, res) => {
    const { usuario_id, observacao } = req.body;
    db.update('abertura_caixa', req.params.id, {
      fechado_em: new Date().toISOString(),
      observacao: observacao || ''
    });
    db.insert('log_acoes', {
      usuario_id,
      usuario_nome: (db.findOne('usuarios', { id: usuario_id }) || {}).nome || '',
      acao: 'Fechamento de Caixa',
      detalhes: observacao || '',
      criado_em: new Date().toISOString()
    });
    res.json({ success: true });
  });

  return router;
};
