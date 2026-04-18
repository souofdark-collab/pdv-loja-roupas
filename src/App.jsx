import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Categorias from './pages/Categorias';
import Estoque from './pages/Estoque';
import Clientes from './pages/Clientes';
import PDV from './pages/PDV';
import Vendas from './pages/Vendas';
import Promocoes from './pages/Promocoes';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import Despesas from './pages/Despesas';
import Configuracoes from './pages/Configuracoes';
import FechamentoCaixa from './pages/FechamentoCaixa';
import Trocas from './pages/Trocas';
import Backup from './pages/Backup';
import Auditoria from './pages/Auditoria';
import ControleCaixa from './pages/ControleCaixa';

function applyTheme(cfg) {
  const root = document.documentElement.style;
  if (cfg.cor_accent) root.setProperty('--accent', cfg.cor_accent);
  if (cfg.cor_bg) root.setProperty('--bg-primary', cfg.cor_bg);
  if (cfg.cor_bg_secondary) root.setProperty('--bg-secondary', cfg.cor_bg_secondary);
  if (cfg.cor_card) root.setProperty('--bg-card', cfg.cor_card);
  if (cfg.cor_text) { root.setProperty('--text-primary', cfg.cor_text); root.setProperty('--text-secondary', cfg.cor_text + 'aa'); }
  if (cfg.cor_btn) root.setProperty('--btn-bg', cfg.cor_btn);
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pdv_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showModal, setShowModal] = useState(null); // 'pdv' | 'vendas-geral' | 'vendas-hoje' | 'vendas-semana' | 'vendas-mes'

  useEffect(() => {
    window.api.get('/api/configuracoes').then(applyTheme).catch(() => {});
    const onThemeUpdate = (e) => { if (e.detail) applyTheme(e.detail); };
    window.addEventListener('pdv:theme-updated', onThemeUpdate);
    return () => window.removeEventListener('pdv:theme-updated', onThemeUpdate);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('pdv_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pdv_user');
    }
  }, [user]);

  // Keyboard shortcuts for modals — disabled when PDV is open (let PDV own F2/F4)
  useEffect(() => {
    const handler = (e) => {
      if (showModal === 'pdv') return;
      if (e.key === 'F1') { e.preventDefault(); openModal('pdv'); }
      if (e.key === 'F6') { e.preventDefault(); openModal('vendas-hoje'); }
      if (e.key === 'F7') { e.preventDefault(); openModal('vendas-semana'); }
      if (e.key === 'F8') { e.preventDefault(); openModal('vendas-mes'); }
      if (e.key === 'F9') { e.preventDefault(); openModal('vendas-geral'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  // Auto-logout on window close
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem('pdv_user');
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const pdvCartRef = React.useRef([]);
  const [showPDVCloseConfirm, setShowPDVCloseConfirm] = useState(false);

  const openModal = (type) => { if (!showModal) setShowModal(type); };
  const closeModal = () => {
    document.activeElement?.blur();
    setShowModal(null);
  };
  const handleClosePDV = () => {
    if (pdvCartRef.current.length > 0) {
      setShowPDVCloseConfirm(true);
    } else {
      closeModal();
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard onOpenModal={openModal} />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/clientes" element={<Clientes user={user} />} />
        <Route path="/promocoes" element={<Promocoes />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/usuarios" element={<Usuarios user={user} />} />
        <Route path="/despesas" element={<Despesas user={user} />} />
        <Route path="/fechamento" element={<FechamentoCaixa user={user} />} />
        <Route path="/trocas" element={<Trocas user={user} />} />
        <Route path="/backup" element={<Backup user={user} />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/controle-caixa" element={<ControleCaixa />} />
        <Route path="/configuracoes" element={<Configuracoes user={user} />} />
      </Routes>

      {/* PDV Modal */}
      {showModal === 'pdv' && (
        <div className="modal-overlay" onClick={handleClosePDV}>
          <div className="modal" style={{ width: 780, maxWidth: '90vw', maxHeight: '95vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', zIndex: 1 }} onClick={handleClosePDV}>Fechar</button>
            <PDV user={user} onClose={closeModal} onCartChange={cart => { pdvCartRef.current = cart; }} />
          </div>
          {showPDVCloseConfirm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.stopPropagation()}>
              <div className="card" style={{ maxWidth: 360, width: '90vw', textAlign: 'center', padding: 24 }}>
                <p style={{ marginBottom: 20, fontSize: 15 }}>Fechar o PDV? Os itens do carrinho serão perdidos.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn-secondary" onClick={() => setShowPDVCloseConfirm(false)}>Cancelar</button>
                  <button className="btn-danger" onClick={() => { setShowPDVCloseConfirm(false); closeModal(); }}>Fechar PDV</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vendas Geral Modal (F3) */}
      {showModal === 'vendas-geral' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 1200, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', zIndex: 1 }} onClick={closeModal}>Fechar</button>
            <Vendas onClose={closeModal} />
          </div>
        </div>
      )}

      {/* Vendas Hoje Modal (F1) */}
      {showModal === 'vendas-hoje' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 1200, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', zIndex: 1 }} onClick={closeModal}>Fechar</button>
            <VendasVendas filtro="hoje" onClose={closeModal} />
          </div>
        </div>
      )}

      {/* Vendas Semana Modal (F4) */}
      {showModal === 'vendas-semana' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 1200, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', zIndex: 1 }} onClick={closeModal}>Fechar</button>
            <VendasVendas filtro="semana" onClose={closeModal} />
          </div>
        </div>
      )}

      {/* Vendas Mês Modal (F5) */}
      {showModal === 'vendas-mes' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 1200, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <button className="btn-danger" style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', zIndex: 1 }} onClick={closeModal}>Fechar</button>
            <VendasVendas filtro="mes" onClose={closeModal} />
          </div>
        </div>
      )}
    </Layout>
  );
}

// Wrapper component for filtered Vendas
function VendasVendas({ filtro, onClose }) {
  const [vendas, setVendas] = useState([]);
  const [selectedVenda, setSelectedVenda] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [loginAdmin, setLoginAdmin] = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [senhaErro, setSenhaErro] = useState('');

  const loadVendas = () => {
    const now = new Date();
    let inicio, fim;
    if (filtro === 'hoje') {
      inicio = now.toISOString().split('T')[0];
      fim = inicio;
    } else if (filtro === 'semana') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      inicio = startOfWeek.toISOString().split('T')[0];
      fim = now.toISOString().split('T')[0];
    } else {
      inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      fim = now.toISOString().split('T')[0];
    }
    window.api.get(`/api/vendas?inicio=${inicio}&fim=${fim}`).then(setVendas);
  };

  useEffect(() => { loadVendas(); }, [filtro]);

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;
  const totalFaturado = vendas.filter(v => v.status !== 'cancelada').reduce((s, v) => s + Number(v.total), 0);
  const titulo = filtro === 'hoje' ? 'Vendas Hoje' : filtro === 'semana' ? 'Vendas na Semana' : 'Vendas no Mês';

  const openCancelModal = (venda) => {
    setMotivoCancelamento('');
    setLoginAdmin('');
    setSenhaAdmin('');
    setSenhaErro('');
    setCancelModal(venda);
  };

  const closeCancelModal = () => {
    setCancelModal(null);
    setSenhaAdmin('');
    setLoginAdmin('');
    setSenhaErro('');
    setMotivoCancelamento('');
  };

  const handleConfirmarCancelamento = async () => {
    setSenhaErro('');
    if (!motivoCancelamento.trim()) { setSenhaErro('Informe o motivo do cancelamento.'); return; }
    if (!loginAdmin.trim()) { setSenhaErro('Informe o login do administrador.'); return; }
    try {
      const res = await window.api.post('/api/login', { login: loginAdmin.trim(), senha: senhaAdmin });
      if (res && res.cargo === 'admin') {
        const user = JSON.parse(localStorage.getItem('pdv_user'));
        await window.api.put(`/api/vendas/${cancelModal.id}`, {
          forma_pagamento: cancelModal.forma_pagamento,
          status: 'cancelada',
          usuario_id: user?.id,
          motivo_cancelamento: motivoCancelamento.trim()
        });
        closeCancelModal();
        loadVendas();
      } else {
        setSenhaErro('Usuário não tem permissão de administrador.');
      }
    } catch {
      setSenhaErro('Login ou senha incorretos.');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{titulo}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {vendas.length} vendas | Faturado: {formatCurrency(totalFaturado)}
      </p>

      {cancelModal && (
        <div className="modal-overlay" onClick={closeCancelModal} style={{ position: 'fixed' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Cancelar Venda #{cancelModal.id}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Esta ação é irreversível. Informe o motivo e as credenciais de um administrador.
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
              <input value={loginAdmin} onChange={e => { setLoginAdmin(e.target.value); setSenhaErro(''); }} placeholder="ex: admin" />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input type="password" value={senhaAdmin} onChange={e => { setSenhaAdmin(e.target.value); setSenhaErro(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirmarCancelamento()} placeholder="Senha do administrador" />
              {senhaErro && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{senhaErro}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={closeCancelModal}>Voltar</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleConfirmarCancelamento}>Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
        <table style={{ minWidth: 900 }}>
          <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead>
          <tbody>
            {vendas.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{new Date(v.data).toLocaleString('pt-BR')}</td>
                <td>{v.cliente_nome || '-'}</td>
                <td>{v.usuario_nome}</td>
                <td>{v.forma_pagamento}</td>
                <td>
                  {v.status === 'finalizada' && <span className="badge badge-success">Finalizada</span>}
                  {v.status === 'cancelada' && <span className="badge badge-danger">Cancelada</span>}
                  {v.status === 'devolvida' && <span className="badge badge-warning">Devolvida</span>}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(v.total)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSelectedVenda(v)}>Ver</button>
                    {v.status === 'finalizada' && (
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openCancelModal(v)}>Cancelar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vendas.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma venda no período</p>}
      </div>

      {selectedVenda && (
        <div className="modal-overlay" onClick={() => setSelectedVenda(null)} style={{ position: 'fixed' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
            <h3 style={{ marginBottom: 16 }}>Detalhes da Venda #{selectedVenda.id}</h3>
            <p><strong>Data:</strong> {new Date(selectedVenda.data).toLocaleString('pt-BR')}</p>
            <p><strong>Cliente:</strong> {selectedVenda.cliente_nome || '-'}</p>
            <p><strong>Vendedor:</strong> {selectedVenda.usuario_nome}</p>
            <p><strong>Pagamento:</strong> {selectedVenda.forma_pagamento}</p>
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
            <button className="btn-secondary" onClick={() => setSelectedVenda(null)} style={{ marginTop: 12 }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
