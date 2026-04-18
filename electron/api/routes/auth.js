const express = require('express');
const bcrypt = require('bcryptjs');

const failedAttempts = new Map();
const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000;

module.exports = (db) => {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { login, senha } = req.body;
    const key = (login || '').toLowerCase();
    const now = Date.now();
    const record = failedAttempts.get(key);
    if (record && record.count >= LOCK_THRESHOLD && now - record.last < LOCK_DURATION_MS) {
      const waitMs = LOCK_DURATION_MS - (now - record.last);
      return res.status(429).json({ error: `Muitas tentativas. Tente novamente em ${Math.ceil(waitMs / 60000)} minuto(s).` });
    }

    const user = db.findOne('usuarios', { login, ativo: 1 });
    const registerFailure = (motivo) => {
      const prev = failedAttempts.get(key) || { count: 0, last: 0 };
      failedAttempts.set(key, { count: prev.count + 1, last: now });
      db.insert('log_acoes', {
        usuario_id: user ? user.id : null,
        usuario_nome: user ? user.nome : (login || ''),
        acao: 'Login Falhou',
        detalhes: `Login: ${login || ''} | ${motivo}`,
        criado_em: new Date().toISOString()
      });
    };

    if (!user) {
      registerFailure('Usuário não encontrado');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    if (!user.senha_hash || !bcrypt.compareSync(senha, user.senha_hash)) {
      registerFailure('Senha incorreta');
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    failedAttempts.delete(key);
    db.insert('log_acoes', {
      usuario_id: user.id,
      usuario_nome: user.nome,
      acao: 'Login',
      detalhes: `Cargo: ${user.cargo}`,
      criado_em: new Date().toISOString()
    });
    const { senha_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  return router;
};
