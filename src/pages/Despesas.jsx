import React, { useEffect, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';

const MES = 'Mensal';
const QUINZENAL = 'Quinzenal';
const ANUAL = 'Anual';

export default function Despesas({ user }) {
  const [despesas, setDespesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ descricao: '', valor: '', categoria_id: '', recorrencia: 'nenhuma', vencimento: '' });
  const [catForm, setCatForm] = useState({ nome: '', descricao: '' });
  const [editingCatId, setEditingCatId] = useState(null);
  const [filterMes, setFilterMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/despesas').then(setDespesas);
    window.api.get('/api/despesas-categorias').then(setCategorias);
  };

  const handleOpenForm = (d = null) => {
    if (d) {
      setEditingId(d.id);
      setForm({
        descricao: d.descricao,
        valor: d.valor,
        categoria_id: d.categoria_id || '',
        recorrencia: d.recorrencia || 'nenhuma',
        vencimento: d.vencimento || ''
      });
    } else {
      setEditingId(null);
      setForm({ descricao: '', valor: '', categoria_id: '', recorrencia: 'nenhuma', vencimento: '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await window.api.put(`/api/despesas/${editingId}`, { ...form, valor: Number(form.valor) });
    } else {
      await window.api.post('/api/despesas', { ...form, valor: Number(form.valor) });
    }
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const handleDelete = async (id) => {
    if (confirm('Excluir esta despesa?')) {
      await window.api.delete(`/api/despesas/${id}`);
      loadData();
    }
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (editingCatId) {
      await window.api.put(`/api/despesas-categorias/${editingCatId}`, catForm);
    } else {
      await window.api.post('/api/despesas-categorias', catForm);
    }
    setCatForm({ nome: '', descricao: '' });
    setEditingCatId(null);
    setShowCatForm(false);
    loadData();
  };

  const handleCatDelete = async (id) => {
    if (confirm('Excluir esta categoria?')) {
      await window.api.delete(`/api/despesas-categorias/${id}`);
      loadData();
    }
  };

  // Filter by month
  const filtered = despesas.filter(d => d.data && d.data.startsWith(filterMes));
  const totalDespesas = filtered.reduce((s, d) => s + Number(d.valor), 0);

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  const exportToPDF = () => {
    const headers = ['Descrição', 'Categoria', 'Valor', 'Recorrência', 'Vencimento', 'Data'];
    const rows = filtered.map(d => [d.descricao, d.categoria_nome || '-', formatCurrency(d.valor), recorrenciaLabel(d.recorrencia), d.vencimento ? new Date(d.vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-', new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')]);
    const title = `Despesas - ${new Date(filterMes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    exportPDF({ title, headers, data: rows, footer: `Total: ${formatCurrency(totalDespesas)} | ${filtered.length} despesas`, filename: `despesas-${filterMes}.pdf` });
  };

  const recorrenciaLabel = (r) => {
    if (r === 'mensal') return 'Mensal';
    if (r === 'quinzenal') return 'Quinzenal';
    if (r === 'anual') return 'Anual';
    return '-';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Despesas</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowCatForm(!showCatForm)}>
            {showCatForm ? 'Cancelar' : 'Categorias'}
          </button>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {showForm ? 'Cancelar' : '+ Nova Despesa'}
          </button>
        </div>
      </div>

      {/* Month filter */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mês de referência</label>
            <input
              type="month"
              value={filterMes}
              onChange={e => setFilterMes(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 0 }}>Total do mês</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)', marginBottom: 0 }}>{formatCurrency(totalDespesas)}</p>
          </div>
          <button className="btn-secondary" onClick={exportToPDF}>Exportar PDF</button>
        </div>
      </div>

      {/* Category form */}
      {showCatForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Categorias de Despesas</h3>
          <form onSubmit={handleCatSubmit} style={{ marginBottom: 16 }}>
            <div className="form-row">
              <div className="form-group">
                <label>Nome *</label>
                <input value={catForm.nome} onChange={e => setCatForm({...catForm, nome: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <input value={catForm.descricao} onChange={e => setCatForm({...catForm, descricao: e.target.value})} />
              </div>
              <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                <button type="submit" className="btn-success">{editingCatId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </div>
          </form>
          <table>
            <thead><tr><th>Nome</th><th>Descrição</th><th>Qtd Despesas</th><th>Ações</th></tr></thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.descricao || '-'}</td>
                  <td>{despesas.filter(d => d.categoria_id === c.id).length}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => { setEditingCatId(c.id); setCatForm({ nome: c.nome, descricao: c.descricao || '' }); }}>Editar</button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleCatDelete(c.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categorias.length === 0 && <p style={{ textAlign: 'center', padding: 12, color: 'var(--text-secondary)' }}>Nenhuma categoria cadastrada</p>}
        </div>
      )}

      {/* Expense form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Despesa' : 'Nova Despesa'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Descrição *</label>
                <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Valor *</label>
                <input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Categoria</label>
                <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Recorrência</label>
                <select value={form.recorrencia} onChange={e => setForm({...form, recorrencia: e.target.value})}>
                  <option value="nenhuma">Única</option>
                  <option value="mensal">Mensal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div className="form-group">
                <label>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn-success">{editingId ? 'Atualizar Despesa' : 'Salvar Despesa'}</button>
          </form>
        </div>
      )}

      {/* Expense list */}
      <div className="card">
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Recorrência</th><th>Vencimento</th><th>Data</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td>{d.descricao}</td>
                <td>{d.categoria_nome || '-'}</td>
                <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(d.valor)}</td>
                <td>{recorrenciaLabel(d.recorrencia)}</td>
                <td>{d.vencimento ? new Date(d.vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                <td>{new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(d)}>Editar</button>
                  <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(d.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma despesa neste mês</p>}
      </div>
    </div>
  );
}
