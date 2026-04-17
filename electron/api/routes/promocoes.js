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
    const result = promocoes.map(p => ({
      ...p,
      regras: db.select('promocoes_regras').filter(r => r.promocao_id === p.id)
    }));
    res.json(result);
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
      if (regra.produto_id || regra.categoria_id) {
        db.insert('promocoes_regras', {
          promocao_id: promocaoId,
          categoria_id: regra.categoria_id ? Number(regra.categoria_id) : null,
          produto_id: regra.produto_id ? Number(regra.produto_id) : null
        });
      }
    }

    res.json({ id: promocaoId, ...req.body });
  });

  router.put('/promocoes/:id', (req, res) => {
    const { nome, tipo, valor, inicio, fim, aplicavel_a, ativa, regras } = req.body;
    db.update('promocoes', req.params.id, {
      nome, tipo, valor, inicio: inicio || null, fim: fim || null,
      aplicavel_a, ativa: ativa !== undefined ? ativa : 1
    });
    // Update rules: delete existing then re-insert
    if (Array.isArray(regras)) {
      const existing = db.select('promocoes_regras').filter(r => r.promocao_id === Number(req.params.id));
      for (const r of existing) db.delete('promocoes_regras', r.id);
      for (const regra of regras) {
        if (regra.produto_id || regra.categoria_id) {
          db.insert('promocoes_regras', {
            promocao_id: Number(req.params.id),
            categoria_id: regra.categoria_id || null,
            produto_id: regra.produto_id ? Number(regra.produto_id) : null
          });
        }
      }
    }
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
