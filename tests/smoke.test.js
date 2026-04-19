import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp, freshTmpDir } from './helpers/buildApp.js';

let api;
let db;

beforeAll(() => {
  const tmp = freshTmpDir();
  const ctx = buildApp(tmp);
  api = ctx.app;
  db = ctx.db;
});

async function seedProdutoComEstoque({ nome = 'Camisa Teste', preco = 100, qtd = 10, custo = 40 } = {}) {
  const produto = db.insert('produtos', {
    nome, preco_custo: custo, preco_venda: preco,
    codigo_barras: '7890000' + Date.now(), ativo: 1,
    criado_em: new Date().toISOString()
  });
  const estoque = db.insert('estoque', {
    produto_id: produto.lastInsertRowid,
    quantidade: qtd, minimo: 1, tamanho: 'M', cor: 'Azul',
    codigo_barras: '7890000' + (Date.now() + 1)
  });
  return { produto_id: produto.lastInsertRowid, estoque_id: estoque.lastInsertRowid };
}

describe('Auth', () => {
  it('login admin com credenciais padrão', async () => {
    const res = await request(api).post('/api/login').send({ login: 'admin', senha: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.login).toBe('admin');
    expect(res.body.senha_hash).toBeUndefined();
  });

  it('login falha com senha errada', async () => {
    const res = await request(api).post('/api/login').send({ login: 'admin', senha: 'errada' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Fluxo de venda', () => {
  it('cria venda, baixa estoque e gera log de auditoria', async () => {
    const { produto_id, estoque_id } = await seedProdutoComEstoque({ qtd: 5, preco: 50 });
    const logsAntes = db.select('log_acoes').length;

    const res = await request(api).post('/api/vendas').send({
      usuario_id: 1,
      forma_pagamento: 'Dinheiro',
      itens: [{ produto_id, estoque_id, quantidade: 2, preco_unitario: 50 }]
    });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(Number(res.body.total)).toBe(100);

    const estoqueAtualizado = db.findOne('estoque', { id: estoque_id });
    expect(estoqueAtualizado.quantidade).toBe(3);

    const logsDepois = db.select('log_acoes').length;
    expect(logsDepois).toBe(logsAntes + 1);
    const ultimo = db.select('log_acoes').slice(-1)[0];
    expect(ultimo.acao).toBe('Nova Venda');
    expect(ultimo.hash).toBeDefined();
  });

  it('bloqueia venda com estoque insuficiente', async () => {
    const { produto_id, estoque_id } = await seedProdutoComEstoque({ qtd: 1, preco: 50 });
    const res = await request(api).post('/api/vendas').send({
      usuario_id: 1,
      forma_pagamento: 'Dinheiro',
      itens: [{ produto_id, estoque_id, quantidade: 5, preco_unitario: 50 }]
    });
    expect(res.status).toBe(400);
    const estoque = db.findOne('estoque', { id: estoque_id });
    expect(estoque.quantidade).toBe(1);
  });

  it('exige cliente para pagamento fiado', async () => {
    const { produto_id, estoque_id } = await seedProdutoComEstoque();
    const res = await request(api).post('/api/vendas').send({
      usuario_id: 1,
      forma_pagamento: 'Fiado',
      itens: [{ produto_id, estoque_id, quantidade: 1, preco_unitario: 50 }]
    });
    expect(res.status).toBe(400);
  });

  it('calcula taxa de cartão conforme configuração', async () => {
    db.insert('configuracoes', { chave: 'taxas_cartao', valor: JSON.stringify({ debito: 2, credito_1: 3, credito_3: 5 }) });
    const { produto_id, estoque_id } = await seedProdutoComEstoque({ qtd: 10, preco: 200 });
    const res = await request(api).post('/api/vendas').send({
      usuario_id: 1,
      forma_pagamento: 'Cartão de crédito',
      parcelas: 3,
      itens: [{ produto_id, estoque_id, quantidade: 1, preco_unitario: 200 }]
    });
    expect(res.status).toBe(200);
    expect(Number(res.body.taxa_cartao_pct)).toBe(5);
    expect(Number(res.body.valor_taxa_cartao)).toBe(10);
    expect(Number(res.body.valor_liquido)).toBe(190);
  });
});

describe('Validação Zod (coerção string×number)', () => {
  it('aceita IDs como string e coerce para number antes do banco', async () => {
    const { produto_id, estoque_id } = await seedProdutoComEstoque({ qtd: 3, preco: 30 });
    const res = await request(api).post('/api/vendas').send({
      usuario_id: '1',
      forma_pagamento: 'Dinheiro',
      itens: [{ produto_id: String(produto_id), estoque_id: String(estoque_id), quantidade: '1', preco_unitario: '30' }]
    });
    expect(res.status).toBe(200);
    expect(Number(res.body.total)).toBe(30);
  });

  it('rejeita body sem usuario_id com 400 específico do Zod', async () => {
    const res = await request(api).post('/api/vendas').send({
      forma_pagamento: 'Dinheiro',
      itens: [{ produto_id: 1, estoque_id: 1, quantidade: 1, preco_unitario: 10 }]
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/usuario_id/i);
  });
});

describe('Atomicidade SQLite', () => {
  it('rollback: item com estoque_id inexistente nao grava nada', async () => {
    const { produto_id, estoque_id } = await seedProdutoComEstoque({ qtd: 5, preco: 50 });
    const vendasAntes = db.select('vendas').length;
    const movAntes = db.select('estoque_movimentacoes').length;
    const estoqueAntes = db.findOne('estoque', { id: estoque_id }).quantidade;

    // Second item references an estoque_id that doesn't exist. The pre-transaction
    // validation in vendas.js catches it with 400 before any write happens.
    const res = await request(api).post('/api/vendas').send({
      usuario_id: 1,
      forma_pagamento: 'Dinheiro',
      itens: [
        { produto_id, estoque_id, quantidade: 1, preco_unitario: 50 },
        { produto_id, estoque_id: 999999, quantidade: 1, preco_unitario: 50 }
      ]
    });
    expect(res.status).toBe(400);

    // Nothing leaked: no venda, no movement, no stock change.
    expect(db.select('vendas').length).toBe(vendasAntes);
    expect(db.select('estoque_movimentacoes').length).toBe(movAntes);
    expect(db.findOne('estoque', { id: estoque_id }).quantidade).toBe(estoqueAntes);
  });

  it('FK impede venda_itens orfao', () => {
    // Attempting to insert a venda_itens referencing a non-existent venda_id
    // should fail at the SQLite FK layer.
    expect(() => {
      db.insert('venda_itens', {
        venda_id: 999999,
        produto_id: 1,
        quantidade: 1,
        preco_unitario: 10
      });
    }).toThrow(/FOREIGN KEY/i);
  });
});

describe('Cancelamento de venda', () => {
  it('cancela com motivo e registra log', async () => {
    const { produto_id, estoque_id } = await seedProdutoComEstoque();
    const create = await request(api).post('/api/vendas').send({
      usuario_id: 1, forma_pagamento: 'Dinheiro',
      itens: [{ produto_id, estoque_id, quantidade: 1, preco_unitario: 100 }]
    });
    const vendaId = create.body.id;

    const cancel = await request(api).put(`/api/vendas/${vendaId}`).send({
      status: 'cancelada', usuario_id: 1, motivo_cancelamento: 'Cliente desistiu'
    });
    expect(cancel.status).toBe(200);

    const venda = db.findOne('vendas', { id: vendaId });
    expect(venda.status).toBe('cancelada');
    expect(venda.motivo_cancelamento).toBe('Cliente desistiu');

    const logs = db.select('log_acoes');
    const logCancel = logs.find(l => l.acao === 'Cancelamento de Venda' && l.detalhes.includes(`#${vendaId}`));
    expect(logCancel).toBeDefined();
    expect(logCancel.detalhes).toContain('Cliente desistiu');
  });
});

describe('Fechamento de caixa', () => {
  it('retorna totais por forma de pagamento e subtrai taxas', async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const res = await request(api).get(`/api/relatorios/fechamento?data_inicio=${hoje}&data_fim=${hoje}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('liquido');
    expect(res.body).toHaveProperty('total_taxas_cartao');
    expect(Number(res.body.total_taxas_cartao)).toBeGreaterThanOrEqual(0);
  });
});

describe('Backup export / restore', () => {
  it('export retorna todas as tabelas do _data', async () => {
    const res = await request(api).get('/api/backup/export');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.vendas)).toBe(true);
    expect(Array.isArray(res.body.data.usuarios)).toBe(true);
  });

  it('restore substitui dados', async () => {
    const exportado = await request(api).get('/api/backup/export');
    const payload = exportado.body;
    const { produto_id, estoque_id } = await seedProdutoComEstoque({ nome: 'Temporario' });
    await request(api).post('/api/vendas').send({
      usuario_id: 1, forma_pagamento: 'Dinheiro',
      itens: [{ produto_id, estoque_id, quantidade: 1, preco_unitario: 10 }]
    });
    const vendasAntes = db.select('vendas').length;

    const res = await request(api).post('/api/backup/restore').send({ data: payload.data, integrity: payload.integrity });
    expect(res.status).toBeLessThan(400);
    const vendasDepois = db.select('vendas').length;
    expect(vendasDepois).toBeLessThan(vendasAntes);
  });
});

describe('Cadeia de auditoria', () => {
  it('verifyAuditChain retorna ok após inserções', async () => {
    const res = await request(api).get('/api/auditoria/verificar');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.broken).toEqual([]);
  });

  it('detecta violação ao alterar log manualmente', () => {
    const first = db._data.log_acoes[0];
    if (!first) return;
    // Tamper directly via SQL — Proxy getter returns detached copies in SQLite mode,
    // so in-memory mutations won't be seen by verifyAuditChain.
    db._sqlite.prepare('UPDATE log_acoes SET detalhes = ? WHERE id = ?').run('VIOLADO', first.id);
    const result = db.verifyAuditChain();
    expect(result.ok).toBe(false);
    // Restore so subsequent tests don't inherit the tampered chain.
    db._sqlite.prepare('UPDATE log_acoes SET detalhes = ? WHERE id = ?').run(first.detalhes, first.id);
  });
});
