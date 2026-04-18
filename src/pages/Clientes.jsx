import React, { useEffect, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';

export default function Clientes({ user }) {
  const [clientes, setClientes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '', email: '', endereco: '' });
  const [search, setSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const isVendedor = user && user.cargo === 'vendedor';
  const [modal, setModal] = useState(null);
  const showAlert = (msg) => { document.activeElement?.blur(); setModal({ msg }); };
  const askConfirm = (msg, fn) => { document.activeElement?.blur(); setModal({ msg, onConfirm: fn }); };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/clientes').then(setClientes);
  };

  const handleOpenForm = (cliente = null) => {
    if (cliente) {
      if (isVendedor && cliente.criado_por_usuario_id !== user.id) {
        showAlert('Você só pode editar clientes criados por você.');
        return;
      }
      setEditingId(cliente.id);
      setForm({
        nome: cliente.nome,
        cpf: cliente.cpf || '',
        telefone: cliente.telefone || '',
        email: cliente.email || '',
        endereco: cliente.endereco || ''
      });
    } else {
      setEditingId(null);
      setForm({ nome: '', cpf: '', telefone: '', email: '', endereco: '' });
    }
    setShowForm(true);
  };

  // Format CPF: XXX.XXX.XXX-XX
  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Format phone: (XX) XXXXX-XXXX
  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleCPFChange = (val) => {
    setForm({ ...form, cpf: formatCPF(val) });
  };

  const handlePhoneChange = (val) => {
    setForm({ ...form, telefone: formatPhone(val) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await window.api.put(`/api/clientes/${editingId}`, form);
    } else {
      await window.api.post('/api/clientes', { ...form, criado_por_usuario_id: isVendedor ? user.id : null });
    }
    setForm({ nome: '', cpf: '', telefone: '', email: '', endereco: '' });
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const handleDelete = async (id) => {
    if (isVendedor) {
      showAlert('Vendedores não podem excluir clientes.');
      return;
    }
    askConfirm('Excluir este cliente?', async () => {
      await window.api.delete(`/api/clientes/${id}`);
      loadData();
    });
  };

  const handleVerHistorico = async (cliente) => {
    setSelectedCliente(cliente);
    const vendas = await window.api.get(`/api/vendas`);
    const vendasCliente = vendas
      .filter(v => v.cliente_id === cliente.id)
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    // Load items for each sale
    const vendasComItens = await Promise.all(vendasCliente.map(async v => {
      const detail = await window.api.get(`/api/vendas/${v.id}`);
      return detail;
    }));
    setHistorico(vendasComItens);
    setShowHistorico(true);
  };

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;
  const totalGasto = historico.filter(v => v.status !== 'cancelada').reduce((s, v) => s + Number(v.total), 0);

  const exportHistoricoPDF = () => {
    if (!selectedCliente || !historico.length) return;
    const headers = ['#', 'Data', 'Produtos', 'Pagamento', 'Status', 'Total'];
    const rows = [];
    historico.forEach(v => {
      const items = (v.itens || []).map(i => `${i.produto_nome} (${i.quantidade}x)`).join(', ');
      rows.push([
        `#${v.id}`,
        new Date(v.data).toLocaleString('pt-BR'),
        items,
        v.forma_pagamento,
        v.status,
        formatCurrency(v.total)
      ]);
    });
    exportPDF({
      title: `Histórico de Compras - ${selectedCliente.nome}`,
      headers, data: rows,
      footer: `${historico.length} compras | Total gasto: ${formatCurrency(totalGasto)}`,
      filename: `compras-${selectedCliente.nome.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
    });
  };

  const filtered = search
    ? clientes.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()) || (c.cpf && c.cpf.includes(search)) || (c.telefone && c.telefone.includes(search)))
    : clientes;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Clientes</h1>
        <button className="btn-primary" onClick={() => handleOpenForm()}>
          {showForm ? 'Cancelar' : '+ Novo Cliente'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nome *</label>
                <input type="text" autoComplete="off" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>CPF</label>
                <input type="text" autoComplete="off" value={form.cpf} onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Telefone</label>
                <input type="text" autoComplete="off" value={form.telefone} onChange={e => handlePhoneChange(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="text" autoComplete="off" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Endereço</label>
              <input type="text" autoComplete="off" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
            </div>
            <button type="submit" className="btn-success">{editingId ? 'Atualizar Cliente' : 'Salvar Cliente'}</button>
          </form>
        </div>
      )}

      <div className="card">
        <input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Email</th><th>Endereço</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.cpf || '-'}</td>
                  <td>{c.telefone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.endereco || '-'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleVerHistorico(c)}>
                      Ver Compras
                    </button>
                    {(!isVendedor || c.criado_por_usuario_id === user.id) && (
                      <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(c)}>
                        Editar
                      </button>
                    )}
                    {!isVendedor && (
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(c.id)}>
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhum cliente encontrado</p>}
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setModal(null)}>
          <div className="card" style={{ maxWidth: 360, width: '90vw', textAlign: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
            <p style={{ marginBottom: 20, fontSize: 15 }}>{modal.msg}</p>
            {modal.onConfirm ? (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => { setModal(null); modal.onConfirm(); }}>Confirmar</button>
              </div>
            ) : <button className="btn-primary" onClick={() => setModal(null)}>OK</button>}
          </div>
        </div>
      )}

      {/* Historico de Compras Modal */}
      {showHistorico && selectedCliente && (
        <div className="modal-overlay" onClick={() => setShowHistorico(false)}>
          <div className="modal" style={{ maxWidth: 900, width: '90%' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', zIndex: 1 }} onClick={() => setShowHistorico(false)}>Fechar</button>
            <h2 style={{ marginBottom: 8 }}>Histórico de Compras - {selectedCliente.nome}</h2>
            <button className="btn-secondary" onClick={exportHistoricoPDF} style={{ position: 'absolute', top: 12, right: 90, padding: '4px 10px', zIndex: 1, fontSize: 12 }}>Exportar PDF</button>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {historico.length} vendas | Total gasto: <strong style={{ color: 'var(--accent)' }}>{formatCurrency(totalGasto)}</strong>
            </p>

            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {historico.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma compra registrada</p>
              ) : (
                historico.map(v => (
                  <div key={v.id} className="card" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <strong>Venda #{v.id}</strong> - {new Date(v.data).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`badge ${v.status === 'finalizada' ? 'badge-success' : v.status === 'cancelada' ? 'badge-danger' : 'badge-warning'}`}>
                          {v.status}
                        </span>
                        <strong style={{ color: 'var(--accent)' }}>{formatCurrency(v.total)}</strong>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Pagamento: {v.forma_pagamento}
                    </p>
                    <table style={{ fontSize: 13 }}>
                      <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Total</th></tr></thead>
                      <tbody>
                        {v.itens && v.itens.map(item => (
                          <tr key={item.id}>
                            <td>{item.produto_nome} {item.tamanho && `(${item.tamanho}/${item.cor})`}</td>
                            <td>{item.quantidade}</td>
                            <td>{formatCurrency(item.preco_unitario)}</td>
                            <td>{formatCurrency(item.quantidade * item.preco_unitario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
