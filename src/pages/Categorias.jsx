import React, { useEffect, useState } from 'react';
import { useModal } from '../components/Modal';

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const { askConfirm, modalEl } = useModal();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/categorias').then(setCategorias);
  };

  const handleOpenForm = (categoria = null) => {
    if (categoria) {
      setEditingId(categoria.id);
      setForm({ nome: categoria.nome, descricao: categoria.descricao || '' });
    } else {
      setEditingId(null);
      setForm({ nome: '', descricao: '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await window.api.put(`/api/categorias/${editingId}`, form);
    } else {
      await window.api.post('/api/categorias', form);
    }
    setForm({ nome: '', descricao: '' });
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const handleDelete = async (id) => {
    askConfirm('Excluir esta categoria?', async () => {
      await window.api.delete(`/api/categorias/${id}`);
      loadData();
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Categorias</h1>
        <button className="btn-primary" onClick={() => handleOpenForm()}>
          {showForm ? 'Cancelar' : '+ Nova Categoria'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
              </div>
              <div className="form-group" style={{ flex: 3 }}>
                <label>Descrição</label>
                <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn-success">{editingId ? 'Atualizar' : 'Salvar'}</button>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.descricao || '-'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(c)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(c.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categorias.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma categoria</p>}
        </div>
      </div>

      {modalEl}
    </div>
  );
}
