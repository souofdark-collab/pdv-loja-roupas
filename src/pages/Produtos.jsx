import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { fuzzyMatch } from '../utils/fuzzySearch';
import { useModal } from '../components/Modal';

// Estado vazio do form. Usado em mount, reset pós-submit e no fluxo "Novo
// Produto" do handleOpenForm. Defaults fiscais cobrem o caso comum (Simples
// Nacional + venda intra-estadual de varejo); NCM fica vazio por escolha
// consciente para o usuário preencher item a item.
const EMPTY_FORM = {
  nome: '', descricao: '', preco_custo: '', preco_venda: '',
  codigo_barras: '', num_variacoes: 1, categoria_id: '',
  ncm: '', cest: '', cfop: '5102', origem_mercadoria: 0,
  csosn: '102', unidade_comercial: 'UN', pis_cst: '49', cofins_cst: '49'
};

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showFiscal, setShowFiscal] = useState(false);
  const [search, setSearch] = useState('');
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [historicoPrecosModal, setHistoricoPrecosModal] = useState(null);
  const [historicoPrecos, setHistoricoPrecos] = useState([]);
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState('');
  const svgRef = useRef(null);
  const scanInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (barcodeProduct && svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcodeProduct.codigo_barras || String(barcodeProduct.id).padStart(12, '0'), {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12
        });
      } catch (e) {
        console.error('Erro ao gerar código de barras:', e);
      }
    }
  }, [barcodeProduct]);

  useEffect(() => {
    if (scanMode) {
      setScanInput('');
      setScanError('');
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  }, [scanMode]);

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    const bc = scanInput.trim();
    const found = produtos.find(p => p.codigo_barras && p.codigo_barras === bc);
    if (found) {
      setScanMode(false);
      setScanInput('');
      setScanError('');
      handleOpenForm(found);
    } else {
      setScanError(`Produto não encontrado: "${scanInput}"`);
      setScanInput('');
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  const loadData = () => {
    window.api.get('/api/produtos').then(setProdutos);
    window.api.get('/api/categorias').then(setCategorias);
  };

  const handleOpenForm = (produto = null) => {
    if (produto) {
      setEditingId(produto.id);
      setForm({
        ...EMPTY_FORM,
        nome: produto.nome,
        descricao: produto.descricao || '',
        preco_custo: produto.preco_custo || '',
        preco_venda: produto.preco_venda,
        codigo_barras: produto.codigo_barras || '',
        categoria_id: produto.categoria_id || '',
        ncm: produto.ncm || '',
        cest: produto.cest || '',
        cfop: produto.cfop || EMPTY_FORM.cfop,
        origem_mercadoria: produto.origem_mercadoria ?? EMPTY_FORM.origem_mercadoria,
        csosn: produto.csosn || EMPTY_FORM.csosn,
        unidade_comercial: produto.unidade_comercial || EMPTY_FORM.unidade_comercial,
        pis_cst: produto.pis_cst || EMPTY_FORM.pis_cst,
        cofins_cst: produto.cofins_cst || EMPTY_FORM.cofins_cst
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setShowFiscal(false);
    setShowForm(true);
  };

  const openHistoricoPrecos = async (produto) => {
    setHistoricoPrecosModal(produto);
    const hist = await window.api.get(`/api/produtos/${produto.id}/historico-precos`);
    setHistoricoPrecos(hist);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('pdv_user'));
    const data = {
      nome: form.nome,
      descricao: form.descricao,
      preco_custo: Number(form.preco_custo),
      preco_venda: Number(form.preco_venda),
      codigo_barras: form.codigo_barras,
      num_variacoes: editingId ? undefined : Number(form.num_variacoes) || 1,
      categoria_id: form.categoria_id || null,
      usuario_id: user?.id,
      ncm: form.ncm,
      cest: form.cest,
      cfop: form.cfop,
      origem_mercadoria: Number(form.origem_mercadoria),
      csosn: form.csosn,
      unidade_comercial: form.unidade_comercial,
      pis_cst: form.pis_cst,
      cofins_cst: form.cofins_cst
    };
    if (editingId) {
      await window.api.put(`/api/produtos/${editingId}`, data);
    } else {
      await window.api.post('/api/produtos', data);
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const generateBarcodeCode = () => {
    const random = Date.now().toString().slice(-10);
    setForm({ ...form, codigo_barras: `789${random}` });
  };

  const { askConfirm, modalEl } = useModal();

  const handleDelete = async (id) => {
    askConfirm('Desativar este produto?', async () => {
      const user = JSON.parse(localStorage.getItem('pdv_user'));
      await window.api.delete(`/api/produtos/${id}`, { usuario_id: user?.id });
      loadData();
    });
  };

  const generateBarcode = (produto) => {
    let codigo = produto.codigo_barras;
    if (!codigo) {
      codigo = String(produto.id).padStart(12, '0');
      // Auto-save the generated code
      window.api.put(`/api/produtos/${produto.id}`, { ...produto, codigo_barras: codigo });
    }
    setBarcodeProduct({ ...produto, codigo_barras: codigo });
  };

  const filtered = search
    ? produtos.filter(p =>
        fuzzyMatch(p.nome, search) ||
        (p.codigo_barras && p.codigo_barras.includes(search))
      )
    : produtos;

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Produtos</h1>
        <button className="btn-primary" onClick={() => handleOpenForm()}>
          + Novo Produto
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 780, width: '92vw', maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Nome *</label>
                  <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required autoFocus />
                </div>
                <div className="form-group">
                  <label>Código de Barras (modelo)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={form.codigo_barras} onChange={e => setForm({...form, codigo_barras: e.target.value})} style={{ flex: 1 }} placeholder="Opcional" />
                    <button type="button" className="btn-secondary" onClick={generateBarcodeCode}
                      style={{ padding: '4px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>Gerar</button>
                  </div>
                </div>
                {!editingId && (
                  <div className="form-group" style={{ minWidth: 160 }}>
                    <label>Variações a cadastrar *</label>
                    <input
                      type="number" min="1" max="200"
                      value={form.num_variacoes}
                      onChange={e => setForm({...form, num_variacoes: e.target.value})}
                      required
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                      {form.num_variacoes > 1 ? `${form.num_variacoes} entradas criadas no estoque (barcode único cada)` : '1 entrada criada no estoque'}
                    </span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} rows={2} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço Custo</label>
                  <input type="number" step="0.01" value={form.preco_custo} onChange={e => setForm({...form, preco_custo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Preço Venda *</label>
                  <input type="number" step="0.01" value={form.preco_venda} onChange={e => setForm({...form, preco_venda: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                    <option value="">Sem categoria</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setShowFiscal(s => !s)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)',
                    fontSize: 14, cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  {showFiscal ? '▾' : '▸'} Dados Fiscais (NFC-e)
                </button>
                {showFiscal && (
                  <div style={{ marginTop: 12 }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>NCM (8 dígitos)</label>
                        <input value={form.ncm}
                          onChange={e => setForm({ ...form, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                          placeholder="Ex: 61091000" maxLength={8} />
                      </div>
                      <div className="form-group">
                        <label>CEST (7 dígitos)</label>
                        <input value={form.cest}
                          onChange={e => setForm({ ...form, cest: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                          placeholder="Opcional" maxLength={7} />
                      </div>
                      <div className="form-group">
                        <label>CFOP</label>
                        <input value={form.cfop}
                          onChange={e => setForm({ ...form, cfop: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          maxLength={4} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Origem da Mercadoria</label>
                        <select value={form.origem_mercadoria}
                          onChange={e => setForm({ ...form, origem_mercadoria: Number(e.target.value) })}>
                          <option value={0}>0 - Nacional</option>
                          <option value={1}>1 - Estrangeira (importação direta)</option>
                          <option value={2}>2 - Estrangeira (mercado interno)</option>
                          <option value={3}>3 - Nacional, mais de 40% conteúdo importado</option>
                          <option value={4}>4 - Nacional (PPB)</option>
                          <option value={5}>5 - Nacional, até 40% conteúdo importado</option>
                          <option value={6}>6 - Estrangeira (importação direta, sem similar nacional)</option>
                          <option value={7}>7 - Estrangeira (mercado interno, sem similar nacional)</option>
                          <option value={8}>8 - Nacional, mais de 70% conteúdo importado</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>CSOSN (Simples Nacional)</label>
                        <select value={form.csosn} onChange={e => setForm({ ...form, csosn: e.target.value })}>
                          <option value="101">101 - Tributada com permissão de crédito</option>
                          <option value="102">102 - Tributada sem permissão de crédito</option>
                          <option value="103">103 - Isenção do ICMS na faixa de receita bruta</option>
                          <option value="201">201 - Tributada com crédito + ST</option>
                          <option value="202">202 - Tributada sem crédito + ST</option>
                          <option value="203">203 - Isenção do ICMS + ST</option>
                          <option value="300">300 - Imune</option>
                          <option value="400">400 - Não tributada</option>
                          <option value="500">500 - ICMS cobrado anteriormente por ST</option>
                          <option value="900">900 - Outros</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Unidade Comercial</label>
                        <input value={form.unidade_comercial}
                          onChange={e => setForm({ ...form, unidade_comercial: e.target.value.toUpperCase().slice(0, 6) })}
                          maxLength={6} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>PIS CST</label>
                        <input value={form.pis_cst}
                          onChange={e => setForm({ ...form, pis_cst: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                          maxLength={2} />
                      </div>
                      <div className="form-group">
                        <label>COFINS CST</label>
                        <input value={form.cofins_cst}
                          onChange={e => setForm({ ...form, cofins_cst: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                          maxLength={2} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }} />
                    </div>
                    {!form.ncm && (
                      <div style={{ fontSize: 12, color: '#d4a017', marginTop: 4 }}>
                        Atenção: NCM vazio impede a emissão de NFC-e para este produto.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-success">{editingId ? 'Atualizar Produto' : 'Salvar Produto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEl}

      {/* Scan Modal */}
      {scanMode && (
        <div className="modal-overlay" onClick={() => { setScanMode(false); setScanInput(''); setScanError(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>&#x1F4E6;</div>
            <h2 style={{ marginBottom: 8 }}>Aguardando Leitura</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Aproxime o leitor de código de barras do produto
            </p>
            <form onSubmit={handleScanSubmit}>
              <input
                ref={scanInputRef}
                value={scanInput}
                onChange={e => { setScanInput(e.target.value); setScanError(''); }}
                placeholder="Código de barras..."
                autoComplete="off"
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 3, marginBottom: 8 }}
              />
              {scanError && (
                <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{scanError}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }}
                  onClick={() => { setScanMode(false); setScanInput(''); setScanError(''); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Buscar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {barcodeProduct && (
        <div className="modal-overlay" onClick={() => setBarcodeProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 16 }}>Código de Barras</h3>
            <div style={{ background: 'white', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <svg ref={svgRef}></svg>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Produto: {barcodeProduct.nome} | Código: {barcodeProduct.codigo_barras}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => { window.print(); }} style={{ flex: 1 }}>Imprimir</button>
              <button className="btn-primary" onClick={() => setBarcodeProduct(null)} style={{ flex: 1 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            placeholder="Buscar produtos"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 16, padding: 12, flex: 1 }}
          />
          <button
            onClick={() => setScanMode(true)}
            title="Buscar por código de barras"
            style={{
              padding: '8px 12px',
              background: 'var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 20,
              borderRadius: 6,
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            &#x1F4E6;
          </button>
        </div>
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Nome</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Código</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.categoria_nome || '-'}</td>
                  <td>{formatCurrency(p.preco_custo)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(p.preco_venda)}</td>
                  <td>{p.codigo_barras || '-'}</td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => generateBarcode(p)}>
                      Código
                    </button>
                    <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(p)}>
                      Editar
                    </button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openHistoricoPrecos(p)}>
                      Preços
                    </button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(p.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhum produto encontrado</p>}
        </div>
      </div>

      {/* Modal histórico de preços */}
      {historicoPrecosModal && (
        <div className="modal-overlay" onClick={() => { setHistoricoPrecosModal(null); setHistoricoPrecos([]); }}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Histórico de Preços — {historicoPrecosModal.nome}</h3>
            {historicoPrecos.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Nenhuma alteração de preço registrada</p>
            ) : (
              <table>
                <thead><tr><th>Data</th><th>Custo Anterior</th><th>Custo Novo</th><th>Venda Anterior</th><th>Venda Nova</th></tr></thead>
                <tbody>
                  {historicoPrecos.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12 }}>{new Date(h.criado_em).toLocaleString('pt-BR')}</td>
                      <td>{formatCurrency(h.preco_custo_anterior)}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(h.preco_custo_novo)}</td>
                      <td>{formatCurrency(h.preco_venda_anterior)}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(h.preco_venda_novo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => { setHistoricoPrecosModal(null); setHistoricoPrecos([]); }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
