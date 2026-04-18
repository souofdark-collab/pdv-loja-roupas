import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { fuzzyMatch } from '../utils/fuzzySearch';
import { useModal } from '../components/Modal';

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: '', descricao: '', preco_custo: '', preco_venda: '', codigo_barras: '', num_variacoes: 1, categoria_id: '' });
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
        nome: produto.nome,
        descricao: produto.descricao || '',
        preco_custo: produto.preco_custo || '',
        preco_venda: produto.preco_venda,
        codigo_barras: produto.codigo_barras || '',
        num_variacoes: 1,
        categoria_id: produto.categoria_id || ''
      });
    } else {
      setEditingId(null);
      setForm({ nome: '', descricao: '', preco_custo: '', preco_venda: '', codigo_barras: '', num_variacoes: 1, categoria_id: '' });
    }
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
      usuario_id: user?.id
    };
    if (editingId) {
      await window.api.put(`/api/produtos/${editingId}`, data);
    } else {
      await window.api.post('/api/produtos', data);
    }
    setForm({ nome: '', descricao: '', preco_custo: '', preco_venda: '', codigo_barras: '', num_variacoes: 1, categoria_id: '' });
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
          {showForm ? 'Cancelar' : '+ Novo Produto'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
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
            <button type="submit" className="btn-success">{editingId ? 'Atualizar Produto' : 'Salvar Produto'}</button>
          </form>
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
