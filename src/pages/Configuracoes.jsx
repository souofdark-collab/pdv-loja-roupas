import React, { useEffect, useState } from 'react';
import Auditoria from './Auditoria';
import Backup from './Backup';

export default function Configuracoes({ user }) {
  const [tab, setTab] = useState('empresa');
  const [configs, setConfigs] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [pagamentos, setPagamentos] = useState([]);
  const [showNewPag, setShowNewPag] = useState(false);
  const [newPag, setNewPag] = useState({ nome: '', ativa: 1 });
  const [editingPag, setEditingPag] = useState(null);
  const [impressoras, setImpressoras] = useState([]);
  const [loadingImpressoras, setLoadingImpressoras] = useState(false);
  const [modal, setModal] = useState(null);
  const showAlert = (msg) => { document.activeElement?.blur(); setModal({ msg }); };
  const askConfirm = (msg, fn) => { document.activeElement?.blur(); setModal({ msg, onConfirm: fn }); };

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
      showAlert('CNPJ inválido! Verifique os dígitos.');
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
    showAlert('Dados da empresa salvos!');
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
    showAlert('Cores salvas!');
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
    showAlert('Cores resetadas para o padrão!');
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
    askConfirm('Excluir esta forma de pagamento?', async () => {
      await window.api.delete(`/api/formas-pagamento/${id}`);
      loadData();
    });
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
          { id: 'pagamentos', label: 'Formas de Pagamento' },
          { id: 'impressora', label: 'Impressora' },
          { id: 'auditoria', label: 'Auditoria' },
          { id: 'backup', label: 'Backup' }
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

      {/* Impressora */}
      {tab === 'impressora' && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Configuração de Impressora</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Selecione a impressora para impressão automática dos recibos. Quando configurada, os recibos serão enviados diretamente sem abrir a caixa de diálogo do sistema.
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
            <button className="btn-secondary" disabled={loadingImpressoras} onClick={async () => {
              setLoadingImpressoras(true);
              try {
                const lista = await window.electron.getPrinters();
                setImpressoras(lista || []);
              } catch { setImpressoras([]); }
              setLoadingImpressoras(false);
            }}>
              {loadingImpressoras ? 'Buscando...' : 'Buscar Impressoras'}
            </button>
            {impressoras.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{impressoras.length} impressora(s) encontrada(s)</span>
            )}
          </div>

          {impressoras.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Impressora para Recibos</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflow: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: !configs.impressora_padrao ? 'var(--accent)' + '22' : 'var(--bg-primary)', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)' }}>
                  <input type="radio" name="impressora" value="" checked={!configs.impressora_padrao} onChange={() => setConfigs({ ...configs, impressora_padrao: '' })} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Padrão do sistema</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Abre a caixa de diálogo de impressão</div>
                  </div>
                </label>
                {impressoras.map(imp => (
                  <label key={imp.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: configs.impressora_padrao === imp.name ? 'var(--accent)' + '22' : 'var(--bg-primary)', borderRadius: 6, cursor: 'pointer', border: `1px solid ${configs.impressora_padrao === imp.name ? 'var(--accent)' : 'var(--border)'}` }}>
                    <input type="radio" name="impressora" value={imp.name} checked={configs.impressora_padrao === imp.name} onChange={() => setConfigs({ ...configs, impressora_padrao: imp.name })} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{imp.displayName || imp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {imp.isDefault ? 'Padrão do Windows · ' : ''}{imp.status === 0 ? 'Pronta' : 'Status desconhecido'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {configs.impressora_padrao && (
            <div style={{ padding: '10px 14px', background: 'var(--success)' + '22', border: '1px solid var(--success)', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
              Impressora selecionada: <strong>{configs.impressora_padrao}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-success" onClick={async () => {
              await window.api.put('/api/configuracoes', { impressora_padrao: configs.impressora_padrao || '' });
              showAlert('Impressora salva!');
            }}>Salvar</button>
            {configs.impressora_padrao && (
              <button className="btn-secondary" onClick={async () => {
                const html = `<html><body style="font-family:monospace;text-align:center;padding:20px"><h2>Teste de Impressão</h2><p>PDV Loja de Roupas</p><p>${new Date().toLocaleString('pt-BR')}</p></body></html>`;
                const res = await window.electron.printReceipt(html, configs.impressora_padrao);
                if (res.success) showAlert('Página de teste enviada para a impressora!');
                else showAlert('Falha ao imprimir: ' + (res.reason || 'erro desconhecido'));
              }}>Imprimir Teste</button>
            )}
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

      {tab === 'auditoria' && <Auditoria />}

      {tab === 'backup' && <Backup user={user} />}

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
    </div>
  );
}
