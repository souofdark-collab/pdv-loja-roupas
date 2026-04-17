const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/promocoes', (req, res) => {
    const promocoes = db.select('promocoes').sort((a, b) => new Date(b.inicio || 0) - new Date(a.inicio || 0));
    res.json(promocoes);
  });

  router.get('/promocoes/ativas', (req, res) => {
    const now = new Date().toISOString();
    const promocoes = db.select('promocoes').filter(p =>
      p.ativa === 1 && (!p.inicio || p.inicio <= now) && (!p.fim || p.fim >= now)
    ).sort((a, b) => a.nome.localeCompare(b.nome));
    res.json(promocoes);
  });

  router.post('/promocoes', (req, res) => {
    const { nome, tipo, valor, inicio, fim, aplicavel_a, ativa } = req.body;
    const result = db.insert('promocoes', {
      nome, tipo, valor, inicio: inicio || null, fim: fim || null,
      aplicavel_a: aplicavel_a || 'tudo', ativa: ativa !== undefined ? ativa : 1
    });

    const promocaoId = result.lastInsertRowid;

    // Insert rules
    const regras = req.body.regras || [];
    for (const regra of regras) {
      db.insert('promocoes_regras', {
        promocao_id: promocaoId,
        categoria_id: regra.categoria_id || null,
        produto_id: regra.produto_id || null
      });
    }

    res.json({ id: promocaoId, ...req.body });
  });

  router.put('/promocoes/:id', (req, res) => {
    const { nome, tipo, valor, inicio, fim, aplicavel_a, ativa } = req.body;
    db.update('promocoes', req.params.id, {
      nome, tipo, valor, inicio: inicio || null, fim: fim || null,
      aplicavel_a, ativa: ativa !== undefined ? ativa : 1
    });
    res.json({ id: Number(req.params.id), ...req.body });
  });

  router.delete('/promocoes/:id', (req, res) => {
    const regras = db.select('promocoes_regras').filter(r => r.promocao_id === Number(req.params.id));
    for (const r of regras) {
      db.delete('promocoes_regras', r.id);
    }
    db.delete('promocoes', req.params.id);
    res.json({ success: true });
  });

  router.get('/promocoes/:id/regras', (req, res) => {
    const regras = db.select('promocoes_regras').filter(r => r.promocao_id === Number(req.params.id));
    res.json(regras);
  });

  return router;
};
