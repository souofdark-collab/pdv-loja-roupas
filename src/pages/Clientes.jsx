import React, { useEffect, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';
import { useModal } from '../components/Modal';

export default function Clientes({ user }) {
  const [clientes, setClientes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '', email: '', endereco: '' });
  const [search, setSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [fiadoModal, setFiadoModal] = useState(null);
  const [fiadoResumo, setFiadoResumo] = useState([]);
  const [pagamentoForm, setPagamentoForm] = useState(null);
  const isVendedor = user && user.cargo === 'vendedor';
  const { showAlert, askConfirm, modalEl } = useModal();

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

  // Format CPF/CNPJ: auto based on length
  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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

  const validateCPF = (cpfStr) => {
    const d = (cpfStr || '').replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const calc = (len) => {
      let s = 0;
      for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  };

  const validateCNPJ = (cnpjStr) => {
    const d = (cnpjStr || '').replace(/\D/g, '');
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const calc = (len) => {
      const weights = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
      let s = 0;
      for (let i = 0; i < len; i++) s += Number(d[i]) * weights[i];
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  };

  const validateDoc = (docStr) => {
    const d = (docStr || '').replace(/\D/g, '');
    if (!d) return true;
    if (d.length === 11) return validateCPF(d);
    if (d.length === 14) return validateCNPJ(d);
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.cpf && !validateDoc(form.cpf)) {
      showAlert('CPF/CNPJ inválido. Verifique os dígitos.');
      return;
    }
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

  const openFiado = async (cliente) => {
    setSelectedCliente(cliente);
    const res = await window.api.get(`/api/fiado/cliente/${cliente.id}`);
    setFiadoResumo(res.vendas || []);
    setFiadoModal(cliente);
  };

  const pagarFiado = async () => {
    if (!pagamentoForm) return;
    const valor = Number(pagamentoForm.valor);
    if (!valor || valor <= 0) { showAlert('Valor inválido'); return; }
    try {
      await window.api.post('/api/fiado/pagamento', {
        venda_id: pagamentoForm.venda_id,
        valor,
        forma_pagamento: pagamentoForm.forma_pagamento || 'dinheiro',
        usuario_id: user?.id,
        observacao: pagamentoForm.observacao || ''
      });
      setPagamentoForm(null);
      if (selectedCliente) {
        const res = await window.api.get(`/api/fiado/cliente/${selectedCliente.id}`);
        setFiadoResumo(res.vendas || []);
      }
    } catch (err) {
      showAlert(err.data?.error || 'Erro ao registrar pagamento');
    }
  };

  const saldoTotalFiado = fiadoResumo.filter(v => v.status === 'finalizada').reduce((s, v) => s + Number(v.saldo_devedor || 0), 0);

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
                <label>CPF / CNPJ</label>
                <input type="text" autoComplete="off" value={form.cpf} onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
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
                    <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openFiado(c)}>
                      Fiado
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

      {modalEl}

      {fiadoModal && (
        <div className="modal-overlay" onClick={() => { setFiadoModal(null); setPagamentoForm(null); }}>
          <div className="modal" style={{ maxWidth: 700, width: '90%' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px' }} onClick={() => { setFiadoModal(null); setPagamentoForm(null); }}>Fechar</button>
            <h2 style={{ marginBottom: 8 }}>Fiado — {fiadoModal.nome}</h2>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              Saldo total em aberto: <strong style={{ color: saldoTotalFiado > 0 ? 'var(--danger, crimson)' : 'var(--accent)' }}>{formatCurrency(saldoTotalFiado)}</strong>
            </p>
            {fiadoResumo.length === 0 ? (
              <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma venda fiado para este cliente</p>
            ) : (
              <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
                <table style={{ fontSize: 13 }}>
                  <thead><tr><th>Venda</th><th>Data</th><th>Total</th><th>Saldo</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {fiadoResumo.map(v => (
                      <tr key={v.id}>
                        <td>#{v.id}</td>
                        <td>{new Date(v.data).toLocaleDateString('pt-BR')}</td>
                        <td>{formatCurrency(v.total)}</td>
                        <td><strong style={{ color: Number(v.saldo_devedor || 0) > 0 ? 'var(--danger, crimson)' : 'inherit' }}>{formatCurrency(v.saldo_devedor || 0)}</strong></td>
                        <td>{Number(v.saldo_devedor || 0) <= 0 ? 'quitado' : 'em aberto'}</td>
                        <td>
                          {Number(v.saldo_devedor || 0) > 0 && v.status === 'finalizada' && (
                            <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPagamentoForm({ venda_id: v.id, valor: v.saldo_devedor, forma_pagamento: 'dinheiro', observacao: '' })}>
                              Receber
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagamentoForm && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Receber pagamento — Venda #{pagamentoForm.venda_id}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Valor</label>
                    <input type="number" step="0.01" value={pagamentoForm.valor} onChange={e => setPagamentoForm({ ...pagamentoForm, valor: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Forma</label>
                    <select value={pagamentoForm.forma_pagamento} onChange={e => setPagamentoForm({ ...pagamentoForm, forma_pagamento: e.target.value })}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Observação</label>
                  <input type="text" value={pagamentoForm.observacao} onChange={e => setPagamentoForm({ ...pagamentoForm, observacao: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" onClick={() => setPagamentoForm(null)}>Cancelar</button>
                  <button className="btn-primary" onClick={pagarFiado}>Confirmar Pagamento</button>
                </div>
              </div>
            )}
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
