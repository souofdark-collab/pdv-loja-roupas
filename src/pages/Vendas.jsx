import React, { useEffect, useState } from 'react';
import { buildReceiptHTML } from '../utils/receipt';
import { useModal } from '../components/Modal';

export default function Vendas() {
  const { showAlert, modalEl } = useModal();
  const [vendas, setVendas] = useState([]);
  const [selectedVenda, setSelectedVenda] = useState(null);
  const [editingVenda, setEditingVenda] = useState(null);
  const [editForm, setEditForm] = useState({ forma_pagamento: '', status: '' });
  const [trocaForm, setTrocaForm] = useState(null);
  const [trocaVendaItens, setTrocaVendaItens] = useState([]);
  const [produtosAll, setProdutosAll] = useState([]);
  const [estoqueAll, setEstoqueAll] = useState([]);
  const [cancelModal, setCancelModal] = useState(null); // venda a cancelar
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [senhaErro, setSenhaErro] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ inicio: '', fim: '', status: '', forma_pagamento: '', cliente: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    window.api.get('/api/vendas').then(setVendas);
    window.api.get('/api/produtos').then(setProdutosAll).catch(() => {});
    window.api.get('/api/estoque').then(setEstoqueAll).catch(() => {});
  };

  const openTroca = async (venda) => {
    try {
      const full = await window.api.get(`/api/vendas/${venda.id}`);
      setTrocaVendaItens(full.itens || []);
    } catch { setTrocaVendaItens([]); }
    setTrocaForm(venda);
  };

  const openEdit = (venda) => {
    setEditingVenda(venda.id);
    setEditForm({ forma_pagamento: venda.forma_pagamento, status: venda.status });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    // Se mudou para cancelada, exige senha
    if (editForm.status === 'cancelada') {
      const venda = vendas.find(v => v.id === editingVenda);
      if (venda && venda.status !== 'cancelada') {
        setMotivoCancelamento('');
        setCancelModal({ vendaId: editingVenda, formData: editForm });
        setEditingVenda(null);
        return;
      }
    }
    const user = JSON.parse(localStorage.getItem('pdv_user'));
    await window.api.put(`/api/vendas/${editingVenda}`, { ...editForm, usuario_id: user?.id });
    setEditingVenda(null);
    loadData();
  };

  const [loginAdmin, setLoginAdmin] = useState('');

  const handleConfirmarCancelamento = async () => {
    setSenhaErro('');
    if (!loginAdmin.trim()) { setSenhaErro('Informe o login do administrador.'); return; }
    if (!motivoCancelamento.trim()) { setSenhaErro('Informe o motivo do cancelamento.'); return; }
    try {
      const res = await window.api.post('/api/login', { login: loginAdmin.trim(), senha: senhaAdmin });
      if (res && res.cargo === 'admin') {
        const user = JSON.parse(localStorage.getItem('pdv_user'));
        await window.api.put(`/api/vendas/${cancelModal.vendaId}`, { ...cancelModal.formData, usuario_id: user?.id, motivo_cancelamento: motivoCancelamento.trim() });
        setCancelModal(null);
        setSenhaAdmin('');
        setLoginAdmin('');
        setMotivoCancelamento('');
        loadData();
      } else {
        setSenhaErro('Usuário não tem permissão de administrador.');
      }
    } catch {
      setSenhaErro('Login ou senha incorretos.');
    }
  };

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  const handleReprint = async (venda) => {
    let config = {};
    try { config = await window.api.get('/api/configuracoes'); } catch {}
    let full = venda;
    try { full = await window.api.get(`/api/vendas/${venda.id}`); } catch {}
    const html = buildReceiptHTML({ sale: full, config, reprint: true });
    const printerName = config.impressora_padrao;
    if (printerName && window.electron?.printReceipt) {
      await window.electron.printReceipt(html, printerName);
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Histórico de Vendas</h1>

      {/* Modal confirmação cancelamento com senha */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => { setCancelModal(null); setSenhaAdmin(''); setLoginAdmin(''); setSenhaErro(''); setMotivoCancelamento(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Cancelar Venda #{cancelModal.vendaId}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Esta ação é irreversível. Informe as credenciais de um administrador para confirmar.
            </p>
            <div className="form-group">
              <label>Motivo do Cancelamento *</label>
              <textarea
                value={motivoCancelamento}
                onChange={e => { setMotivoCancelamento(e.target.value); setSenhaErro(''); }}
                rows={2}
                placeholder="Descreva o motivo do cancelamento"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Login do Administrador</label>
              <input
                value={loginAdmin}
                onChange={e => { setLoginAdmin(e.target.value); setSenhaErro(''); }}
                placeholder="ex: admin"
              />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                value={senhaAdmin}
                onChange={e => { setSenhaAdmin(e.target.value); setSenhaErro(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirmarCancelamento()}
                placeholder="Senha do administrador"
              />
              {senhaErro && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{senhaErro}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setCancelModal(null); setSenhaAdmin(''); setLoginAdmin(''); setSenhaErro(''); setMotivoCancelamento(''); }}>Voltar</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleConfirmarCancelamento}>Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingVenda && (
        <div className="modal-overlay" onClick={() => setEditingVenda(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Editar Venda #{editingVenda}</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Forma de Pagamento</label>
                <select value={editForm.forma_pagamento} onChange={e => setEditForm({...editForm, forma_pagamento: e.target.value})}>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="pix">PIX</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                  <option value="finalizada">Finalizada</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="devolvida">Devolvida</option>
                </select>
              </div>
              {editForm.status === 'cancelada' && (
                <p style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 8 }}>
                  ⚠️ Cancelar exige senha do administrador.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn-secondary" type="button" onClick={() => setEditingVenda(null)} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn-success" type="submit" style={{ flex: 1 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? '▼ Filtros' : '▶ Filtros'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Mostrando: {(() => {
              const f = filters;
              const filtered = vendas.filter(v => {
                if (f.status && v.status !== f.status) return false;
                if (f.forma_pagamento && v.forma_pagamento !== f.forma_pagamento) return false;
                if (f.cliente && !(v.cliente_nome || '').toLowerCase().includes(f.cliente.toLowerCase())) return false;
                if (f.inicio && v.data < f.inicio) return false;
                if (f.fim && v.data > f.fim + 'T23:59:59') return false;
                return true;
              });
              return `${filtered.length} / ${vendas.length}`;
            })()}
          </span>
          {(filters.inicio || filters.fim || filters.status || filters.forma_pagamento || filters.cliente) && (
            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setFilters({ inicio: '', fim: '', status: '', forma_pagamento: '', cliente: '' })}>Limpar</button>
          )}
        </div>
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 10 }}>
            <input type="date" value={filters.inicio} onChange={e => setFilters({ ...filters, inicio: e.target.value })} placeholder="Início" />
            <input type="date" value={filters.fim} onChange={e => setFilters({ ...filters, fim: e.target.value })} placeholder="Fim" />
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Todos os status</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
              <option value="devolvida">Devolvida</option>
            </select>
            <input value={filters.forma_pagamento} onChange={e => setFilters({ ...filters, forma_pagamento: e.target.value })} placeholder="Pagamento" />
            <input value={filters.cliente} onChange={e => setFilters({ ...filters, cliente: e.target.value })} placeholder="Cliente (nome)" />
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ maxHeight: 480, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th><th>Parcelas</th><th>Status</th><th>Motivo</th><th>Total</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {vendas.filter(v => {
                const f = filters;
                if (f.status && v.status !== f.status) return false;
                if (f.forma_pagamento && v.forma_pagamento !== f.forma_pagamento) return false;
                if (f.cliente && !(v.cliente_nome || '').toLowerCase().includes(f.cliente.toLowerCase())) return false;
                if (f.inicio && v.data < f.inicio) return false;
                if (f.fim && v.data > f.fim + 'T23:59:59') return false;
                return true;
              }).map(v => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{new Date(v.data).toLocaleString('pt-BR')}</td>
                  <td>{v.cliente_nome || '-'}</td>
                  <td>{v.usuario_nome}</td>
                  <td>{v.forma_pagamento}</td>
                  <td>{v.parcelas ? `${v.parcelas}x` : '-'}</td>
                  <td>
                    {v.status === 'finalizada' && <span className="badge badge-success">Finalizada</span>}
                    {v.status === 'cancelada' && <span className="badge badge-danger">Cancelada</span>}
                    {v.status === 'devolvida' && <span className="badge badge-warning">Devolvida</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180 }} title={v.motivo_cancelamento || ''}>
                    {v.motivo_cancelamento
                      ? (v.motivo_cancelamento.length > 30 ? v.motivo_cancelamento.slice(0, 30) + '...' : v.motivo_cancelamento)
                      : '-'}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(v.total)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSelectedVenda(v)}>Ver</button>
                      <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(v)}>Editar</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={async () => {
                        const full = await window.api.get(`/api/vendas/${v.id}`);
                        handleReprint({ ...v, itens: full.itens || [] });
                      }}>Imprimir</button>
                      {v.status === 'finalizada' && (
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openTroca(v)}>Troca/Dev.</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vendas.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma venda registrada</p>}
      </div>

      {selectedVenda && (
        <div className="modal-overlay" onClick={() => setSelectedVenda(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Detalhes da Venda #{selectedVenda.id}</h3>
            <p><strong>Data:</strong> {new Date(selectedVenda.data).toLocaleString('pt-BR')}</p>
            <p><strong>Cliente:</strong> {selectedVenda.cliente_nome || '-'}</p>
            <p><strong>Vendedor:</strong> {selectedVenda.usuario_nome}</p>
            <p><strong>Pagamento:</strong> {selectedVenda.forma_pagamento}{selectedVenda.parcelas ? ` (${selectedVenda.parcelas}x)` : ''}</p>
            <p><strong>Status:</strong> {selectedVenda.status}</p>
            {selectedVenda.motivo_cancelamento && (
              <p style={{ color: 'var(--danger)' }}><strong>Motivo:</strong> {selectedVenda.motivo_cancelamento}</p>
            )}
            <hr style={{ borderColor: 'var(--border)', margin: '12px 0' }} />
            <table>
              <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Total</th></tr></thead>
              <tbody>
                {selectedVenda.itens && selectedVenda.itens.map(item => (
                  <tr key={item.id}>
                    <td>{item.produto_nome}</td>
                    <td>{item.quantidade}</td>
                    <td>{formatCurrency(item.preco_unitario)}</td>
                    <td>{formatCurrency(item.quantidade * item.preco_unitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr style={{ borderColor: 'var(--border)', margin: '12px 0' }} />
            <p style={{ fontSize: 18, fontWeight: 700 }}>Total: {formatCurrency(selectedVenda.total)}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => handleReprint(selectedVenda)}>Reimprimir</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => setSelectedVenda(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {trocaForm && (
        <div className="modal-overlay" onClick={() => setTrocaForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 16 }}>Registrar Troca/Devolução - Venda #{trocaForm.id}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const user = JSON.parse(localStorage.getItem('pdv_user'));
              const itemIdx = Number(fd.get('item_idx'));
              const itemSel = trocaVendaItens[itemIdx];
              if (!itemSel) { showAlert('Selecione um item da venda'); return; }
              const qtd = Math.min(Number(fd.get('quantidade') || 1), itemSel.quantidade);
              await window.api.post('/api/trocas', {
                venda_id: trocaForm.id,
                produto_id: itemSel.produto_id,
                estoque_id: itemSel.estoque_id,
                quantidade: qtd,
                motivo: fd.get('motivo'),
                tipo: fd.get('tipo'),
                novo_produto_id: fd.get('novo_estoque_id') ? (estoqueAll.find(x => x.id === Number(fd.get('novo_estoque_id'))) || {}).produto_id || null : null,
                novo_estoque_id: fd.get('novo_estoque_id') ? Number(fd.get('novo_estoque_id')) : null,
                observacao: fd.get('observacao'),
                usuario_id: user.id
              });
              setTrocaForm(null);
              setTrocaVendaItens([]);
              loadData();
            }}>
              <div className="form-group">
                <label>Tipo</label>
                <select name="tipo" defaultValue="troca" onChange={e => {
                  const el = document.getElementById('novo-item-wrapper');
                  if (el) el.style.display = e.target.value === 'troca' ? 'block' : 'none';
                }}>
                  <option value="troca">Troca</option>
                  <option value="devolucao">Devolução</option>
                </select>
              </div>
              <div className="form-group">
                <label>Item a devolver/trocar *</label>
                <select name="item_idx" required defaultValue="">
                  <option value="" disabled>Selecione o item da venda...</option>
                  {trocaVendaItens.map((it, idx) => (
                    <option key={idx} value={idx}>
                      {it.produto_nome} {(it.tamanho || it.cor) ? `(${it.tamanho || '-'}/${it.cor || '-'})` : ''} — qtd: {it.quantidade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantidade</label>
                <input name="quantidade" type="number" min="1" defaultValue="1" />
              </div>
              <div id="novo-item-wrapper" className="form-group" style={{ display: 'block' }}>
                <label>Item novo (para troca)</label>
                <select name="novo_estoque_id" defaultValue="">
                  <option value="">— escolher depois ao aprovar —</option>
                  {estoqueAll.filter(e => e.quantidade > 0).map(e => {
                    const p = produtosAll.find(pr => pr.id === e.produto_id);
                    return <option key={e.id} value={e.id}>{p ? p.nome : `#${e.produto_id}`} ({e.tamanho || '-'}/{e.cor || '-'}) — disp: {e.quantidade}</option>;
                  })}
                </select>
              </div>
              <div className="form-group">
                <label>Motivo *</label>
                <input name="motivo" required />
              </div>
              <div className="form-group">
                <label>Observação</label>
                <textarea name="observacao" rows={2} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn-secondary" type="button" onClick={() => { setTrocaForm(null); setTrocaVendaItens([]); }} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn-success" type="submit" style={{ flex: 1 }}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalEl}
    </div>
  );
}
