import React, { useCallback, useEffect, useRef, useState } from 'react';

export default function PDV({ user, onClose, onCartChange }) {
  const [produtos, setProdutos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [promocoes, setPromocoes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedVendedor, setSelectedVendedor] = useState(null);
  const [showVendedorSelect, setShowVendedorSelect] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cashFieldVisible, setCashFieldVisible] = useState(false);
  const cashInputRef = useRef(null);

  useEffect(() => {
    if (cashFieldVisible && cashInputRef.current) {
      cashInputRef.current.focus();
    }
  }, [cashFieldVisible]);

  const [cashGiven, setCashGiven] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showClientSelect, setShowClientSelect] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nome: '', cpf: '', telefone: '', email: '', endereco: '' });
  const [completedSale, setCompletedSale] = useState(null);
  const [salePaymentInfo, setSalePaymentInfo] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [descontoGlobal, setDescontoGlobal] = useState('');
  const [descontoGlobalTipo, setDescontoGlobalTipo] = useState('percentual');
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeInputRef = useRef(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [vendedorSearch, setVendedorSearch] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [config, setConfig] = useState({});
  const searchInputRef = useRef(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (barcodeMode) {
      setBarcodeInput('');
      setBarcodeError('');
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  }, [barcodeMode]);

  const loadData = () => {
    window.api.get('/api/produtos').then(setProdutos).catch(() => {});
    window.api.get('/api/estoque').then(setEstoque).catch(() => {});
    window.api.get('/api/clientes').then(setClientes).catch(() => {});
    window.api.get('/api/usuarios').then(users => setVendedores(users.filter(u => u.cargo === 'vendedor' && u.ativo))).catch(() => {});
    window.api.get('/api/promocoes/ativas').then(setPromocoes).catch(() => {});
    window.api.get('/api/formas-pagamento').then(pags => setFormasPagamento(pags.filter(p => p.ativa))).catch(() => {});
    window.api.get('/api/configuracoes').then(setConfig).catch(() => {});
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2' && cart.length > 0) { e.preventDefault(); setShowCheckout(true); }
      if (e.key === 'F4' && cart.length > 0) { e.preventDefault(); if (confirm('Cancelar venda? Todos os itens serão removidos do carrinho.')) setCart([]); }
      // Enter on numeric barcode search - auto-add to cart
      if (e.key === 'Enter' && searchTerm && /^\d+$/.test(searchTerm)) {
        e.preventDefault();
        const found = produtos.find(p => p.codigo_barras && p.codigo_barras.includes(searchTerm));
        if (found) addToCart(found);
        else alert('Produto com código de barras não encontrado');
      }
      // ESC to close modals
      if (e.key === 'Escape') {
        if (showReceipt && completedSale) {
          e.preventDefault();
          setShowReceipt(false);
          setCompletedSale(null);
        } else if (showCheckout) {
          e.preventDefault();
          setShowCheckout(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, searchTerm, produtos, showCheckout, showReceipt, completedSale]);

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const found = produtos.find(p => p.codigo_barras && p.codigo_barras === barcodeInput.trim());
    if (found) {
      addToCart(found);
      setBarcodeMode(false);
      setBarcodeInput('');
      setBarcodeError('');
    } else {
      setBarcodeError(`Produto não encontrado: "${barcodeInput}"`);
      setBarcodeInput('');
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  };

  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [manualSearch, setManualSearch] = useState(false);
  const productModalInputRef = useRef(null);

  useEffect(() => {
    if (showProductModal) {
      setSearchTerm('');
      setSearchResults([]);
      setCategoryFilter(null);
      setTimeout(() => productModalInputRef.current?.focus(), 50);
    }
  }, [showProductModal]);

  const searchProduct = useCallback((term) => {
    if (!term) { setSearchResults([]); return; }
    const filtered = produtos.filter(p =>
      (p.nome.toLowerCase().includes(term.toLowerCase()) ||
      (p.codigo_barras && p.codigo_barras === term)) &&
      (!categoryFilter || p.categoria_id === categoryFilter)
    );
    setSearchResults(filtered);
  }, [produtos, categoryFilter]);

  // Only auto-search when user is typing (not on initial focus)
  useEffect(() => {
    if (manualSearch) {
      searchProduct(searchTerm);
    }
  }, [searchTerm, searchProduct, manualSearch]);

  const categoriasFiltro = React.useMemo(() => {
    const seen = new Map();
    produtos.forEach(p => {
      if (p.categoria_id && p.categoria_nome && !seen.has(p.categoria_id)) {
        seen.set(p.categoria_id, p.categoria_nome);
      }
    });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos]);

  const handleSearchFocus = () => {
    setSearchActive(true);
    setManualSearch(false);
    if (!searchTerm) {
      const base = categoryFilter ? produtos.filter(p => p.categoria_id === categoryFilter) : [...produtos].reverse().slice(0, 10);
      setSearchResults(base);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setManualSearch(true);
    setSearchActive(true);
    searchProduct(e.target.value);
  };

  const handleSearchBlur = () => {
    // Delay so onClick can fire
    setTimeout(() => setSearchActive(false), 200);
  };

  const addToCart = (produto) => {
    const estoqueItem = estoque.find(e => e.produto_id === produto.id && e.quantidade > 0);
    if (!estoqueItem) {
      alert('Produto sem estoque disponível');
      return;
    }

    // Check for product-specific active promotion
    const promoAplicavel = promocoes.find(p =>
      p.aplicavel_a === 'produto' &&
      p.regras && p.regras.some(r => Number(r.produto_id) === produto.id)
    );
    let preco = produto.preco_venda;
    let promoNome = null;
    if (promoAplicavel) {
      if (promoAplicavel.tipo === 'percentual') {
        preco = preco * (1 - promoAplicavel.valor / 100);
      } else {
        preco = Math.max(0, preco - promoAplicavel.valor);
      }
      promoNome = promoAplicavel.nome;
    }

    const existing = cart.find(c => c.estoque_id === estoqueItem.id);
    if (existing) {
      if (existing.quantidade >= estoqueItem.quantidade) {
        alert('Estoque insuficiente');
        return;
      }
      setCart(cart.map(c => c.estoque_id === estoqueItem.id ? { ...c, quantidade: c.quantidade + 1 } : c));
    } else {
      setCart([...cart, {
        estoque_id: estoqueItem.id,
        produto_id: produto.id,
        produto_nome: produto.nome,
        preco_unitario: preco,
        preco_original: produto.preco_venda,
        promo_aplicada: promoNome,
        quantidade: 1,
        desconto_item: 0,
        tamanho: estoqueItem.tamanho,
        cor: estoqueItem.cor
      }]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  useEffect(() => {
    if (onCartChange) onCartChange(cart);
  }, [cart]);

  const removeFromCart = (estoque_id) => {
    setCart(cart.filter(c => c.estoque_id !== estoque_id));
  };

  const updateCartQty = (estoque_id, qty) => {
    const estoqueItem = estoque.find(e => e.id === estoque_id);
    if (qty > estoqueItem.quantidade) {
      alert('Estoque insuficiente');
      return;
    }
    if (qty <= 0) {
      removeFromCart(estoque_id);
      return;
    }
    setCart(cart.map(c => c.estoque_id === estoque_id ? { ...c, quantidade: qty } : c));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.preco_unitario * item.quantidade), 0);
  const descontosItens = cart.reduce((sum, item) => sum + ((item.desconto_item || 0) * item.quantidade), 0);

  // Auto-calculate discount from active promotions (exclude product-specific — those are baked into item prices)
  const descontoPromocao = React.useMemo(() => {
    let desc = 0;
    for (const prom of promocoes) {
      if (prom.aplicavel_a === 'produto') continue;
      if (prom.tipo === 'percentual') {
        desc += subtotal * (prom.valor / 100);
      } else {
        desc += prom.valor;
      }
    }
    return desc;
  }, [promocoes, subtotal]);

  // Manual global discount
  const descontoManual = descontoGlobal ? (descontoGlobalTipo === 'percentual' ? subtotal * (Number(descontoGlobal) / 100) : Number(descontoGlobal)) : 0;

  const descontos = descontosItens + descontoPromocao + descontoManual;
  const total = Math.max(0, subtotal - descontos);
  const troco = cashFieldVisible ? Math.max(0, Number(cashGiven) - total) : 0;

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    if (!selectedClient) {
      alert('Selecione um cliente antes de finalizar a venda');
      return;
    }
    if (!selectedVendedor) {
      alert('Selecione um vendedor antes de finalizar a venda');
      return;
    }
    if (cashFieldVisible && Number(cashGiven) < total) {
      alert('Valor insuficiente');
      return;
    }
    try {
      const sale = await window.api.post('/api/vendas', {
        cliente_id: selectedClient ? selectedClient.id : null,
        usuario_id: user.id,
        vendedor_id: selectedVendedor ? selectedVendedor.id : null,
        itens: cart.map(c => ({
          estoque_id: c.estoque_id,
          produto_id: c.produto_id,
          quantidade: c.quantidade,
          preco_unitario: c.preco_unitario,
          desconto_item: c.desconto_item || 0
        })),
        forma_pagamento: paymentMethod,
        desconto: descontos,
        parcelas: paymentMethod.toLowerCase().includes('crédito') ? parcelas : null
      });
      setCompletedSale(sale);
      const isDinheiro = cashFieldVisible;
      setSalePaymentInfo({ paymentMethod, cashGiven: isDinheiro ? Number(cashGiven) : null, troco: isDinheiro ? Math.max(0, Number(cashGiven) - total) : null });
      setCart([]);
      setCashGiven('');
      setSelectedVendedor(null);
      setShowCheckout(false);
      setShowReceipt(true);
      // Refresh data
      window.api.get('/api/estoque').then(setEstoque);
      window.api.get('/api/produtos').then(setProdutos);
    } catch (err) {
      alert(err?.message || 'Erro ao finalizar venda');
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    const result = await window.api.post('/api/clientes', newClientForm);
    // Reload clients and select the new one
    const updated = await window.api.get('/api/clientes');
    setClientes(updated);
    const created = updated.find(c => c.id === result.id);
    if (created) setSelectedClient(created);
    setNewClientForm({ nome: '', cpf: '', telefone: '', email: '', endereco: '' });
    setShowNewClient(false);
    setShowClientSelect(false);
  };

  const buildReceiptHTML = (sale, payInfo) => {
    const empresa = config.empresa_nome || 'TS Concept PDV';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cupom - Venda #${sale.id}</title>
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
        <p class="center bold" style="font-size:14px">${empresa}</p>
        ${config.empresa_endereco ? `<p class="center">${config.empresa_endereco}</p>` : ''}
        ${config.empresa_cnpj ? `<p class="center">CNPJ: ${config.empresa_cnpj}</p>` : ''}
        ${config.empresa_contato ? `<p class="center">Tel: ${config.empresa_contato}</p>` : ''}
        <div class="line"></div>
        <p class="center bold">Venda #${sale.id}</p>
        <p>Data: ${new Date(sale.data).toLocaleString('pt-BR')}</p>
        <div class="line"></div>
        ${selectedClient ? `<p><b>Cliente:</b> ${selectedClient.nome}${selectedClient.cpf ? ` | CPF: ${selectedClient.cpf}` : ''}</p>` : ''}
        <p>Caixa: ${user.nome}</p>
        ${selectedVendedor ? `<p>Vendedor: ${selectedVendedor.nome}</p>` : ''}
        <div class="line"></div>
        ${sale.itens.map(item => `
          <div class="item">
            ${item.produto_nome} (${item.tamanho || '-'}/${item.cor || '-'})<br/>
            ${item.quantidade} x ${formatCurrency(item.preco_unitario)} = ${formatCurrency(item.quantidade * item.preco_unitario)}
          </div>
        `).join('')}
        <div class="line"></div>
        <p>Subtotal: ${formatCurrency(sale.subtotal)}</p>
        ${sale.desconto > 0 ? `<p>Desconto: -${formatCurrency(sale.desconto)}</p>` : ''}
        <p class="total">TOTAL: ${formatCurrency(sale.total)}</p>
        <p>Pagamento: ${payInfo ? payInfo.paymentMethod : ''}</p>
        ${payInfo && payInfo.cashGiven !== null ? `<p>Recebido: ${formatCurrency(payInfo.cashGiven)}</p><p>Troco: ${formatCurrency(payInfo.troco)}</p>` : ''}
        <div class="line"></div>
        <p class="center">Obrigado pela preferência!</p>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (!completedSale) return;
    const html = buildReceiptHTML(completedSale, salePaymentInfo);
    const printerName = config.impressora_padrao;
    if (printerName && window.electron?.printReceipt) {
      const res = await window.electron.printReceipt(html, printerName);
      if (!res.success) alert('Falha ao imprimir: ' + (res.reason || 'erro'));
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
  };

  if (showReceipt && completedSale) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="card" ref={receiptRef} style={{ maxWidth: 400, width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 16 }}>✅ Venda Finalizada</h2>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{config.empresa_nome || 'TS Concept PDV'}</p>
            {config.empresa_endereco && <p style={{ textAlign: 'center', fontSize: 12 }}>{config.empresa_endereco}</p>}
            {config.empresa_cnpj && <p style={{ textAlign: 'center', fontSize: 12 }}>CNPJ: {config.empresa_cnpj}</p>}
            {config.empresa_contato && <p style={{ textAlign: 'center', fontSize: 12 }}>Tel: {config.empresa_contato}</p>}
            <p>--------------------------------</p>
            <p><strong>Venda #{completedSale.id}</strong></p>
            <p>Data: {new Date(completedSale.data).toLocaleString('pt-BR')}</p>
            <p>--------------------------------</p>
            {selectedClient && <p>Cliente: {selectedClient.nome}{selectedClient.cpf ? ` | CPF: ${selectedClient.cpf}` : ''}</p>}
            <p>Caixa: {user.nome}</p>
            {selectedVendedor && <p>Vendedor: {selectedVendedor.nome}</p>}
            <p>--------------------------------</p>
            {completedSale.itens.map((item, i) => (
              <p key={i}>
                {item.produto_nome} ({item.tamanho || '-'}/{item.cor || '-'})<br />
                {item.quantidade} x {formatCurrency(item.preco_unitario)} = {formatCurrency(item.quantidade * item.preco_unitario)}
              </p>
            ))}
            <p>--------------------------------</p>
            <p>Subtotal: {formatCurrency(completedSale.subtotal)}</p>
            {completedSale.desconto > 0 && <p>Desconto: -{formatCurrency(completedSale.desconto)}</p>}
            <p style={{ fontSize: 18, fontWeight: 700 }}>TOTAL: {formatCurrency(completedSale.total)}</p>
            <p>Pagamento: {salePaymentInfo ? salePaymentInfo.paymentMethod : ''}</p>
            {salePaymentInfo && salePaymentInfo.cashGiven !== null && <p>Recebido: {formatCurrency(salePaymentInfo.cashGiven)}</p>}
            {salePaymentInfo && salePaymentInfo.troco !== null && <p>Troco: {formatCurrency(salePaymentInfo.troco)}</p>}
            <p>--------------------------------</p>
            <p style={{ textAlign: 'center' }}>Obrigado pela preferência!</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={handlePrint} style={{ flex: 1 }}>Imprimir</button>
            <button className="btn-primary" onClick={() => { setShowReceipt(false); setCompletedSale(null); }} style={{ flex: 1 }}>Nova Venda</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Iniciar Venda</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* Left: Product Search */}
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <button
              className="btn-primary"
              style={{ flex: 1, padding: 14, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => setShowProductModal(true)}
            >
              <span style={{ fontSize: 20 }}>&#x1F50D;</span> Buscar Produto
            </button>
            <button
              onClick={() => setBarcodeMode(true)}
              title="Buscar por código de barras"
              style={{
                padding: '8px 16px', background: 'var(--bg-card)', color: 'var(--text-secondary)',
                fontSize: 22, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center',
                border: '1px solid var(--border)'
              }}
            >
              &#x1F4E6;
            </button>
          </div>

          {/* Client selection */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Cliente: {selectedClient ? selectedClient.nome : 'Não selecionado'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedClient && (
                  <button className="btn-secondary" onClick={() => setSelectedClient(null)} style={{ padding: '4px 8px', fontSize: 12 }}>Limpar</button>
                )}
                <button className="btn-secondary" onClick={() => { setShowClientSelect(!showClientSelect); setShowNewClient(false); }} style={{ padding: '4px 8px', fontSize: 12 }}>Selecionar</button>
                <button className="btn-success" onClick={() => { setShowNewClient(!showNewClient); setShowClientSelect(false); }} style={{ padding: '4px 8px', fontSize: 12 }}>+ Novo</button>
              </div>
            </div>

            {showClientSelect && (
              <div style={{ marginTop: 12 }}>
                <input
                  placeholder="Buscar cliente por nome ou CPF..."
                  value={clienteSearch}
                  onChange={e => setClienteSearch(e.target.value)}
                  autoFocus
                  style={{ marginBottom: 8 }}
                />
                <div style={{ maxHeight: 180, overflow: 'auto' }}>
                  {clientes.filter(c =>
                    !clienteSearch || c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) || (c.cpf && c.cpf.includes(clienteSearch))
                  ).map(c => (
                    <div key={c.id} onClick={() => { setSelectedClient(c); setShowClientSelect(false); setClienteSearch(''); }}
                      style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      {c.nome} {c.cpf && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>- {c.cpf}</span>}
                    </div>
                  ))}
                  {clientes.filter(c => !clienteSearch || c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) || (c.cpf && c.cpf.includes(clienteSearch))).length === 0 && (
                    <p style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum cliente encontrado</p>
                  )}
                </div>
              </div>
            )}

            {showNewClient && (
              <form onSubmit={handleCreateClient} style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>Nome *</label>
                  <input value={newClientForm.nome} onChange={e => setNewClientForm({...newClientForm, nome: e.target.value})} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>CPF</label>
                    <input value={newClientForm.cpf} onChange={e => setNewClientForm({...newClientForm, cpf: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Telefone</label>
                    <input value={newClientForm.telefone} onChange={e => setNewClientForm({...newClientForm, telefone: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={newClientForm.email} onChange={e => setNewClientForm({...newClientForm, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Endereço</label>
                    <input value={newClientForm.endereco} onChange={e => setNewClientForm({...newClientForm, endereco: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowNewClient(false)}>Cancelar</button>
                  <button type="submit" className="btn-success">Salvar e Selecionar</button>
                </div>
              </form>
            )}
          </div>

          {/* Seller selection */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Vendedor: {selectedVendedor ? selectedVendedor.nome : 'Não selecionado'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedVendedor && (
                  <button className="btn-secondary" onClick={() => setSelectedVendedor(null)} style={{ padding: '4px 8px', fontSize: 12 }}>Limpar</button>
                )}
                <button className="btn-secondary" onClick={() => setShowVendedorSelect(!showVendedorSelect)} style={{ padding: '4px 8px', fontSize: 12 }}>Selecionar</button>
              </div>
            </div>

            {showVendedorSelect && (
              <div style={{ marginTop: 12 }}>
                {vendedores.length === 0 ? (
                  <p style={{ padding: '12px', color: 'var(--warning)', fontSize: 13 }}>Nenhum vendedor cadastrado. Cadastre em Usuários.</p>
                ) : (
                  <>
                    <input
                      placeholder="Buscar vendedor..."
                      value={vendedorSearch}
                      onChange={e => setVendedorSearch(e.target.value)}
                      autoFocus
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ maxHeight: 180, overflow: 'auto' }}>
                      {vendedores.filter(v => !vendedorSearch || v.nome.toLowerCase().includes(vendedorSearch.toLowerCase())).map(v => (
                        <div key={v.id} onClick={() => { setSelectedVendedor(v); setShowVendedorSelect(false); setVendedorSearch(''); }}
                          style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                          {v.nome} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>- {v.login}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Carrinho ({cart.length} itens)</h3>
          {cart.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Carrinho vazio</p>
          ) : (
            <>
              <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 12 }}>
                {cart.map(item => (
                  <div key={item.estoque_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{item.produto_nome}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.tamanho} / {item.cor}</div>
                        {item.promo_aplicada && (
                          <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>
                            Promo: {item.promo_aplicada}
                            {item.preco_original && item.preco_original !== item.preco_unitario && (
                              <span style={{ marginLeft: 4, textDecoration: 'line-through', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                {formatCurrency(item.preco_original)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button className="btn-danger" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => removeFromCart(item.estoque_id)}>×</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateCartQty(item.estoque_id, item.quantidade - 1)}>-</button>
                      <span style={{ minWidth: 30, textAlign: 'center', fontSize: 14 }}>{item.quantidade}</span>
                      <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateCartQty(item.estoque_id, item.quantidade + 1)}>+</button>
                      <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 14 }}>
                        {formatCurrency(item.preco_unitario * item.quantidade)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {descontoPromocao > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--success)' }}>
                    <span>Promoção:</span>
                    <span>-{formatCurrency(descontoPromocao)}</span>
                  </div>
                )}
                {/* Manual discount input */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Desconto:</span>
                  <select value={descontoGlobalTipo} onChange={e => {
                    const newTipo = e.target.value;
                    setDescontoGlobalTipo(newTipo);
                    if (descontoGlobal) {
                      const v = Number(descontoGlobal);
                      if (newTipo === 'percentual' && v > 100) setDescontoGlobal('100');
                      else if (newTipo === 'fixo' && v > subtotal) setDescontoGlobal(String(subtotal));
                    }
                  }} style={{ fontSize: 12, padding: '2px 4px', minWidth: 40 }}>
                    <option value="percentual">%</option>
                    <option value="fixo">R$</option>
                  </select>
                  <input type="number" step="0.01" min="0" value={descontoGlobal}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '' || Number(v) < 0) { setDescontoGlobal(''); return; }
                      if (descontoGlobalTipo === 'percentual' && Number(v) > 100) { setDescontoGlobal('100'); return; }
                      if (descontoGlobalTipo === 'fixo' && Number(v) > subtotal) { setDescontoGlobal(String(subtotal)); return; }
                      setDescontoGlobal(v);
                    }}
                    placeholder="0" style={{ fontSize: 13, padding: '4px 6px', width: 80 }} />
                </div>
                {descontos > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--success)' }}>
                    <span>Total Descontos:</span>
                    <span>-{formatCurrency(descontos)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                  <span>TOTAL:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn-success"
              style={{ padding: 14, fontSize: 16 }}
              disabled={cart.length === 0}
              onClick={() => {
                if (!selectedClient || !selectedVendedor) {
                  alert('Selecione o cliente e o vendedor antes de finalizar');
                  return;
                }
                setShowCheckout(true);
              }}
            >
              Finalizar Venda (F2)
            </button>
            {cart.length > 0 && (
              <button className="btn-danger" onClick={() => { if (confirm('Cancelar venda? Todos os itens serão removidos do carrinho.')) setCart([]); }}>Cancelar (F4)</button>
            )}
          </div>
        </div>
      </div>

      {/* Product Search Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Buscar Produto</h3>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setShowProductModal(false)}>Fechar</button>
            </div>

            <input
              ref={productModalInputRef}
              placeholder="Nome ou código de barras..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={{ fontSize: 16, padding: 12, marginBottom: 10 }}
            />

            {categoriasFiltro.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <button type="button" onClick={() => { setCategoryFilter(null); setManualSearch(true); }}
                  style={{ padding: '4px 12px', fontSize: 12, borderRadius: 14, cursor: 'pointer', background: !categoryFilter ? 'var(--accent)' : 'var(--bg-card)', color: 'white', border: '1px solid var(--border)' }}>
                  Todos
                </button>
                {categoriasFiltro.map(c => (
                  <button key={c.id} type="button" onClick={() => { setCategoryFilter(c.id === categoryFilter ? null : c.id); setManualSearch(true); }}
                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 14, cursor: 'pointer', background: categoryFilter === c.id ? 'var(--accent)' : 'var(--bg-card)', color: 'white', border: '1px solid var(--border)' }}>
                    {c.nome}
                  </button>
                ))}
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1, borderRadius: 6, border: '1px solid var(--border)' }}>
              {(searchTerm ? searchResults : (categoryFilter ? produtos.filter(p => p.categoria_id === categoryFilter) : produtos)).map(p => {
                const estoqueItens = estoque.filter(e => e.produto_id === p.id && e.quantidade > 0);
                const hasStock = estoqueItens.length > 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!hasStock) return;
                      addToCart(p);
                      setShowProductModal(false);
                    }}
                    style={{
                      padding: '12px 14px', cursor: hasStock ? 'pointer' : 'not-allowed',
                      opacity: hasStock ? 1 : 0.45, borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'transparent', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { if (hasStock) e.currentTarget.style.background = 'var(--accent)22'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div>
                      <strong style={{ fontSize: 14 }}>{p.nome}</strong>
                      {p.categoria_nome && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{p.categoria_nome}</span>}
                      {hasStock && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {estoqueItens.map(e => `${e.tamanho}/${e.cor} (${e.quantidade})`).join(' · ')}
                      </div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{formatCurrency(p.preco_venda)}</div>
                      <div style={{ fontSize: 11, color: hasStock ? 'var(--success)' : 'var(--danger)' }}>
                        {hasStock ? 'Em estoque' : 'Sem estoque'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(searchTerm ? searchResults : produtos).length === 0 && (
                <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>Nenhum produto encontrado</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {barcodeMode && (
        <div className="modal-overlay" onClick={() => { setBarcodeMode(false); setBarcodeInput(''); setBarcodeError(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>&#x1F4E6;</div>
            <h2 style={{ marginBottom: 8 }}>Aguardando Leitura</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Aproxime o leitor de código de barras do produto
            </p>
            <form onSubmit={handleBarcodeSubmit}>
              <input
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={e => { setBarcodeInput(e.target.value); setBarcodeError(''); }}
                placeholder="Código de barras..."
                autoComplete="off"
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 3, marginBottom: 8 }}
              />
              {barcodeError && (
                <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{barcodeError}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }}
                  onClick={() => { setBarcodeMode(false); setBarcodeInput(''); setBarcodeError(''); }}>
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

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>Finalizar Venda</h2>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total a pagar</span>
              <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(total)}</p>
            </div>

            <div className="form-group">
              <label>Forma de Pagamento</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {formasPagamento.map(pm => {
                  const isDinheiro = pm.nome.toLowerCase().includes('dinheiro');
                  const emojis = { 'Dinheiro': '💵', 'Cartão Débito': '💳', 'Cartão Crédito': '💳', 'PIX': '📱' };
                  const labels = { 'Dinheiro': 'Dinheiro', 'Cartão Débito': 'Débito', 'Cartão Crédito': 'Crédito', 'PIX': 'PIX' };
                  const emoji = Object.keys(emojis).find(k => pm.nome.includes(k)) ? emojis[Object.keys(emojis).find(k => pm.nome.includes(k))] : '💰';
                  const isSelected = paymentMethod === pm.nome;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPaymentMethod(pm.nome);
                        if (isDinheiro) {
                          setCashFieldVisible(true);
                        } else {
                          setCashFieldVisible(false);
                        }
                      }}
                      style={{
                        flex: '1 1 auto',
                        minWidth: 100,
                        padding: 12,
                        background: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                        color: 'white',
                        fontSize: 13,
                        border: isSelected ? '2px solid var(--accent-hover)' : '2px solid transparent',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                    >
                      {emoji} {labels[Object.keys(labels).find(k => pm.nome.includes(k))] || pm.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod.toLowerCase().includes('crédito') && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Número de Parcelas</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {[1,2,3,4,5,6,8,10,12].map(n => (
                    <button key={n} type="button"
                      onClick={() => setParcelas(n)}
                      style={{
                        padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                        background: parcelas === n ? 'var(--accent)' : 'var(--bg-card)',
                        color: 'white', border: parcelas === n ? '2px solid var(--accent-hover)' : '2px solid transparent'
                      }}>
                      {n}x {n > 1 ? `= ${(total/n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group" style={{ display: cashFieldVisible ? 'block' : 'none' }}>
              <label>Valor Recebido</label>
              <input
                ref={cashInputRef}
                type="text"
                autoComplete="off"
                value={cashGiven}
                onChange={e => setCashGiven(e.target.value)}
                placeholder="0.00"
                style={{ fontSize: 20, padding: 12 }}
              />
              {cashFieldVisible && cashGiven && Number(cashGiven) >= total && (
                <p style={{ marginTop: 8, fontSize: 18, color: 'var(--success)' }}>
                  Troco: {formatCurrency(troco)}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1, padding: 12 }} onClick={() => setShowCheckout(false)}>
                Voltar
              </button>
              <button className="btn-success" style={{ flex: 2, padding: 12, fontSize: 18 }} onClick={finalizeSale}>
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
