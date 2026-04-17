import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await window.api.post('/api/login', { login, senha });
      if (res.error) {
        setError(res.error);
      } else {
        onLogin(res);
      }
    } catch (err) {
      if (err?.status === 401) {
        setError('Usuário ou senha incorretos');
      } else {
        setError('Erro ao conectar com o servidor. Verifique se o aplicativo está rodando corretamente.');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)'
    }}>
      <div className="card" style={{ width: 380 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontSize: 24 }}>PDV Loja de Roupas</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          Faça login para continuar
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuário</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Digite seu usuário"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: 12, fontSize: 16 }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
