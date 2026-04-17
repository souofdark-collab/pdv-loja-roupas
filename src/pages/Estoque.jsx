import React, { useEffect, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];

export default function Estoque() {
  const [estoque, setEstoque] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ produto_id: '', tamanho: 'M', cor: '', quantidade: '', minimo: '5' });
  const [showMovForm, setShowMovForm] = useState(false);
  const [movForm, setMovForm] = useState({ estoque_id: '', tipo: 'entrada', quantidade: '', motivo: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/estoque').then(setEstoque);
    window.api.get('/api/produtos').then(setProdutos);
  };

  const handleOpenForm = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setForm({
        produto_id: item.produto_id,
        tamanho: item.tamanho,
        cor: item.cor,
        quantidade: item.quantidade,
        minimo: item.minimo
      });
    } else {
      setEditingId(null);
      setForm({ produto_id: '', tamanho: 'M', cor: '', quantidade: '', minimo: '5' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await window.api.put(`/api/estoque/${editingId}`, { quantidade: Number(form.quantidade), minimo: Number(form.minimo), tamanho: form.tamanho, cor: form.cor });
    } else {
      await window.api.post('/api/estoque', { ...form, quantidade: Number(form.quantidade), minimo: Number(form.minimo) });
    }
    setForm({ produto_id: '', tamanho: 'M', cor: '', quantidade: '', minimo: '5' });
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const handleMov = async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('pdv_user'));
    await window.api.post('/api/estoque/movimentacao', { ...movForm, quantidade: Number(movForm.quantidade), usuario_id: user.id });
    setMovForm({ estoque_id: '', tipo: 'entrada', quantidade: '', motivo: '' });
    setShowMovForm(false);
    loadData();
  };

  const handleDelete = async (id) => {
    if (confirm('Excluir este item do estoque?')) {
      await window.api.delete(`/api/estoque/${id}`);
      loadData();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Controle de Estoque</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-warning" onClick={() => setShowMovForm(!showMovForm)}>
            Movimentação
          </button>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {showForm ? 'Cancelar' : '+ Novo Item'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Item de Estoque' : 'Adicionar Item ao Estoque'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              {!editingId && (
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Produto *</label>
                  <select value={form.produto_id} onChange={e => setForm({...form, produto_id: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              {editingId && (
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Produto</label>
                  <input value={produtos.find(p => p.id === form.produto_id)?.nome || ''} disabled style={{ opacity: 0.7 }} />
                </div>
              )}
              <div className="form-group">
                <label>Tamanho *</label>
                <select value={form.tamanho} onChange={e => setForm({...form, tamanho: e.target.value})}>
                  {TAMANHOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Cor *</label>
                <input value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Quantidade *</label>
                <input type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Mínimo</label>
                <input type="number" value={form.minimo} onChange={e => setForm({...form, minimo: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn-success">{editingId ? 'Atualizar' : 'Salvar'}</button>
          </form>
        </div>
      )}

      {showMovForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Movimentação de Estoque</h3>
          <form onSubmit={handleMov}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Item de Estoque *</label>
                <select value={movForm.estoque_id} onChange={e => setMovForm({...movForm, estoque_id: e.target.value})} required>
                  <option value="">Selecione...</option>
                  {estoque.map(e => <option key={e.id} value={e.id}>{e.produto_nome} - {e.tamanho}/{e.cor} (Qtd: {e.quantidade})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo *</label>
                <select value={movForm.tipo} onChange={e => setMovForm({...movForm, tipo: e.target.value})}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>
              <div className="form-group">
                <label>Quantidade *</label>
                <input type="number" value={movForm.quantidade} onChange={e => setMovForm({...movForm, quantidade: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Motivo</label>
                <input value={movForm.motivo} onChange={e => setMovForm({...movForm, motivo: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn-warning">Registrar Movimentação</button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>Itens em Estoque</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => {
            let csv = 'Produto,Tamanho,Cor,Quantidade,Mínimo,Status\n';
            estoque.forEach(e => {
              const status = e.quantidade <= 0 ? 'Sem estoque' : e.quantidade <= e.minimo ? 'Baixo' : 'OK';
              csv += `${e.produto_nome},${e.tamanho},${e.cor},${e.quantidade},${e.minimo},${status}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `estoque-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}>Exportar CSV</button>
          <button className="btn-secondary" onClick={() => {
            const headers = ['Produto', 'Tamanho', 'Cor', 'Qtd', 'Mín', 'Status'];
            const rows = estoque.map(e => [e.produto_nome, e.tamanho, e.cor, e.quantidade, e.minimo, e.quantidade <= 0 ? 'Sem estoque' : e.quantidade <= e.minimo ? 'Baixo' : 'OK']);
            const total = estoque.length;
            const low = estoque.filter(e => e.quantidade <= e.minimo).length;
            exportPDF({
              title: 'Relatório de Estoque',
              headers, data: rows,
              footer: `${total} itens | ${low} com estoque baixo`,
              filename: `estoque-${new Date().toISOString().split('T')[0]}.pdf`
            });
          }}>Exportar PDF</button>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Produto</th><th>Tamanho</th><th>Cor</th><th>Quantidade</th><th>Mínimo</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {estoque.map(e => (
              <tr key={e.id}>
                <td>{e.produto_nome}</td>
                <td>{e.tamanho}</td>
                <td>{e.cor}</td>
                <td style={{ fontWeight: 600 }}>{e.quantidade}</td>
                <td>{e.minimo}</td>
                <td>
                  {e.quantidade <= 0 && <span className="badge badge-danger">Sem estoque</span>}
                  {e.quantidade > 0 && e.quantidade <= e.minimo && <span className="badge badge-warning">Baixo</span>}
                  {e.quantidade > e.minimo && <span className="badge badge-success">OK</span>}
                </td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(e)}>
                    Editar
                  </button>
                  <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(e.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {estoque.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhum item em estoque</p>}
      </div>
    </div>
  );
}
