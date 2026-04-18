import React, { useEffect, useRef, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';
import { fuzzyMatch } from '../utils/fuzzySearch';
import { useModal } from '../components/Modal';

const TAMANHOS_DEFAULT = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', '36', '38', '40', '42', '44', '46'];

export default function Estoque() {
  const [estoque, setEstoque] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [TAMANHOS, setTamanhos] = useState(TAMANHOS_DEFAULT);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ produto_id: '', tamanho: 'M', cor: '', quantidade: '', minimo: '5' });
  const [showMovForm, setShowMovForm] = useState(false);
  const [movForm, setMovForm] = useState({ estoque_id: '', tipo: 'entrada', quantidade: '', motivo: '' });
  const [search, setSearch] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState('');
  const scanRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (scanMode) {
      setScanInput('');
      setScanError('');
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [scanMode]);

  useEffect(() => {
    if (!scanMode) return;
    const handler = () => {
      if (document.activeElement !== scanRef.current && !showForm && !showMovForm) {
        scanRef.current?.focus();
      }
    };
    const t = setInterval(handler, 500);
    return () => clearInterval(t);
  }, [scanMode, showForm, showMovForm]);

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;
    const item = estoque.find(it => it.codigo_barras === code);
    if (item) {
      setScanInput('');
      setScanError('');
      handleOpenForm(item);
    } else {
      setScanError(`Código não encontrado: "${code}"`);
      setScanInput('');
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  };

  const loadData = () => {
    window.api.get('/api/estoque').then(setEstoque);
    window.api.get('/api/produtos').then(setProdutos);
    window.api.get('/api/configuracoes').then(cfg => {
      if (cfg && cfg.tamanhos_estoque) {
        try {
          const parsed = JSON.parse(cfg.tamanhos_estoque);
          if (Array.isArray(parsed) && parsed.length > 0) setTamanhos(parsed);
        } catch { /* use default */ }
      }
    }).catch(() => {});
  };

  const handleOpenForm = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setForm({
        produto_id: item.produto_id,
        tamanho: item.tamanho || '',
        cor: item.cor || '',
        quantidade: item.quantidade,
        minimo: item.minimo,
        codigo_barras: item.codigo_barras || ''
      });
    } else {
      setEditingId(null);
      setForm({ produto_id: '', tamanho: 'M', cor: '', quantidade: '', minimo: '5', codigo_barras: '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await window.api.put(`/api/estoque/${editingId}`, { quantidade: Number(form.quantidade), minimo: Number(form.minimo), tamanho: form.tamanho, cor: form.cor, codigo_barras: form.codigo_barras });
    } else {
      await window.api.post('/api/estoque', { ...form, quantidade: Number(form.quantidade), minimo: Number(form.minimo) });
    }
    setForm({ produto_id: '', tamanho: 'M', cor: '', quantidade: '', minimo: '5', codigo_barras: '' });
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const handleMov = async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('pdv_user'));
    await window.api.post('/api/estoque/movimentacao', { ...movForm, quantidade: Number(movForm.quantidade), usuario_id: user.id });
    setMovForm({ estoque_id: '', tipo: 'entrada', quantidade: '', motivo: '' });
    setShowMovForm(false);
    loadData();
  };

  const { askConfirm, modalEl } = useModal();

  const handleDelete = async (id) => {
    askConfirm('Excluir este item do estoque?', async () => {
      await window.api.delete(`/api/estoque/${id}`);
      loadData();
    });
  };

  const printEtiqueta = (item, qtd = 1) => {
    const produto = produtos.find(p => p.id === item.produto_id);
    const nome = item.produto_nome || (produto ? produto.nome : '');
    const bc = item.codigo_barras || '';
    const preco = produto ? Number(produto.preco_venda).toFixed(2) : '-';
    const cells = Array.from({ length: qtd }).map(() => `
      <div class="etiq">
        <div class="nome">${nome}</div>
        <div class="variacao">${item.tamanho || ''} ${item.cor ? '• ' + item.cor : ''}</div>
        <div class="bc-wrapper">
          <svg id="bc-${bc}" class="barcode"></svg>
        </div>
        <div class="code">${bc}</div>
        <div class="preco">R$ ${preco}</div>
      </div>
    `).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Etiqueta - ${nome}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { size: 50mm 30mm; margin: 2mm; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .sheet { display: flex; flex-wrap: wrap; gap: 3mm; padding: 3mm; }
        .etiq { width: 50mm; height: 30mm; border: 1px dashed #ccc; padding: 2mm; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; page-break-inside: avoid; }
        .nome { font-size: 9pt; font-weight: bold; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .variacao { font-size: 7pt; color: #555; }
        .bc-wrapper { text-align: center; }
        .barcode { max-width: 100%; height: 10mm; }
        .code { font-size: 7pt; text-align: center; font-family: monospace; }
        .preco { font-size: 10pt; font-weight: bold; text-align: right; }
        @media print { .etiq { border: none; } }
      </style>
      </head><body><div class="sheet">${cells}</div>
      <script>
        window.addEventListener('load', function(){
          try {
            document.querySelectorAll('.barcode').forEach(function(el){
              JsBarcode(el, '${bc}', { format: 'CODE128', width: 1.6, height: 40, displayValue: false, margin: 0 });
            });
          } catch(err) {}
          setTimeout(function(){ window.print(); }, 400);
        });
      </script>
      </body></html>`);
    w.document.close();
  };

  const filteredEstoque = estoque.filter(e => {
    if (!search) return true;
    return fuzzyMatch(e.produto_nome, search) ||
      fuzzyMatch(e.tamanho, search) ||
      fuzzyMatch(e.cor, search) ||
      (e.codigo_barras || '').includes(search);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Controle de Estoque</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={scanMode ? 'btn-success' : 'btn-secondary'} onClick={() => setScanMode(!scanMode)}>
            {scanMode ? '✓ Modo Scan' : 'Modo Scan'}
          </button>
          <button className="btn-warning" onClick={() => setShowMovForm(!showMovForm)}>
            Movimentação
          </button>
          <button className="btn-primary" onClick={() => handleOpenForm()}>
            {showForm ? 'Cancelar' : '+ Novo Item'}
          </button>
        </div>
      </div>

      {scanMode && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--accent)', color: '#000' }}>
          <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>📷 Scan:</span>
            <input
              ref={scanRef}
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder="Aponte o leitor para um código de barras..."
              style={{ flex: 1, fontSize: 16 }}
              autoFocus
            />
            <button type="submit" className="btn-primary">Buscar</button>
          </form>
          {scanError && <p style={{ marginTop: 8, color: 'crimson', fontWeight: 700 }}>{scanError}</p>}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Item de Estoque' : 'Adicionar Item ao Estoque'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              {!editingId && (
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Produto *</label>
                  <select value={form.produto_id} onChange={e => setForm({...form, produto_id: e.target.value})} required>
                    <option value="">Selecione...</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              {editingId && (
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Produto</label>
                  <input value={produtos.find(p => p.id === form.produto_id)?.nome || ''} disabled style={{ opacity: 0.7 }} />
                </div>
              )}
              <div className="form-group">
                <label>Tamanho *</label>
                <select value={form.tamanho} onChange={e => setForm({...form, tamanho: e.target.value})}>
                  {TAMANHOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Cor *</label>
                <input value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Quantidade *</label>
                <input type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Mínimo</label>
                <input type="number" value={form.minimo} onChange={e => setForm({...form, minimo: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Código de Barras</label>
                <input value={form.codigo_barras} onChange={e => setForm({...form, codigo_barras: e.target.value})} placeholder="Gerado automaticamente" />
              </div>
            </div>
            <button type="submit" className="btn-success">{editingId ? 'Atualizar' : 'Salvar'}</button>
          </form>
        </div>
      )}

      {showMovForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Movimentação de Estoque</h3>
          <form onSubmit={handleMov}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Item de Estoque *</label>
                <select value={movForm.estoque_id} onChange={e => setMovForm({...movForm, estoque_id: e.target.value})} required>
                  <option value="">Selecione...</option>
                  {estoque.map(e => <option key={e.id} value={e.id}>{e.produto_nome} - {e.tamanho}/{e.cor} (Qtd: {e.quantidade})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo *</label>
                <select value={movForm.tipo} onChange={e => setMovForm({...movForm, tipo: e.target.value})}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>
              <div className="form-group">
                <label>Quantidade *</label>
                <input type="number" value={movForm.quantidade} onChange={e => setMovForm({...movForm, quantidade: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Motivo</label>
                <input value={movForm.motivo} onChange={e => setMovForm({...movForm, motivo: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn-warning">Registrar Movimentação</button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>Itens em Estoque</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Buscar por produto, tamanho, cor ou cód. barras..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <button className="btn-secondary" onClick={() => {
            let csv = 'Produto,Tamanho,Cor,Quantidade,Mínimo,Status\n';
            estoque.forEach(e => {
              const status = e.quantidade <= 0 ? 'Sem estoque' : e.quantidade <= e.minimo ? 'Baixo' : 'OK';
              csv += `${e.produto_nome},${e.tamanho},${e.cor},${e.quantidade},${e.minimo},${status}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `estoque-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}>Exportar CSV</button>
          <button className="btn-secondary" onClick={() => {
            const headers = ['Produto', 'Tamanho', 'Cor', 'Qtd', 'Mín', 'Status'];
            const rows = estoque.map(e => [e.produto_nome, e.tamanho, e.cor, e.quantidade, e.minimo, e.quantidade <= 0 ? 'Sem estoque' : e.quantidade <= e.minimo ? 'Baixo' : 'OK']);
            const total = estoque.length;
            const low = estoque.filter(e => e.quantidade <= e.minimo).length;
            exportPDF({
              title: 'Relatório de Estoque',
              headers, data: rows,
              footer: `${total} itens | ${low} com estoque baixo`,
              filename: `estoque-${new Date().toISOString().split('T')[0]}.pdf`
            });
          }}>Exportar PDF</button>
        </div>
      </div>
      <div className="card">
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Produto</th><th>Tamanho</th><th>Cor</th><th>Qtd</th><th>Mín</th><th>Cód. Barras</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filteredEstoque.map(e => (
                <tr key={e.id}>
                  <td>{e.produto_nome}</td>
                  <td>{e.tamanho || '-'}</td>
                  <td>{e.cor || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{e.quantidade}</td>
                  <td>{e.minimo}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.codigo_barras || '-'}</td>
                  <td>
                    {e.quantidade <= 0 && <span className="badge badge-danger">Sem estoque</span>}
                    {e.quantidade > 0 && e.quantidade <= e.minimo && <span className="badge badge-warning">Baixo</span>}
                    {e.quantidade > e.minimo && <span className="badge badge-success">OK</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(e)}>
                      Editar
                    </button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={!e.codigo_barras} title={!e.codigo_barras ? 'Sem código de barras' : 'Imprimir etiqueta'} onClick={() => printEtiqueta(e, 1)}>
                      Etiqueta
                    </button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(e.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEstoque.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>{search ? 'Nenhum item encontrado' : 'Nenhum item em estoque'}</p>}
        </div>
      </div>

      {modalEl}
    </div>
  );
}
