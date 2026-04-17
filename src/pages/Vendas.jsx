import React, { useEffect, useState } from 'react';

export default function Vendas() {
  const [vendas, setVendas] = useState([]);
  const [selectedVenda, setSelectedVenda] = useState(null);
  const [editingVenda, setEditingVenda] = useState(null);
  const [editForm, setEditForm] = useState({ forma_pagamento: '', status: '' });
  const [trocaForm, setTrocaForm] = useState(null);
  const [cancelModal, setCancelModal] = useState(null); // venda a cancelar
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [senhaErro, setSenhaErro] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = () => { window.api.get('/api/vendas').then(setVendas); };

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

  const handleReprint = (venda) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cupom - Venda #${venda.id}</title>
        <style>
          body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .total { font-size: 18px; font-weight: bold; }
          .item { margin: 4px 0; }
          @media print { body { margin: 0; padding: 5px; } }
        </style>
      </head>
      <body>
        <p class="center bold">TS Concept PDV</p>
        <div class="line"></div>
        <p class="center bold">Venda #${venda.id}</p>
        <p>Data: ${new Date(venda.data).toLocaleString('pt-BR')}</p>
        ${venda.cliente_nome ? `<p>Cliente: ${venda.cliente_nome}</p>` : ''}
        <p>Vendedor: ${venda.usuario_nome}</p>
        <div class="line"></div>
        ${(venda.itens || []).map(item => `
          <div class="item">
            ${item.produto_nome} (${item.tamanho || '-'}/${item.cor || '-'})<br/>
            ${item.quantidade} x ${formatCurrency(item.preco_unitario)} = ${formatCurrency(item.quantidade * item.preco_unitario)}
          </div>
        `).join('')}
        <div class="line"></div>
        <p>Subtotal: ${formatCurrency(venda.subtotal || venda.total)}</p>
        ${venda.desconto > 0 ? `<p>Desconto: -${formatCurrency(venda.desconto)}</p>` : ''}
        <p class="total">TOTAL: ${formatCurrency(venda.total)}</p>
        <p>Pagamento: ${venda.forma_pagamento}</p>
        <div class="line"></div>
        <p class="center">Obrigado pela preferência!</p>
        <p class="center" style="font-size:10px">2ª VIA</p>
      </body>
      </html>
    `);
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

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th><th>Parcelas</th><th>Status</th><th>Total</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {vendas.map(v => (
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
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setTrocaForm(v)}>Troca/Dev.</button>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ marginBottom: 16 }}>Registrar Troca/Devolução - Venda #{trocaForm.id}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const user = JSON.parse(localStorage.getItem('pdv_user'));
              await window.api.post('/api/trocas', {
                venda_id: trocaForm.id,
                produto_id: fd.get('produto_id') ? Number(fd.get('produto_id')) : null,
                motivo: fd.get('motivo'),
                tipo: fd.get('tipo'),
                novo_produto_id: null,
                observacao: fd.get('observacao'),
                usuario_id: user.id
              });
              setTrocaForm(null);
            }}>
              <div className="form-group">
                <label>Tipo</label>
                <select name="tipo" defaultValue="troca">
                  <option value="troca">Troca</option>
                  <option value="devolucao">Devolução</option>
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
                <button className="btn-secondary" type="button" onClick={() => setTrocaForm(null)} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn-success" type="submit" style={{ flex: 1 }}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
