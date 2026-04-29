const express = require('express');
const { validate, ProdutoCreateSchema, ProdutoUpdateSchema } = require('../validation');

// Campos fiscais propagados em POST/PUT — Fase 1 NFC-e. Lista canônica para
// evitar dispersão entre rotas conforme a feature evolui.
const PRODUTO_FISCAL_KEYS = [
  'ncm', 'cest', 'cfop', 'origem_mercadoria',
  'csosn', 'unidade_comercial', 'pis_cst', 'cofins_cst'
];

// Empty-string → null para colunas fiscais que vêm vazias do form quando
// o usuário não preencheu. Mantém defaults do schema para campos ausentes.
function pickFiscal(body) {
  const out = {};
  for (const key of PRODUTO_FISCAL_KEYS) {
    if (body[key] === undefined) continue;
    const v = body[key];
    out[key] = (v === '' ? null : v);
  }
  return out;
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/produtos', (req, res) => {
    const produtos = db.select('produtos', { ativo: 1 });
    const categorias = db.select('categorias');
    const result = produtos.map(p => {
      const pCatId = typeof p.categoria_id === 'string' ? Number(p.categoria_id) : p.categoria_id;
      return {
        ...p,
        categoria_nome: (categorias.find(c => c.id === pCatId) || {}).nome || null
      };
    });
    res.json(result.sort((a, b) => a.nome.localeCompare(b.nome)));
  });

  router.get('/produtos/buscar', (req, res) => {
    const { q } = req.query;
    const produtos = db.select('produtos', { ativo: 1 }).filter(p => {
      const extras = Array.isArray(p.codigos_barras_extras) ? p.codigos_barras_extras : [];
      return p.nome.toLowerCase().includes((q || '').toLowerCase()) ||
        (p.codigo_barras && p.codigo_barras.includes(q)) ||
        extras.some(bc => bc && bc.includes(q));
    });
    const categorias = db.select('categorias');
    const result = produtos.map(p => {
      const pCatId = typeof p.categoria_id === 'string' ? Number(p.categoria_id) : p.categoria_id;
      return { ...p, categoria_nome: (categorias.find(c => c.id === pCatId) || {}).nome || null };
    });
    res.json(result);
  });

  router.get('/produtos/:id', (req, res) => {
    const produto = db.findOne('produtos', { id: Number(req.params.id) });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    const pCatId = typeof produto.categoria_id === 'string' ? Number(produto.categoria_id) : produto.categoria_id;
    const cat = db.select('categorias').find(c => c.id === pCatId);
    res.json({ ...produto, categoria_nome: cat ? cat.nome : null });
  });

  // Helper: checks if a barcode is already used by another product
  const barcodeConflict = (barcode, excludeId = null) => {
    if (!barcode) return null;
    return db.select('produtos', { ativo: 1 }).find(p => {
      if (excludeId !== null && p.id === excludeId) return false;
      return p.codigo_barras === barcode;
    }) || null;
  };

  const genBarcode = () => `789${(Date.now() + Math.floor(Math.random() * 99999)).toString().slice(-10)}`;

  const genUniqueBarcode = (usados) => {
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const bc = genBarcode();
      if (!usados.has(bc) && !barcodeConflict(bc)) {
        usados.add(bc);
        return bc;
      }
    }
    return `789${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(0, 16);
  };

  router.post('/produtos', validate(ProdutoCreateSchema), (req, res) => {
    const { nome, descricao, preco_custo, preco_venda, codigo_barras, num_variacoes, categoria_id, usuario_id: uid } = req.body;
    const qtd = num_variacoes;
    const now = new Date().toISOString();
    const fiscal = pickFiscal(req.body);

    // Generate and validate all barcodes up-front so we can fail fast before
    // opening a transaction (barcode conflict → 400, no partial writes).
    const usados = new Set();
    const barcodes = [];
    for (let i = 0; i < qtd; i++) {
      const bc = (i === 0 && codigo_barras) ? codigo_barras : genUniqueBarcode(usados);
      if (bc) {
        const dup = barcodeConflict(bc);
        if (dup) return res.status(400).json({ error: `Código de barras "${bc}" já cadastrado no produto "${dup.nome}"` });
        usados.add(bc);
      }
      barcodes.push(bc);
    }

    // All inserts in one transaction: if any fails the whole batch rolls back.
    const commitBatch = db.transaction(() => {
      const ids = [];
      for (const bc of barcodes) {
        const result = db.insert('produtos', {
          nome, descricao: descricao || '',
          preco_custo: preco_custo || 0, preco_venda: preco_venda || 0,
          codigo_barras: bc, categoria_id: categoria_id || null,
          ativo: 1, criado_em: now,
          ...fiscal
        });
        const produtoId = result.lastInsertRowid;
        db.insert('estoque', {
          produto_id: produtoId, tamanho: '', cor: '',
          quantidade: 0, minimo: 5, codigo_barras: bc
        });
        ids.push(produtoId);
      }
      if (uid) {
        db.insert('log_acoes', {
          usuario_id: uid,
          usuario_nome: (db.findOne('usuarios', { id: uid }) || {}).nome || '',
          acao: 'Produto Cadastrado',
          detalhes: `${nome} | R$ ${preco_venda} | ${qtd} unidade(s)`,
          criado_em: now
        });
      }
      return ids;
    });

    const created = commitBatch();
    res.json({ ids: created, count: qtd, nome });
  });

  router.put('/produtos/:id', validate(ProdutoUpdateSchema), (req, res) => {
    const { nome, descricao, preco_custo, preco_venda, codigo_barras, categoria_id, ativo, usuario_id } = req.body;
    if (codigo_barras) {
      const dup = barcodeConflict(codigo_barras, Number(req.params.id));
      if (dup) return res.status(400).json({ error: `Código de barras já cadastrado no produto "${dup.nome}"` });
    }
    const atual = db.findOne('produtos', { id: Number(req.params.id) });
    if (!atual) return res.status(404).json({ error: 'Produto não encontrado' });

    const novoPrecoCusto = preco_custo !== undefined ? preco_custo : atual.preco_custo;
    const novoPrecoVenda = preco_venda !== undefined ? preco_venda : atual.preco_venda;
    if (Number(novoPrecoCusto) !== Number(atual.preco_custo) || Number(novoPrecoVenda) !== Number(atual.preco_venda)) {
      db.insert('historico_precos', {
        produto_id: Number(req.params.id),
        produto_nome: atual.nome,
        preco_custo_anterior: atual.preco_custo,
        preco_venda_anterior: atual.preco_venda,
        preco_custo_novo: novoPrecoCusto,
        preco_venda_novo: novoPrecoVenda,
        usuario_id: usuario_id || null,
        criado_em: new Date().toISOString()
      });
      if (usuario_id) {
        db.insert('log_acoes', {
          usuario_id,
          usuario_nome: (db.findOne('usuarios', { id: usuario_id }) || {}).nome || '',
          acao: 'Alteração de Preço',
          detalhes: `${atual.nome}: R$ ${atual.preco_venda} → R$ ${novoPrecoVenda}`,
          criado_em: new Date().toISOString()
        });
      }
    }
    const updateData = {};
    for (const key of ['nome', 'descricao', 'preco_custo', 'preco_venda', 'codigo_barras', 'categoria_id']) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (ativo !== undefined) updateData.ativo = typeof ativo === 'boolean' ? (ativo ? 1 : 0) : ativo;
    Object.assign(updateData, pickFiscal(req.body));
    db.update('produtos', req.params.id, updateData);
    res.json(db.findOne('produtos', { id: Number(req.params.id) }));
  });

  router.delete('/produtos/:id', (req, res) => {
    const p = db.findOne('produtos', { id: Number(req.params.id) });
    db.update('produtos', req.params.id, { ativo: 0 });
    const uid = req.body?.usuario_id;
    if (p) {
      db.insert('log_acoes', {
        usuario_id: uid || null,
        usuario_nome: uid ? (db.findOne('usuarios', { id: uid }) || {}).nome || '' : 'Sistema',
        acao: 'Produto Desativado',
        detalhes: p.nome,
        criado_em: new Date().toISOString()
      });
    }
    res.json({ success: true });
  });

  router.get('/produtos/:id/historico-precos', (req, res) => {
    const historico = db.select('historico_precos')
      .filter(h => h.produto_id === Number(req.params.id))
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    res.json(historico);
  });

  return router;
};
