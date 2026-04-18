const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/auditoria', (req, res) => {
    const { limit = 200 } = req.query;
    const logs = db.select('log_acoes')
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .slice(0, Number(limit));
    res.json(logs);
  });

  router.post('/auditoria', (req, res) => {
    const { usuario_id, usuario_nome, acao, detalhes } = req.body;
    const result = db.insert('log_acoes', {
      usuario_id: usuario_id || null,
      usuario_nome: usuario_nome || 'Sistema',
      acao,
      detalhes: detalhes || '',
      criado_em: new Date().toISOString()
    });
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/auditoria/verificar', (req, res) => {
    const result = db.verifyAuditChain();
    res.json(result);
  });

  return router;
};
