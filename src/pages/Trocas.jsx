import React, { useState, useEffect } from 'react';
import { exportPDF } from '../utils/pdfExport';

export default function Trocas({ user }) {
  const [trocas, setTrocas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    venda_id: '', produto_id: '', motivo: '', tipo: 'troca', novo_produto_id: '', observacao: ''
  });
  const [filter, setFilter] = useState('todas'); // 'todas', 'pendente', 'concluida', 'recusada'
  const [modal, setModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/trocas').then(setTrocas);
    window.api.get('/api/vendas').then(setVendas);
    window.api.get('/api/produtos').then(setProdutos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await window.api.post('/api/trocas', {
      ...form,
      venda_id: form.venda_id ? Number(form.venda_id) : null,
      produto_id: Number(form.produto_id),
      novo_produto_id: form.novo_produto_id ? Number(form.novo_produto_id) : null,
      usuario_id: user.id
    });
    setForm({ venda_id: '', produto_id: '', motivo: '', tipo: 'troca', novo_produto_id: '', observacao: '' });
    setShowForm(false);
    loadData();
  };

  const handleStatus = async (id, status) => {
    if (status === 'recusada') {
      document.activeElement?.blur();
      setModal({ id, inputValue: '' });
    } else {
      await window.api.put(`/api/trocas/${id}`, { status });
      loadData();
    }
  };

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  const exportToPDF = () => {
    const headers = ['#', 'Data', 'Tipo', 'Produto', 'Motivo', 'Status', 'Obs.'];
    const rows = filtered.map(t => [
      t.id,
      t.criado_em ? new Date(t.criado_em).toLocaleString('pt-BR') : '-',
      t.tipo === 'troca' ? 'Troca' : 'Devolução',
      (produtos.find(p => p.id === t.produto_id) || {}).nome || '-',
      t.motivo,
      t.status === 'pendente' ? 'Pendente' : t.status === 'concluida' ? 'Concluída' : 'Recusada',
      t.observacao || '-'
    ]);
    const title = filter === 'todas' ? 'Controle de Trocas' : `Trocas - ${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
    exportPDF({ title, headers, data: rows, footer: `${filtered.length} trocas | ${pendentes} pendente(s)`, filename: `trocas-${new Date().toISOString().split('T')[0]}.pdf` });
  };

  const filtered = filter === 'todas' ? trocas : trocas.filter(t => t.status === filter);
  const pendentes = trocas.filter(t => t.status === 'pendente').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Controle de Trocas {pendentes > 0 && <span className="badge badge-warning" style={{ marginLeft: 8 }}>{pendentes} pendente(s)</span>}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={exportToPDF}>Exportar PDF</button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Nova Troca/Devolução'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Registrar Troca ou Devolução</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Venda Referente</label>
                <select value={form.venda_id} onChange={e => setForm({...form, venda_id: e.target.value})}>
                  <option value="">Sem venda (avulso)</option>
                  {vendas.slice(0, 50).map(v => (
                    <option key={v.id} value={v.id}>#{v.id} - {v.cliente_nome || 'Sem cliente'} - {formatCurrency(v.total)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  <option value="troca">Troca</option>
                  <option value="devolucao">Devolução</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Produto a Ser Trocado/Devolvido *</label>
                <select value={form.produto_id} onChange={e => setForm({...form, produto_id: e.target.value})} required>
                  <option value="">Selecione...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              {form.tipo === 'troca' && (
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Novo Produto (para troca)</label>
                  <select value={form.novo_produto_id} onChange={e => setForm({...form, novo_produto_id: e.target.value})}>
                    <option value="">Selecione...</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Motivo *</label>
              <input value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Observação</label>
              <textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} rows={2} />
            </div>
            <button type="submit" className="btn-success">Registrar</button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'todas', label: 'Todas' },
          { key: 'pendente', label: 'Pendentes' },
          { key: 'concluida', label: 'Concluídas' },
          { key: 'recusada', label: 'Recusadas' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              background: filter === f.key ? 'var(--accent)' : 'var(--border)',
              color: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              border: 'none'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>#</th><th>Data</th><th>Tipo</th><th>Produto</th><th>Motivo</th><th>Status</th><th>Obs.</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.criado_em ? new Date(t.criado_em).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    {t.tipo === 'troca' ? (
                      <span className="badge" style={{ background: '#9b59b6', color: 'white' }}>Troca</span>
                    ) : (
                      <span className="badge badge-danger">Devolução</span>
                    )}
                  </td>
                  <td>{(produtos.find(p => p.id === t.produto_id) || {}).nome || '-'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.motivo}</td>
                  <td>
                    {t.status === 'pendente' && <span className="badge badge-warning">Pendente</span>}
                    {t.status === 'concluida' && <span className="badge badge-success">Concluída</span>}
                    {t.status === 'recusada' && <span className="badge badge-danger">Recusada</span>}
                  </td>
                  <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {t.observacao || '-'}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    {t.status === 'pendente' && (
                      <>
                        <button className="btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleStatus(t.id, 'concluida')}>Aprovar</button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleStatus(t.id, 'recusada')}>Recusar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma troca registrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setModal(null)}>
          <div className="card" style={{ maxWidth: 360, width: '90vw', padding: 24 }} onClick={e => e.stopPropagation()}>
            <p style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>Motivo da recusa</p>
            <input
              autoFocus
              value={modal.inputValue}
              onChange={e => setModal({ ...modal, inputValue: e.target.value })}
              placeholder="Digite o motivo..."
              style={{ width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-danger" onClick={async () => {
                const motivo = modal.inputValue;
                const id = modal.id;
                setModal(null);
                await window.api.put(`/api/trocas/${id}`, { status: 'recusada', observacao: motivo || undefined });
                loadData();
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
