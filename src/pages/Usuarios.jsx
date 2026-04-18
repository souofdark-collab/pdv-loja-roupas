import React, { useEffect, useState } from 'react';
import { useModal } from '../components/Modal';

export default function Usuarios({ user }) {
  const [usuarios, setUsuarios] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: '', login: '', senha: '', cargo: 'caixa', comissao: 0 });
  const { askConfirm, modalEl } = useModal();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/usuarios').then(setUsuarios);
  };

  const handleOpenForm = (u = null) => {
    if (u) {
      setEditingId(u.id);
      setForm({ nome: u.nome, login: u.login, senha: '', cargo: u.cargo, comissao: u.comissao || 0 });
    } else {
      setEditingId(null);
      setForm({ nome: '', login: '', senha: '', cargo: 'caixa', comissao: 0 });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      const data = { nome: form.nome, login: form.login, cargo: form.cargo, comissao: Number(form.comissao) || 0 };
      if (form.senha) data.senha = form.senha;
      await window.api.put(`/api/usuarios/${editingId}`, data);
    } else {
      await window.api.post('/api/usuarios', form);
    }
    setForm({ nome: '', login: '', senha: '', cargo: 'caixa', comissao: 0 });
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const handleDelete = async (id) => {
    askConfirm('Desativar este usuário?', async () => {
      await window.api.delete(`/api/usuarios/${id}`);
      loadData();
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Gestão de Usuários</h1>
        {user.cargo === 'admin' && (
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {showForm ? 'Cancelar' : '+ Novo Usuário'}
          </button>
        )}
      </div>

      {showForm && user.cargo === 'admin' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Login *</label>
                <input value={form.login} onChange={e => setForm({...form, login: e.target.value})} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{editingId ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                <input type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} required={!editingId} />
              </div>
              <div className="form-group">
                <label>Cargo</label>
                <select value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})}>
                  <option value="caixa">Caixa</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="form-group">
                <label>Comissão (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={form.comissao}
                  onChange={e => setForm({...form, comissao: e.target.value})}
                  placeholder="0" />
              </div>
            </div>
            <button type="submit" className="btn-success">{editingId ? 'Atualizar Usuário' : 'Salvar Usuário'}</button>
          </form>
        </div>
      )}

      {user.cargo !== 'admin' && (
        <p style={{ color: 'var(--warning)', marginBottom: 16 }}>
          ⚠️ Apenas administradores podem gerenciar usuários
        </p>
      )}

      <div className="card">
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Nome</th><th>Login</th><th>Cargo</th><th>Comissão</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.login}</td>
                  <td>{u.cargo === 'admin' ? 'Administrador' : u.cargo === 'vendedor' ? 'Vendedor' : 'Caixa'}</td>
                  <td>{u.comissao > 0 ? `${u.comissao}%` : '-'}</td>
                  <td>
                    {u.ativo ? <span className="badge badge-success">Ativo</span> : <span className="badge badge-danger">Inativo</span>}
                  </td>
                  <td>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    {user.cargo === 'admin' && (
                      <>
                        <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(u)}>
                          Editar
                        </button>
                        {u.id !== user.id && (
                          <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(u.id)}>
                            Desativar
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalEl}
    </div>
  );
}
