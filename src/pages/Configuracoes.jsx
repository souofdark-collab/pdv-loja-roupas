import React, { useEffect, useState } from 'react';

export default function Configuracoes({ user }) {
  const [tab, setTab] = useState('empresa');
  const [configs, setConfigs] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [pagamentos, setPagamentos] = useState([]);
  const [showNewPag, setShowNewPag] = useState(false);
  const [newPag, setNewPag] = useState({ nome: '', ativa: 1 });
  const [editingPag, setEditingPag] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/configuracoes').then(data => {
      setConfigs(data);
      if (data.empresa_logo) setLogoPreview(data.empresa_logo);
    });
    window.api.get('/api/formas-pagamento').then(setPagamentos);
  };

  const formatCNPJ = (v) => {
    let d = v.replace(/\D/g, '').slice(0, 14);
    if (d.length > 12) d = d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
    else if (d.length > 8) d = d.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
    else if (d.length > 5) d = d.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (d.length > 2) d = d.replace(/(\d{2})(\d{1,3})/, '$1.$2');
    return d;
  };

  const validateCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    let len = cnpj.length - 2;
    let numeros = cnpj.substring(0, len);
    let digitos = cnpj.substring(len);
    let soma = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) { soma += numeros.charAt(len - i) * pos--; if (pos < 2) pos = 9; }
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;
    len = len + 1;
    numeros = cnpj.substring(0, len);
    soma = 0;
    pos = len - 7;
    for (let i = len; i >= 1; i--) { soma += numeros.charAt(len - i) * pos--; if (pos < 2) pos = 9; }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;
    return true;
  };

  const handleSaveEmpresa = async () => {
    if (configs.empresa_cnpj && !validateCNPJ(configs.empresa_cnpj)) {
      alert('CNPJ inválido! Verifique os dígitos.');
      return;
    }
    await window.api.put('/api/configuracoes', {
      empresa_nome: configs.empresa_nome,
      empresa_cnpj: configs.empresa_cnpj,
      empresa_contato: configs.empresa_contato,
      empresa_email: configs.empresa_email,
      empresa_endereco: configs.empresa_endereco,
      empresa_logo: configs.empresa_logo || ''
    });
    alert('Dados da empresa salvos!');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setConfigs({ ...configs, empresa_logo: base64 });
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTema = async () => {
    await window.api.put('/api/configuracoes', {
      cor_accent: configs.cor_accent,
      cor_bg: configs.cor_bg,
      cor_bg_secondary: configs.cor_bg_secondary,
      cor_card: configs.cor_card,
      cor_text: configs.cor_text,
      cor_btn: configs.cor_btn,
      cor_sombra: configs.cor_sombra
    });
    applyTheme(configs);
    alert('Cores salvas!');
  };

  const handleResetCores = async () => {
    const defaults = {
      cor_accent: '#E94560',
      cor_bg: '#0F0F1A',
      cor_bg_secondary: '#1A1A2E',
      cor_card: '#16213E',
      cor_text: '#EAEAEA',
      cor_btn: '#E94560',
      cor_sombra: '#E94560'
    };
    setConfigs({ ...configs, ...defaults });
    await window.api.put('/api/configuracoes', defaults);
    applyTheme({ ...configs, ...defaults });
    alert('Cores resetadas para o padrão!');
  };

  const applyTheme = (cfg) => {
    const root = document.documentElement.style;
    if (cfg.cor_accent) root.setProperty('--accent', cfg.cor_accent);
    if (cfg.cor_bg) root.setProperty('--bg-primary', cfg.cor_bg);
    if (cfg.cor_bg_secondary) root.setProperty('--bg-secondary', cfg.cor_bg_secondary);
    if (cfg.cor_card) root.setProperty('--bg-card', cfg.cor_card);
    if (cfg.cor_text) { root.setProperty('--text-primary', cfg.cor_text); root.setProperty('--text-secondary', cfg.cor_text + 'aa'); }
    if (cfg.cor_btn) root.setProperty('--btn-bg', cfg.cor_btn);
  };

  // Payment methods
  const handleSavePagamento = async (pag) => {
    if (pag.id) {
      await window.api.put(`/api/formas-pagamento/${pag.id}`, pag);
      setEditingPag(null);
    } else {
      await window.api.post('/api/formas-pagamento', pag);
      setNewPag({ nome: '', ativa: 1 });
      setShowNewPag(false);
    }
    loadData();
  };

  const handleDeletePag = async (id) => {
    if (confirm('Excluir esta forma de pagamento?')) {
      await window.api.delete(`/api/formas-pagamento/${id}`);
      loadData();
    }
  };

  if (!configs) return <div>Carregando...</div>;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Configurações</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'empresa', label: 'Dados da Empresa' },
          { id: 'tema', label: 'Tema e Cores' },
          { id: 'pagamentos', label: 'Formas de Pagamento' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderBottom: tab === t.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: tab === t.id ? '8px 8px 0 0' : 0,
              cursor: 'pointer',
              fontSize: 14,
              marginBottom: -1,
              position: 'relative'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dados da Empresa */}
      {tab === 'empresa' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Dados da Empresa</h3>

          {/* Logo */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>Logo da Empresa</label>
              <div style={{
                width: 120, height: 120, border: '2px dashed var(--border)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                cursor: 'pointer', background: 'var(--bg-main)'
              }} onClick={() => document.getElementById('logo-input').click()}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                ) : (
                  <span style={{ fontSize: 32, color: 'var(--text-secondary)' }}>+</span>
                )}
              </div>
              <input id="logo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              {logoPreview && (
                <button className="btn-secondary" onClick={() => { setConfigs({ ...configs, empresa_logo: '' }); setLogoPreview(''); }}
                  style={{ marginTop: 8, fontSize: 11, padding: '2px 6px' }}>
                  Remover logo
                </button>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Nome da Empresa</label>
              <input value={configs.empresa_nome || ''} onChange={e => setConfigs({ ...configs, empresa_nome: e.target.value })} />
            </div>
            <div className="form-group">
              <label>CNPJ</label>
              <input value={configs.empresa_cnpj || ''} onChange={e => setConfigs({ ...configs, empresa_cnpj: formatCNPJ(e.target.value) })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contato</label>
              <input value={configs.empresa_contato || ''} onChange={e => setConfigs({ ...configs, empresa_contato: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={configs.empresa_email || ''} onChange={e => setConfigs({ ...configs, empresa_email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Endereço</label>
            <input value={configs.empresa_endereco || ''} onChange={e => setConfigs({ ...configs, empresa_endereco: e.target.value })} />
          </div>
          <button className="btn-success" onClick={handleSaveEmpresa}>Salvar Dados da Empresa</button>
        </div>
      )}

      {/* Tema e Cores */}
      {tab === 'tema' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Cores</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Cor Principal (Accent)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_accent || '#E94560'} onChange={e => setConfigs({ ...configs, cor_accent: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_accent || '#E94560'} onChange={e => setConfigs({ ...configs, cor_accent: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label>Cor do Background</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_bg || '#0F0F1A'} onChange={e => setConfigs({ ...configs, cor_bg: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_bg || '#0F0F1A'} onChange={e => setConfigs({ ...configs, cor_bg: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Cor do Menu Lateral</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_bg_secondary || '#1A1A2E'} onChange={e => setConfigs({ ...configs, cor_bg_secondary: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_bg_secondary || '#1A1A2E'} onChange={e => setConfigs({ ...configs, cor_bg_secondary: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label>Cor dos Cards</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_card || '#16213E'} onChange={e => setConfigs({ ...configs, cor_card: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_card || '#16213E'} onChange={e => setConfigs({ ...configs, cor_card: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Cor das Fontes</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_text || '#EAEAEA'} onChange={e => setConfigs({ ...configs, cor_text: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_text || '#EAEAEA'} onChange={e => setConfigs({ ...configs, cor_text: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label>Cor dos Botões</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_btn || '#E94560'} onChange={e => setConfigs({ ...configs, cor_btn: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_btn || '#E94560'} onChange={e => setConfigs({ ...configs, cor_btn: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Cor da Sombra (Hover)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={configs.cor_sombra || '#E94560'} onChange={e => setConfigs({ ...configs, cor_sombra: e.target.value })}
                  style={{ width: 50, height: 36, border: 'none', cursor: 'pointer', padding: 0 }} />
                <input value={configs.cor_sombra || '#E94560'} onChange={e => setConfigs({ ...configs, cor_sombra: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-success" onClick={handleSaveTema}>Salvar Cores</button>
            <button className="btn-secondary" onClick={handleResetCores}>Resetar Padrão</button>
          </div>
        </div>
      )}

      {/* Formas de Pagamento */}
      {tab === 'pagamentos' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Formas de Pagamento</h3>
            <button className="btn-primary" onClick={() => setShowNewPag(!showNewPag)} style={{ fontSize: 12, padding: '4px 10px' }}>
              {showNewPag ? 'Cancelar' : '+ Nova Forma'}
            </button>
          </div>

          {showNewPag && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, padding: 12, background: 'var(--bg-main)', borderRadius: 6 }}>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>Nome</label>
                <input type="text" autoComplete="off" value={newPag.nome} onChange={e => setNewPag({ ...newPag, nome: e.target.value })} placeholder="Ex: Boleto" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Status</label>
                <select value={newPag.ativa} onChange={e => setNewPag({ ...newPag, ativa: Number(e.target.value) })}>
                  <option value={1}>Ativa</option>
                  <option value={0}>Inativa</option>
                </select>
              </div>
              <button className="btn-success" onClick={() => { if (newPag.nome) handleSavePagamento(newPag); }} style={{ padding: '4px 10px', fontSize: 12 }}>
                Salvar
              </button>
            </div>
          )}

          <table>
            <thead>
              <tr><th>Nome</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {pagamentos.map(p => (
                <tr key={p.id}>
                  <td>
                    {editingPag === p.id ? (
                      <input type="text" autoComplete="off" value={newPag.nome} onChange={e => setNewPag({ ...newPag, nome: e.target.value })}
                        style={{ width: '100%' }} />
                    ) : (
                      p.nome
                    )}
                  </td>
                  <td>
                    {p.ativa ? <span className="badge badge-success">Ativa</span> : <span className="badge badge-danger">Inativa</span>}
                  </td>
                  <td>
                    {editingPag === p.id ? (
                      <>
                        <button className="btn-success" style={{ padding: '4px 10px', fontSize: 12, marginRight: 4 }}
                          onClick={() => handleSavePagamento({ id: p.id, nome: newPag.nome, ativa: newPag.ativa })}>
                          Salvar
                        </button>
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12, marginRight: 4 }}
                          onClick={() => { setEditingPag(null); setNewPag({ nome: '', ativa: 1 }); }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12, marginRight: 4 }}
                          onClick={() => { setEditingPag(p.id); setNewPag({ nome: p.nome, ativa: p.ativa }); }}>
                          Editar
                        </button>
                        <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12, marginRight: 4 }}
                          onClick={() => handleSavePagamento({ id: p.id, nome: p.nome, ativa: p.ativa ? 0 : 1 })}>
                          {p.ativa ? 'Desativar' : 'Ativar'}
                        </button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDeletePag(p.id)}>
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagamentos.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma forma de pagamento cadastrada</p>}
        </div>
      )}
    </div>
  );
}
