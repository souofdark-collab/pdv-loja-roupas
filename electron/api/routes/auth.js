const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = (db) => {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { login, senha } = req.body;
    const user = db.findOne('usuarios', { login, ativo: 1 });
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    if (!user.senha_hash || !bcrypt.compareSync(senha, user.senha_hash)) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
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
