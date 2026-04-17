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
    if (!bcrypt.compareSync(senha, user.senha_hash)) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    const { senha_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  return router;
};
