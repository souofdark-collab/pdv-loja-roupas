import React, { useEffect, useState } from 'react';
import Auditoria from './Auditoria';
import Backup from './Backup';
import { useModal } from '../components/Modal';

const ETIQUETA_DEFAULT = { largura: 50, altura: 30, margem: 1.2, barcodeAltura: 10, modelo: 'completo' };
const numberOrDefault = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

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
  const [produtosSemNcm, setProdutosSemNcm] = useState(null);
  const { showAlert, askConfirm, modalEl } = useModal();

  useEffect(() => {
    loadData();
  }, []);

  // Lista de produtos sem NCM é só interessante na aba Fiscal — carrega sob demanda
  // pra não pesar no mount geral da tela de Configurações.
  useEffect(() => {
    if (tab !== 'fiscal' || produtosSemNcm !== null) return;
    window.api.get('/api/produtos').then(produtos => {
      setProdutosSemNcm(produtos.filter(p => !p.ncm));
    });
  }, [tab, produtosSemNcm]);

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
    const payload = {
      cor_accent: configs.cor_accent,
      cor_bg: configs.cor_bg,
      cor_bg_secondary: configs.cor_bg_secondary,
      cor_card: configs.cor_card,
      cor_text: configs.cor_text,
      cor_btn: configs.cor_btn,
      cor_sombra: configs.cor_sombra
    };
    await window.api.put('/api/configuracoes', payload);
    applyTheme(configs);
    window.dispatchEvent(new CustomEvent('pdv:theme-updated', { detail: payload }));
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

  const getEtiquetaConfig = () => {
    try {
      const parsed = JSON.parse(configs.etiqueta_config || '{}') || {};
      return {
        largura: numberOrDefault(parsed.largura, ETIQUETA_DEFAULT.largura),
        altura: numberOrDefault(parsed.altura, ETIQUETA_DEFAULT.altura),
        margem: numberOrDefault(parsed.margem, ETIQUETA_DEFAULT.margem),
        barcodeAltura: numberOrDefault(parsed.barcodeAltura, ETIQUETA_DEFAULT.barcodeAltura),
        modelo: parsed.modelo || ETIQUETA_DEFAULT.modelo
      };
    } catch {
      return ETIQUETA_DEFAULT;
    }
  };

  const setEtiquetaConfig = (patch) => {
    const next = { ...getEtiquetaConfig(), ...patch };
    setConfigs({ ...configs, etiqueta_config: JSON.stringify(next) });
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
          { id: 'taxas_cartao', label: 'Taxas Cartão' },
          { id: 'fiscal', label: 'Fiscal' },
          { id: 'operacional', label: 'Operacional' },
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

      {tab === 'taxas_cartao' && configs && (() => {
        const parseTaxas = () => {
          try { return JSON.parse(configs.taxas_cartao || '{}') || {}; } catch { return {}; }
        };
        const taxas = configs._taxas_cache || parseTaxas();
        const setTaxa = (k, v) => {
          const next = { ...taxas, [k]: v === '' ? '' : Number(v) };
          setConfigs({ ...configs, _taxas_cache: next });
        };
        const parcelas = Array.from({ length: 18 }, (_, i) => i + 1);
        return (
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Taxas do Cartão (juros da operadora)</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Percentual descontado pela operadora em cada venda. Usado para calcular o lucro real (valor líquido) — não é mostrado no recibo.
            </p>
            <div style={{ maxWidth: 500 }}>
              <div className="form-group">
                <label>Débito — Taxa (%)</label>
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={taxas.debito ?? ''}
                  onChange={e => setTaxa('debito', e.target.value)}
                  placeholder="Ex: 1.5"
                />
              </div>
              <h4 style={{ margin: '20px 0 10px' }}>Crédito por parcela</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {parcelas.map(p => (
                  <div key={p} className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 12 }}>{p}x (%)</label>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={taxas[`credito_${p}`] ?? ''}
                      onChange={e => setTaxa(`credito_${p}`, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-success" onClick={async () => {
                const clean = {};
                for (const [k, v] of Object.entries(taxas)) {
                  const n = Number(v);
                  if (v !== '' && !isNaN(n)) clean[k] = n;
                }
                await window.api.put('/api/configuracoes', { taxas_cartao: JSON.stringify(clean) });
                showAlert('Taxas salvas!');
              }}>Salvar</button>

              <button className="btn-secondary" onClick={() => {
                askConfirm(
                  'Aplicar as taxas atuais em todas as vendas já registradas? Esta ação é única — novas alterações de taxa depois disso só afetarão vendas futuras.',
                  async () => {
                    try {
                      const r = await window.api.post('/api/configuracoes/recalc-taxas-vendas', {
                        usuario_id: user?.id,
                        usuario_nome: user?.nome
                      });
                      showAlert(`Recálculo concluído.\n\nVendas alteradas: ${r.alteradas}\nVendas inalteradas: ${r.inalteradas}\nTotal verificado: ${r.total}`);
                    } catch (err) {
                      showAlert('Falha ao recalcular: ' + (err?.message || 'erro desconhecido'));
                    }
                  },
                  { title: 'Recalcular taxas nas vendas existentes', confirmLabel: 'Aplicar agora' }
                );
              }}>Aplicar taxas atuais em vendas existentes</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
              O botão ao lado recalcula retroativamente o valor da taxa e o líquido de todas as vendas já registradas usando os percentuais atuais. Use-o apenas quando quiser sincronizar o histórico — vendas normais continuam guardando a taxa vigente no momento da venda.
            </p>
          </div>
        );
      })()}

      {tab === 'fiscal' && configs && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Dados Fiscais da Empresa</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Inscrição Estadual</label>
              <input value={configs.empresa_ie || ''}
                onChange={e => setConfigs({ ...configs, empresa_ie: e.target.value.replace(/\D/g, '') })}
                placeholder="Apenas números" />
            </div>
            <div className="form-group">
              <label>Inscrição Municipal (opcional)</label>
              <input value={configs.empresa_im || ''}
                onChange={e => setConfigs({ ...configs, empresa_im: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Regime Tributário</label>
              <select value={configs.empresa_regime_tributario || '1'}
                onChange={e => setConfigs({ ...configs, empresa_regime_tributario: e.target.value })}>
                <option value="1">1 - Simples Nacional</option>
                <option value="2">2 - Simples Nacional (excesso sublimite)</option>
                <option value="3">3 - Regime Normal (Presumido/Real)</option>
              </select>
            </div>
            <div className="form-group">
              <label>CNAE Principal</label>
              <input value={configs.empresa_cnae || ''}
                onChange={e => setConfigs({ ...configs, empresa_cnae: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                placeholder="7 dígitos" maxLength={7} />
            </div>
          </div>

          <h4 style={{ marginTop: 20, marginBottom: 12 }}>Endereço Fiscal</h4>
          <div className="form-row">
            <div className="form-group">
              <label>UF</label>
              <select value={configs.empresa_uf || 'SE'}
                onChange={e => setConfigs({ ...configs, empresa_uf: e.target.value })}>
                {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>CEP</label>
              <input value={configs.empresa_cep || ''}
                onChange={e => setConfigs({ ...configs, empresa_cep: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                placeholder="00000000" maxLength={8} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Município</label>
              <input value={configs.empresa_municipio_nome || ''}
                onChange={e => setConfigs({ ...configs, empresa_municipio_nome: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Código IBGE do Município</label>
              <input value={configs.empresa_municipio_ibge || ''}
                onChange={e => setConfigs({ ...configs, empresa_municipio_ibge: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                placeholder="7 dígitos" maxLength={7} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label>Logradouro</label>
              <input value={configs.empresa_logradouro || ''}
                onChange={e => setConfigs({ ...configs, empresa_logradouro: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Número</label>
              <input value={configs.empresa_numero || ''}
                onChange={e => setConfigs({ ...configs, empresa_numero: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Bairro</label>
              <input value={configs.empresa_bairro || ''}
                onChange={e => setConfigs({ ...configs, empresa_bairro: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Complemento</label>
              <input value={configs.empresa_complemento || ''}
                onChange={e => setConfigs({ ...configs, empresa_complemento: e.target.value })} />
            </div>
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Integração Focus NFe</h4>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Token de Homologação</label>
              <input type="password"
                value={configs.nfce_focus_token_homolog || ''}
                onChange={e => setConfigs({ ...configs, nfce_focus_token_homolog: e.target.value })}
                placeholder="Token gerado no painel Focus NFe (ambiente teste)" />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Token de Produção</label>
              <input type="password"
                value={configs.nfce_focus_token_prod || ''}
                onChange={e => setConfigs({ ...configs, nfce_focus_token_prod: e.target.value })}
                placeholder="Token gerado no painel Focus NFe (ambiente real)" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>CSC ID (Token Identificador)</label>
              <input value={configs.nfce_csc_id || ''}
                onChange={e => setConfigs({ ...configs, nfce_csc_id: e.target.value.replace(/\D/g, '') })}
                placeholder="Ex: 000001" />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>CSC Token (Código de Segurança do Contribuinte)</label>
              <input type="password"
                value={configs.nfce_csc_token || ''}
                onChange={e => setConfigs({ ...configs, nfce_csc_token: e.target.value })}
                placeholder="Hash gerado no portal SEFAZ" />
            </div>
            <div className="form-group">
              <label>Série da NFC-e</label>
              <input type="number" min="1" max="999"
                value={configs.nfce_serie || '1'}
                onChange={e => setConfigs({ ...configs, nfce_serie: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Ambiente</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="nfce_ambiente" value="2"
                    checked={String(configs.nfce_ambiente || '2') === '2'}
                    onChange={() => setConfigs({ ...configs, nfce_ambiente: '2' })} />
                  Homologação (testes)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="nfce_ambiente" value="1"
                    checked={String(configs.nfce_ambiente || '2') === '1'}
                    onChange={() => setConfigs({ ...configs, nfce_ambiente: '1' })} />
                  Produção
                </label>
              </div>
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Auto-emitir NFC-e ao finalizar venda</label>
              <div style={{ marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={String(configs.nfce_auto_emitir || '0') === '1'}
                    onChange={e => setConfigs({ ...configs, nfce_auto_emitir: e.target.checked ? '1' : '0' })} />
                  Emitir automaticamente após cada venda no PDV
                </label>
              </div>
            </div>
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Status</h4>
          <div style={{ background: 'var(--bg-main)', padding: 12, borderRadius: 6, fontSize: 13 }}>
            {produtosSemNcm === null && <span style={{ color: 'var(--text-secondary)' }}>Carregando...</span>}
            {produtosSemNcm !== null && produtosSemNcm.length === 0 && (
              <span style={{ color: 'var(--success, #2da44e)' }}>Todos os produtos têm NCM preenchido.</span>
            )}
            {produtosSemNcm !== null && produtosSemNcm.length > 0 && (
              <div>
                <div style={{ color: '#d4a017', marginBottom: 8 }}>
                  {produtosSemNcm.length} produto(s) sem NCM — não emitirão NFC-e até serem corrigidos:
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 120, overflowY: 'auto' }}>
                  {produtosSemNcm.slice(0, 20).map(p => (
                    <li key={p.id} style={{ color: 'var(--text-secondary)' }}>{p.nome}</li>
                  ))}
                  {produtosSemNcm.length > 20 && (
                    <li style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      e mais {produtosSemNcm.length - 20}...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <button className="btn-success" style={{ marginTop: 16 }} onClick={async () => {
            const payload = {
              empresa_ie: configs.empresa_ie || '',
              empresa_im: configs.empresa_im || '',
              empresa_regime_tributario: configs.empresa_regime_tributario || '1',
              empresa_cnae: configs.empresa_cnae || '',
              empresa_uf: configs.empresa_uf || 'SE',
              empresa_cep: configs.empresa_cep || '',
              empresa_municipio_nome: configs.empresa_municipio_nome || '',
              empresa_municipio_ibge: configs.empresa_municipio_ibge || '',
              empresa_logradouro: configs.empresa_logradouro || '',
              empresa_numero: configs.empresa_numero || '',
              empresa_bairro: configs.empresa_bairro || '',
              empresa_complemento: configs.empresa_complemento || '',
              nfce_focus_token_homolog: configs.nfce_focus_token_homolog || '',
              nfce_focus_token_prod: configs.nfce_focus_token_prod || '',
              nfce_csc_id: configs.nfce_csc_id || '',
              nfce_csc_token: configs.nfce_csc_token || '',
              nfce_serie: configs.nfce_serie || '1',
              nfce_ambiente: configs.nfce_ambiente || '2',
              nfce_auto_emitir: configs.nfce_auto_emitir || '0'
            };
            await window.api.put('/api/configuracoes', payload);
            showAlert('Configurações fiscais salvas!');
          }}>
            Salvar Configurações Fiscais
          </button>
        </div>
      )}

      {tab === 'operacional' && configs && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Configurações Operacionais</h3>
          {(() => {
            const etiqueta = getEtiquetaConfig();
            return (
              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: 12 }}>Etiquetas</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Largura da etiqueta (mm)</label>
                    <input
                      type="number"
                      min="25"
                      max="120"
                      step="1"
                      value={etiqueta.largura}
                      onChange={e => setEtiquetaConfig({ largura: numberOrDefault(e.target.value, ETIQUETA_DEFAULT.largura) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Altura da etiqueta (mm)</label>
                    <input
                      type="number"
                      min="15"
                      max="80"
                      step="1"
                      value={etiqueta.altura}
                      onChange={e => setEtiquetaConfig({ altura: numberOrDefault(e.target.value, ETIQUETA_DEFAULT.altura) })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Margem interna (mm)</label>
                    <input
                      type="number"
                      min="0"
                      max="8"
                      step="0.1"
                      value={etiqueta.margem}
                      onChange={e => setEtiquetaConfig({ margem: numberOrDefault(e.target.value, ETIQUETA_DEFAULT.margem) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Altura do código de barras (mm)</label>
                    <input
                      type="number"
                      min="6"
                      max="30"
                      step="1"
                      value={etiqueta.barcodeAltura}
                      onChange={e => setEtiquetaConfig({ barcodeAltura: numberOrDefault(e.target.value, ETIQUETA_DEFAULT.barcodeAltura) })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Modelo da etiqueta</label>
                  <select
                    value={etiqueta.modelo}
                    onChange={e => setEtiquetaConfig({ modelo: e.target.value })}
                  >
                    <option value="completo">Completo: produto, variação, código e preço</option>
                    <option value="sem_preco">Sem preço: produto, variação e código</option>
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Usado na prévia e na impressão de etiquetas do Estoque.
                </p>
              </div>
            );
          })()}

          <div className="form-group">
            <label>Tamanhos disponíveis (separados por vírgula)</label>
            <input
              value={configs.tamanhos_estoque_text !== undefined ? configs.tamanhos_estoque_text : ((() => {
                try { return JSON.parse(configs.tamanhos_estoque || '[]').join(', '); }
                catch { return 'PP, P, M, G, GG, XG, XXG, 36, 38, 40, 42, 44, 46'; }
              })())}
              onChange={e => setConfigs({ ...configs, tamanhos_estoque_text: e.target.value })}
              placeholder="PP, P, M, G, GG, 36, 38, 40..."
            />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Usado no cadastro de Estoque. Use vírgula para separar.
            </p>
          </div>

          <div className="form-group">
            <label>Desconto máximo sem senha (%)</label>
            <input
              type="number" min="0" max="100" step="0.1"
              value={configs.desconto_max_sem_senha ?? 10}
              onChange={e => setConfigs({ ...configs, desconto_max_sem_senha: e.target.value })}
            />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Acima deste percentual no PDV, exige senha de administrador. 0 desabilita.
            </p>
          </div>

          <div className="form-group">
            <label>Chave PIX (QR no cupom)</label>
            <input
              value={configs.pix_chave || ''}
              onChange={e => setConfigs({ ...configs, pix_chave: e.target.value })}
              placeholder="email@empresa.com, CPF, telefone ou chave aleatória"
            />
          </div>

          <div className="form-group">
            <label>Nome do recebedor PIX</label>
            <input
              value={configs.pix_nome || ''}
              onChange={e => setConfigs({ ...configs, pix_nome: e.target.value })}
              placeholder="Ex: Loja XYZ"
              maxLength={25}
            />
          </div>

          <div className="form-group">
            <label>Cidade do recebedor PIX</label>
            <input
              value={configs.pix_cidade || ''}
              onChange={e => setConfigs({ ...configs, pix_cidade: e.target.value })}
              placeholder="Ex: São Paulo"
              maxLength={15}
            />
          </div>

          <button className="btn-success" onClick={async () => {
            const payload = {};
            if (configs.tamanhos_estoque_text !== undefined) {
              const arr = configs.tamanhos_estoque_text.split(',').map(s => s.trim()).filter(Boolean);
              payload.tamanhos_estoque = JSON.stringify(arr);
            }
            payload.desconto_max_sem_senha = Number(configs.desconto_max_sem_senha) || 0;
            payload.pix_chave = configs.pix_chave || '';
            payload.pix_nome = configs.pix_nome || '';
            payload.pix_cidade = configs.pix_cidade || '';
            payload.etiqueta_config = configs.etiqueta_config || JSON.stringify(ETIQUETA_DEFAULT);
            await window.api.put('/api/configuracoes', payload);
            showAlert('Configurações salvas!');
          }}>
            Salvar
          </button>
        </div>
      )}

      {tab === 'auditoria' && <Auditoria />}

      {tab === 'backup' && <Backup user={user} />}

      {modalEl}
    </div>
  );
}
