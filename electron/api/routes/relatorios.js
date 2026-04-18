const express = require('express');

function isToday(iso) {
  return iso && iso.startsWith(new Date().toISOString().split('T')[0]);
}

function isThisWeek(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  return d >= weekAgo;
}

function isThisMonth(iso) {
  if (!iso) return false;
  const now = new Date();
  return iso.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
}

function dateBetween(iso, inicio, fim) {
  if (!iso) return false;
  return iso >= inicio && iso <= fim + 'T23:59:59';
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/relatorios/dashboard', (req, res) => {
    // Ignore cancelled/returned sales from dashboard figures — they aren't revenue.
    const vendasAll = db.select('vendas').filter(v => v && v.data && v.status !== 'cancelada' && v.status !== 'devolvida');
    const produtos = db.select('produtos');
    const estoque = db.select('estoque');
    const vendas = vendasAll;

    // Vendas do dia
    const vendasHoje = vendas.filter(v => isToday(v.data));
    const vendasSemana = vendas.filter(v => isThisWeek(v.data));
    const vendasMes = vendas.filter(v => isThisMonth(v.data));

    // Por forma de pagamento (hoje)
    const porPag = {};
    vendasHoje.forEach(v => {
      if (!porPag[v.forma_pagamento]) porPag[v.forma_pagamento] = { forma_pagamento: v.forma_pagamento, qtd: 0, valor: 0 };
      porPag[v.forma_pagamento].qtd++;
      porPag[v.forma_pagamento].valor += v.total;
    });

    // Top produtos (7 dias)
    const topProdMap = {};
    const vendaItens = db.select('venda_itens');
    const vendasSemanaIds = new Set(vendasSemana.map(v => v.id));
    vendaItens.forEach(vi => {
      if (!vendasSemanaIds.has(vi.venda_id)) return;
      if (!topProdMap[vi.produto_id]) topProdMap[vi.produto_id] = { nome: '', qtd_vendida: 0, total: 0 };
      topProdMap[vi.produto_id].qtd_vendida += vi.quantidade;
      topProdMap[vi.produto_id].total += vi.quantidade * vi.preco_unitario;
    });
    const categorias = db.select('categorias');
    // Fix names
    vendaItens.forEach(vi => {
      const p = produtos.find(pr => pr.id === vi.produto_id);
      if (topProdMap[vi.produto_id]) topProdMap[vi.produto_id].nome = p ? p.nome : '';
    });
    const topProdFinal = Object.values(topProdMap).sort((a, b) => b.qtd_vendida - a.qtd_vendida).slice(0, 10);

    // Estoque baixo
    const estoqueBaixo = estoque
      .filter(e => e.quantidade <= e.minimo)
      .map(e => {
        const p = produtos.find(pr => pr.id === e.produto_id);
        return { ...e, produto_nome: p ? p.nome : '' };
      })
      .sort((a, b) => a.quantidade - b.quantidade)
      .slice(0, 10);

    // Ticket médio
    const ticketMedio = vendasMes.length > 0 ? vendasMes.reduce((s, v) => s + v.total, 0) / vendasMes.length : 0;

    // Vendas por dia (últimos 7 dias)
    const grafico7dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const diaStr = d.toISOString().split('T')[0];
      const diaVendasCorretas = vendas.filter(v => v.data && v.data.startsWith(diaStr));
      grafico7dias.push({
        dia: diaStr,
        label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        qtd: diaVendasCorretas.length,
        valor: diaVendasCorretas.reduce((s, v) => s + v.total, 0)
      });
    }

    const taxasHoje = vendasHoje.reduce((s, v) => s + Number(v.valor_taxa_cartao || 0), 0);
    const taxasSemana = vendasSemana.reduce((s, v) => s + Number(v.valor_taxa_cartao || 0), 0);
    const taxasMes = vendasMes.reduce((s, v) => s + Number(v.valor_taxa_cartao || 0), 0);

    res.json({
      vendas_hoje: { qtd: vendasHoje.length, valor: vendasHoje.reduce((s, v) => s + v.total, 0), taxas: taxasHoje },
      vendas_semana: { qtd: vendasSemana.length, valor: vendasSemana.reduce((s, v) => s + v.total, 0), taxas: taxasSemana },
      vendas_mes: { qtd: vendasMes.length, valor: vendasMes.reduce((s, v) => s + v.total, 0), taxas: taxasMes },
      por_pagamento: Object.values(porPag),
      top_produtos: topProdFinal,
      estoque_baixo: estoqueBaixo,
      ticket_medio: ticketMedio,
      grafico_7dias: grafico7dias
    });
  });

  router.get('/relatorios/vendas', (req, res) => {
    const { inicio, fim, forma_pagamento } = req.query;
    let vendas = db.select('vendas');
    const clientes = db.select('clientes');
    const usuarios = db.select('usuarios');

    if (inicio) vendas = vendas.filter(v => v.data >= inicio);
    if (fim) vendas = vendas.filter(v => dateBetween(v.data, inicio || v.data, fim));
    if (forma_pagamento) vendas = vendas.filter(v => v.forma_pagamento === forma_pagamento);

    vendas.sort((a, b) => new Date(b.data) - new Date(a.data));

    const result = vendas.map(v => ({
      ...v,
      cliente_nome: (clientes.find(c => c.id === v.cliente_id) || {}).nome || null,
      usuario_nome: (usuarios.find(u => u.id === v.usuario_id) || {}).nome || ''
    }));

    const totalGeral = result.reduce((s, v) => s + v.total, 0);
    res.json({ vendas: result, resumo: { total_geral: totalGeral, qtd: result.length } });
  });

  router.get('/relatorios/produtos', (req, res) => {
    const { tipo, inicio, fim } = req.query;
    const produtos = db.select('produtos');
    const categorias = db.select('categorias');
    const vendaItens = db.select('venda_itens');
    const vendas = db.select('vendas');

    if (tipo === 'mais-vendidos') {
      const filteredVendas = (inicio && fim) ? vendas.filter(v => dateBetween(v.data, inicio, fim)) : vendas;
      const vendaIds = new Set(filteredVendas.map(v => v.id));
      const prodMap = {};
      vendaItens.forEach(vi => {
        if (!vendaIds.has(vi.venda_id)) return;
        if (!prodMap[vi.produto_id]) prodMap[vi.produto_id] = { qtd_vendida: 0, total: 0 };
        prodMap[vi.produto_id].qtd_vendida += vi.quantidade;
        prodMap[vi.produto_id].total += vi.quantidade * vi.preco_unitario;
      });
      const result = Object.entries(prodMap).map(([id, data]) => {
        const p = produtos.find(pr => pr.id === Number(id));
        const c = p ? categorias.find(cat => cat.id === p.categoria_id) : null;
        return { nome: p ? p.nome : '', categoria: c ? c.nome : '', ...data };
      }).sort((a, b) => b.qtd_vendida - a.qtd_vendida).slice(0, 20);
      res.json(result);
    } else if (tipo === 'estoque-valor') {
      const estoque = db.select('estoque');
      const result = {};
      estoque.forEach(e => {
        if (!result[e.produto_id]) result[e.produto_id] = { qtd_total: 0 };
        result[e.produto_id].qtd_total += e.quantidade;
      });
      const final = Object.entries(result).map(([id, data]) => {
        const p = produtos.find(pr => pr.id === Number(id));
        const c = p ? categorias.find(cat => cat.id === p.categoria_id) : null;
        return {
          nome: p ? p.nome : '',
          categoria: c ? c.nome : '',
          qtd_total: data.qtd_total,
          valor_venda: data.qtd_total * (p ? p.preco_venda : 0),
          valor_custo: data.qtd_total * (p ? p.preco_custo : 0)
        };
      }).sort((a, b) => b.valor_venda - a.valor_venda);
      res.json(final);
    } else if (tipo === 'por-vendedor') {
      const usuarios = db.select('usuarios');
      const filteredVendas = (inicio && fim) ? vendas.filter(v => dateBetween(v.data, inicio, fim)) : vendas;
      const vendedorMap = {};
      filteredVendas.forEach(v => {
        const uid = v.usuario_id || 'sem-vendedor';
        if (!vendedorMap[uid]) vendedorMap[uid] = { usuario_id: uid, nome: '', qtd_vendas: 0, total: 0 };
        vendedorMap[uid].qtd_vendas++;
        vendedorMap[uid].total += v.total;
      });
      const result = Object.values(vendedorMap).map(v => {
        const u = usuarios.find(usr => usr.id === v.usuario_id);
        v.nome = u ? u.nome : 'Sem vendedor';
        return v;
      }).sort((a, b) => b.total - a.total);
      res.json(result);
    } else {
      res.json([]);
    }
  });

  // Fechamento de Caixa
  router.get('/relatorios/fechamento', (req, res) => {
    const { data, data_inicio, data_fim } = req.query;

    let inicio, fim;
    if (data_inicio && data_fim) {
      inicio = data_inicio;
      fim = data_fim;
    } else {
      const d = data || new Date().toISOString().split('T')[0];
      inicio = d;
      fim = d;
    }

    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.split('T')[0];
      return d >= inicio && d <= fim;
    };

    const vendas = db.select('vendas').filter(v =>
      inRange(v.data) && v.status !== 'cancelada' && v.status !== 'devolvida'
    );
    const despesas = db.select('despesas').filter(d => inRange(d.data));

    const devolucoesPeriodo = db.select('trocas').filter(t =>
      t.tipo === 'devolucao' && t.status === 'concluida' && inRange(t.concluida_em)
    );
    const totalDevolucoes = devolucoesPeriodo.reduce((s, t) => s + (t.valor_devolvido || 0), 0);
    const usuarios = db.select('usuarios');
    const formasPagamento = db.select('formas_pagamento');

    const porPagamento = formasPagamento.map(fp => {
      const vendasFp = vendas.filter(v => v.forma_pagamento === fp.nome);
      return {
        nome: fp.nome,
        qtd: vendasFp.length,
        total: vendasFp.reduce((s, v) => s + Number(v.total), 0)
      };
    });

    const totalVendas = vendas.reduce((s, v) => s + Number(v.total), 0);
    const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
    const totalTaxasCartao = vendas.reduce((s, v) => s + Number(v.valor_taxa_cartao || 0), 0);
    const dinheiroEmCaixa = (porPagamento.find(p => p.nome.toLowerCase().includes('dinheiro')) || {}).total || 0;
    const ticketMedio = vendas.length > 0 ? totalVendas / vendas.length : 0;
    const liquidoFinal = totalVendas - totalDespesas - totalDevolucoes - totalTaxasCartao;

    const porUsuario = {};
    vendas.forEach(v => {
      const uid = v.usuario_id || 'sem';
      if (!porUsuario[uid]) {
        const u = uid !== 'sem' ? usuarios.find(u => u.id === Number(uid)) : null;
        porUsuario[uid] = { usuario_id: uid, nome: u ? u.nome : 'Desconhecido', qtd: 0, total: 0 };
      }
      porUsuario[uid].qtd++;
      porUsuario[uid].total += Number(v.total);
    });

    res.json({
      data: inicio === fim ? inicio : `${inicio} a ${fim}`,
      data_inicio: inicio,
      data_fim: fim,
      vendas: vendas.length,
      total_vendas: totalVendas,
      total_despesas: totalDespesas,
      total_devolucoes: totalDevolucoes,
      total_taxas_cartao: totalTaxasCartao,
      devolucoes_qtd: devolucoesPeriodo.length,
      liquido: liquidoFinal,
      dinheiro_em_caixa: dinheiroEmCaixa,
      ticket_medio: ticketMedio,
      por_pagamento: porPagamento,
      por_usuario: Object.values(porUsuario).sort((a, b) => b.total - a.total),
      vendas_detalhes: vendas.map(v => ({
        id: v.id,
        data: v.data,
        cliente: v.cliente_id || null,
        usuario_nome: (usuarios.find(u => u.id === v.usuario_id) || {}).nome || '',
        forma_pagamento: v.forma_pagamento,
        total: v.total
      }))
    });
  });

  // Relatório de comissões por vendedor
  router.get('/relatorios/comissoes', (req, res) => {
    const { data_inicio, data_fim } = req.query;
    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.split('T')[0];
      return (!data_inicio || d >= data_inicio) && (!data_fim || d <= data_fim);
    };

    const usuarios = db.select('usuarios');
    const vendas = db.select('vendas').filter(v => v.status !== 'cancelada' && inRange(v.data));

    const resultado = usuarios
      .filter(u => u.ativo && u.comissao > 0)
      .map(u => {
        const vendasVendedor = vendas.filter(v => {
          if (v.vendedor_id != null && v.vendedor_id !== '') return Number(v.vendedor_id) === u.id;
          return v.usuario_id === u.id;
        });
        const totalVendas = vendasVendedor.reduce((s, v) => s + Number(v.total), 0);
        const comissaoValor = totalVendas * (Number(u.comissao) / 100);
        return {
          usuario_id: u.id,
          nome: u.nome,
          cargo: u.cargo,
          comissao_pct: u.comissao,
          qtd_vendas: vendasVendedor.length,
          total_vendas: totalVendas,
          comissao_valor: comissaoValor
        };
      })
      .filter(r => r.qtd_vendas > 0)
      .sort((a, b) => b.comissao_valor - a.comissao_valor);

    res.json(resultado);
  });

  // Margem de lucro por produto (período)
  router.get('/relatorios/margem-lucro', (req, res) => {
    const { data_inicio, data_fim } = req.query;
    const inRange = (iso) => {
      if (!iso) return false;
      const d = iso.split('T')[0];
      return (!data_inicio || d >= data_inicio) && (!data_fim || d <= data_fim);
    };
    const produtos = db.select('produtos');
    const vendas = db.select('vendas').filter(v => v.status !== 'cancelada' && inRange(v.data));
    const vendaIds = new Set(vendas.map(v => v.id));
    const itens = db.select('venda_itens').filter(i => vendaIds.has(i.venda_id));

    const porProduto = {};
    itens.forEach(i => {
      const p = produtos.find(p => p.id === i.produto_id);
      if (!p) return;
      if (!porProduto[i.produto_id]) {
        porProduto[i.produto_id] = {
          produto_id: i.produto_id,
          nome: p.nome,
          qtd: 0, receita: 0, custo: 0
        };
      }
      const row = porProduto[i.produto_id];
      row.qtd += Number(i.quantidade) || 0;
      row.receita += (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 0);
      row.custo += (Number(p.preco_custo) || 0) * (Number(i.quantidade) || 0);
    });
    const result = Object.values(porProduto).map(r => {
      const lucro = r.receita - r.custo;
      const margem_pct = r.receita > 0 ? (lucro / r.receita) * 100 : 0;
      return { ...r, lucro, margem_pct };
    }).sort((a, b) => b.lucro - a.lucro);
    res.json(result);
  });

  // Ranking de clientes por valor comprado
  router.get('/relatorios/ranking-clientes', (req, res) => {
    const { data_inicio, data_fim } = req.query;
    const inRange = (iso) => {
      if (!iso) return false;
      const d = iso.split('T')[0];
      return (!data_inicio || d >= data_inicio) && (!data_fim || d <= data_fim);
    };
    const clientes = db.select('clientes');
    const vendas = db.select('vendas').filter(v => v.status !== 'cancelada' && v.cliente_id && inRange(v.data));

    const porCliente = {};
    vendas.forEach(v => {
      if (!porCliente[v.cliente_id]) {
        const c = clientes.find(cl => cl.id === v.cliente_id);
        porCliente[v.cliente_id] = {
          cliente_id: v.cliente_id,
          nome: c ? c.nome : 'Cliente removido',
          telefone: c ? c.telefone : '',
          qtd_compras: 0,
          total_gasto: 0,
          ultima_compra: null
        };
      }
      const row = porCliente[v.cliente_id];
      row.qtd_compras++;
      row.total_gasto += Number(v.total) || 0;
      if (!row.ultima_compra || v.data > row.ultima_compra) row.ultima_compra = v.data;
    });
    const result = Object.values(porCliente)
      .map(r => ({ ...r, ticket_medio: r.qtd_compras > 0 ? r.total_gasto / r.qtd_compras : 0 }))
      .sort((a, b) => b.total_gasto - a.total_gasto);
    res.json(result);
  });

  // Giro de estoque (vendas vs estoque atual)
  router.get('/relatorios/giro-estoque', (req, res) => {
    const dias = Math.max(1, Number(req.query.dias) || 30);
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const produtos = db.select('produtos').filter(p => p.ativo);
    const estoque = db.select('estoque');
    const vendas = db.select('vendas').filter(v => v.status !== 'cancelada' && v.data && v.data >= limite);
    const vendaIds = new Set(vendas.map(v => v.id));
    const itens = db.select('venda_itens').filter(i => vendaIds.has(i.venda_id));

    const vendidoPorProduto = {};
    itens.forEach(i => {
      vendidoPorProduto[i.produto_id] = (vendidoPorProduto[i.produto_id] || 0) + (Number(i.quantidade) || 0);
    });

    const result = produtos.map(p => {
      const estAtual = estoque.filter(e => e.produto_id === p.id).reduce((s, e) => s + (Number(e.quantidade) || 0), 0);
      const vendido = vendidoPorProduto[p.id] || 0;
      const media_diaria = vendido / dias;
      const dias_restantes = media_diaria > 0 ? estAtual / media_diaria : null;
      return {
        produto_id: p.id,
        nome: p.nome,
        estoque_atual: estAtual,
        vendido_periodo: vendido,
        media_diaria: Number(media_diaria.toFixed(2)),
        dias_restantes: dias_restantes === null ? null : Math.round(dias_restantes)
      };
    }).filter(r => r.vendido_periodo > 0 || r.estoque_atual > 0)
      .sort((a, b) => b.vendido_periodo - a.vendido_periodo);
    res.json({ dias, produtos: result });
  });

  // Comparativo mês atual vs mês anterior
  router.get('/relatorios/comparativo-mensal', (req, res) => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesAnt = new Date(anoAtual, mesAtual - 1, 1);
    const prefAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
    const prefAnt = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth() + 1).padStart(2, '0')}`;

    const vendas = db.select('vendas').filter(v => v.status !== 'cancelada' && v.data);
    const agrega = (pref) => {
      const v = vendas.filter(x => x.data.startsWith(pref));
      const total = v.reduce((s, x) => s + (Number(x.total) || 0), 0);
      return { qtd: v.length, total, ticket_medio: v.length ? total / v.length : 0 };
    };
    const atual = agrega(prefAtual);
    const anterior = agrega(prefAnt);
    const variacao_pct = anterior.total > 0 ? ((atual.total - anterior.total) / anterior.total) * 100 : null;
    res.json({ mes_atual: prefAtual, mes_anterior: prefAnt, atual, anterior, variacao_pct });
  });

  // Alertas de estoque mínimo
  router.get('/relatorios/estoque-minimo', (req, res) => {
    const estoque = db.select('estoque').filter(e => e.quantidade <= e.minimo);
    const produtos = db.select('produtos');
    const result = estoque.map(e => {
      const p = produtos.find(p => p.id === e.produto_id) || {};
      return {
        estoque_id: e.id,
        produto_id: e.produto_id,
        nome: p.nome || 'Produto removido',
        tamanho: e.tamanho,
        cor: e.cor,
        quantidade: e.quantidade,
        minimo: e.minimo
      };
    }).filter(e => e.nome !== 'Produto removido');
    res.json(result);
  });

  return router;
};
