import React, { useEffect, useState } from 'react';

export default function Promocoes() {
  const [promocoes, setPromocoes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nome: '', tipo: 'percentual', valor: '', inicio: '', fim: '', aplicavel_a: 'tudo', ativa: 1
  });
  const [regras, setRegras] = useState([]);
  const [modal, setModal] = useState(null);
  const askConfirm = (msg, fn) => { document.activeElement?.blur(); setModal({ msg, onConfirm: fn }); };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    window.api.get('/api/promocoes').then(setPromocoes);
    window.api.get('/api/categorias').then(setCategorias);
    window.api.get('/api/produtos').then(setProdutos);
  };

  const handleOpenForm = (promocao = null) => {
    if (promocao) {
      setEditingId(promocao.id);
      setForm({
        nome: promocao.nome,
        tipo: promocao.tipo,
        valor: promocao.valor,
        inicio: promocao.inicio || '',
        fim: promocao.fim || '',
        aplicavel_a: promocao.aplicavel_a,
        ativa: promocao.ativa
      });
      // Load existing rules before showing form to avoid flicker
      window.api.get(`/api/promocoes/${promocao.id}/regras`)
        .then(r => { setRegras(r || []); setShowForm(true); })
        .catch(() => { setRegras([]); setShowForm(true); });
      return;
    } else {
      setEditingId(null);
      setForm({ nome: '', tipo: 'percentual', valor: '', inicio: '', fim: '', aplicavel_a: 'tudo', ativa: 1 });
      setRegras([]);
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await window.api.put(`/api/promocoes/${editingId}`, {
        ...form,
        valor: Number(form.valor),
        ativa: Number(form.ativa),
        regras: regras
      });
    } else {
      await window.api.post('/api/promocoes', {
        ...form,
        valor: Number(form.valor),
        ativa: Number(form.ativa),
        regras: regras
      });
    }
    setForm({ nome: '', tipo: 'percentual', valor: '', inicio: '', fim: '', aplicavel_a: 'tudo', ativa: 1 });
    setRegras([]);
    setShowForm(false);
    setEditingId(null);
    loadData();
  };

  const addRegra = () => {
    if (form.aplicavel_a === 'categoria') {
      setRegras([...regras, { categoria_id: '', produto_id: null }]);
    } else if (form.aplicavel_a === 'produto') {
      setRegras([...regras, { categoria_id: null, produto_id: '' }]);
    }
  };

  const updateRegra = (index, field, value) => {
    setRegras(regras.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleDelete = async (id) => {
    askConfirm('Excluir esta promoção?', async () => {
      await window.api.delete(`/api/promocoes/${id}`);
      loadData();
    });
  };

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Promoções</h1>
        <button className="btn-primary" onClick={() => handleOpenForm()}>
          {showForm ? 'Cancelar' : '+ Nova Promoção'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Promoção' : 'Nova Promoção'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nome *</label>
                <input type="text" autoComplete="off" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor">Valor Fixo (R$)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Valor *</label>
                <input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Início</label>
                <input type="date" value={form.inicio} onChange={e => setForm({...form, inicio: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Fim</label>
                <input type="date" value={form.fim} onChange={e => setForm({...form, fim: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Aplicável a</label>
                <select value={form.aplicavel_a} onChange={e => setForm({...form, aplicavel_a: e.target.value, regras: [] })}>
                  <option value="tudo">Toda a Loja</option>
                  <option value="categoria">Categoria Específica</option>
                  <option value="produto">Produto Específico</option>
                </select>
              </div>
            </div>

            {form.aplicavel_a !== 'tudo' && (
              <div className="form-group">
                <label>Regras</label>
                {regras.map((regra, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {form.aplicavel_a === 'categoria' && (
                      <select value={regra.categoria_id} onChange={e => updateRegra(i, 'categoria_id', e.target.value)}>
                        <option value="">Selecione categoria...</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    )}
                    {form.aplicavel_a === 'produto' && (
                      <select value={regra.produto_id} onChange={e => updateRegra(i, 'produto_id', e.target.value)}>
                        <option value="">Selecione produto...</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addRegra} style={{ marginTop: 8 }}>+ Adicionar Regra</button>
              </div>
            )}

            <div className="form-group">
              <label>Status</label>
              <select value={form.ativa} onChange={e => setForm({...form, ativa: Number(e.target.value)})}>
                <option value={1}>Ativa</option>
                <option value={0}>Inativa</option>
              </select>
            </div>

            <button type="submit" className="btn-success">{editingId ? 'Atualizar Promoção' : 'Salvar Promoção'}</button>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Valor</th><th>Início</th><th>Fim</th><th>Aplicável</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {promocoes.map(p => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.tipo === 'percentual' ? '%' : 'R$'}</td>
                  <td>{p.tipo === 'percentual' ? `${p.valor}%` : formatCurrency(p.valor)}</td>
                  <td>{p.inicio ? new Date(p.inicio).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{p.fim ? new Date(p.fim).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{p.aplicavel_a}</td>
                  <td>
                    {p.ativa ? <span className="badge badge-success">Ativa</span> : <span className="badge badge-danger">Inativa</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleOpenForm(p)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(p.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {promocoes.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma promoção cadastrada</p>}
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setModal(null)}>
          <div className="card" style={{ maxWidth: 360, width: '90vw', textAlign: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
            <p style={{ marginBottom: 20, fontSize: 15 }}>{modal.msg}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { setModal(null); modal.onConfirm(); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
