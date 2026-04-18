import React, { useEffect, useState } from 'react';

export default function ControleCaixa() {
  const [tab, setTab] = useState('estoque_total');
  const [estoque, setEstoque] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [trocas, setTrocas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.api.get('/api/estoque'),
      window.api.get('/api/produtos'),
      window.api.get('/api/vendas'),
      window.api.get('/api/despesas'),
      window.api.get('/api/trocas'),
    ]).then(([est, prods, vds, desp, troc]) => {
      setEstoque(est);
      setProdutos(prods);
      setVendas(vds);
      setDespesas(desp);
      setTrocas(troc);
      setLoading(false);
    });
  }, []);

  const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

  const produtoMap = {};
  produtos.forEach(p => { produtoMap[p.id] = p; });

  // ── Estoque Total ──────────────────────────────────────────────
  const rows = estoque
    .filter(e => e.quantidade > 0)
    .map(e => {
      const p = produtoMap[e.produto_id] || {};
      const custo = Number(p.preco_custo || 0);
      const venda = Number(p.preco_venda || 0);
      const qtd = Number(e.quantidade || 0);
      const totalCusto = custo * qtd;
      const totalVenda = venda * qtd;
      const lucro = totalVenda - totalCusto;
      const margem = totalVenda > 0 ? (lucro / totalVenda) * 100 : 0;
      return { ...e, preco_custo: custo, preco_venda: venda, totalCusto, totalVenda, lucro, margem };
    });

  const estTotalCusto = rows.reduce((s, r) => s + r.totalCusto, 0);
  const estTotalVenda = rows.reduce((s, r) => s + r.totalVenda, 0);
  const estTotalLucro = rows.reduce((s, r) => s + r.lucro, 0);
  const estMargemGeral = estTotalVenda > 0 ? (estTotalLucro / estTotalVenda) * 100 : 0;
  const estTotalItens = rows.reduce((s, r) => s + r.quantidade, 0);

  // ── Estoque Atual (Vendas) ─────────────────────────────────────
  const vendasFinalizadas = vendas.filter(v => v.status === 'finalizada');
  const vendasCanceladas = vendas.filter(v => v.status === 'cancelada');
  const receitaRealizada = vendasFinalizadas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalDescontos = vendasFinalizadas.reduce((s, v) => s + Number(v.desconto || 0), 0);
  const ticketMedio = vendasFinalizadas.length > 0 ? receitaRealizada / vendasFinalizadas.length : 0;
  const trocasPendentes = trocas.filter(t => t.status === 'pendente');
  const trocasConcluidas = trocas.filter(t => t.status === 'concluida');

  // ── Receita x Despesas ─────────────────────────────────────────
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor || 0), 0);
  const saldoCaixa = receitaRealizada - totalDespesas;

  // Agrupar despesas por categoria para tabela
  const despesasPorCat = {};
  despesas.forEach(d => {
    const cat = d.categoria_nome || 'Sem categoria';
    if (!despesasPorCat[cat]) despesasPorCat[cat] = 0;
    despesasPorCat[cat] += Number(d.valor || 0);
  });

  if (loading) return <div style={{ padding: 32 }}>Carregando...</div>;

  const tabStyle = (id) => ({
    padding: '10px 20px',
    background: tab === id ? 'var(--accent)' : 'transparent',
    color: tab === id ? 'white' : 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderBottom: tab === id ? '1px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: tab === id ? '8px 8px 0 0' : 0,
    cursor: 'pointer',
    fontSize: 14,
    marginBottom: -1,
    position: 'relative',
  });

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Controle de Caixa</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        <button style={tabStyle('estoque_total')} onClick={() => setTab('estoque_total')}>Estoque Total</button>
        <button style={tabStyle('estoque_atual')} onClick={() => setTab('estoque_atual')}>Estoque Atual</button>
        <button style={tabStyle('receita_despesas')} onClick={() => setTab('receita_despesas')}>Receita x Despesas</button>
      </div>

      {/* ── TAB 1: Estoque Total ── */}
      {tab === 'estoque_total' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Total de Itens em Estoque</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{estTotalItens}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{rows.length} SKUs</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Capital Investido (Custo)</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--warning)' }}>{fmt(estTotalCusto)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Valor total pelo preço de custo</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Receita Prevista (Venda)</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>{fmt(estTotalVenda)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Se vender todo o estoque</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Lucro Líquido Previsto</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)' }}>{fmt(estTotalLucro)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Margem geral: {pct(estMargemGeral)}</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Detalhamento por Item de Estoque</h3>
            <div style={{ maxHeight: 'calc(100vh - 420px)', minHeight: 480, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Tamanho / Cor</th>
                    <th style={{ textAlign: 'right' }}>Qtd</th>
                    <th style={{ textAlign: 'right' }}>Preço Custo</th>
                    <th style={{ textAlign: 'right' }}>Preço Venda</th>
                    <th style={{ textAlign: 'right' }}>Total Custo</th>
                    <th style={{ textAlign: 'right' }}>Receita Prevista</th>
                    <th style={{ textAlign: 'right' }}>Lucro Previsto</th>
                    <th style={{ textAlign: 'right' }}>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{r.produto_nome}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.tamanho || '-'} / {r.cor || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.quantidade}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.preco_custo)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.preco_venda)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{fmt(r.totalCusto)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(r.totalVenda)}</td>
                      <td style={{ textAlign: 'right', color: r.lucro >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{fmt(r.lucro)}</td>
                      <td style={{ textAlign: 'right', color: r.margem >= 0 ? 'var(--success)' : 'var(--danger)' }}>{pct(r.margem)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={5}>TOTAL</td>
                    <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{fmt(estTotalCusto)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(estTotalVenda)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt(estTotalLucro)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{pct(estMargemGeral)}</td>
                  </tr>
                </tfoot>
              </table>
              {rows.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Nenhum item em estoque</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Estoque Atual (Vendas) ── */}
      {tab === 'estoque_atual' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Total de Vendas</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{vendasFinalizadas.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{vendasCanceladas.length} cancelada(s)</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Receita Realizada</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)' }}>{fmt(receitaRealizada)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Vendas finalizadas</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Ticket Médio</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--warning)' }}>{fmt(ticketMedio)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Por venda finalizada</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Descontos Concedidos</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalDescontos)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total em descontos</div>
            </div>
          </div>

          {/* Tabela de vendas */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 16 }}>Detalhamento de Vendas</h3>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Pagamento</th>
                    <th style={{ textAlign: 'right' }}>Desconto</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vendas].sort((a, b) => new Date(b.data) - new Date(a.data)).map(v => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>#{v.id}</td>
                      <td style={{ fontSize: 12 }}>{new Date(v.data).toLocaleString('pt-BR')}</td>
                      <td>{v.cliente_nome || '-'}</td>
                      <td style={{ fontSize: 12 }}>{v.forma_pagamento || '-'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger)', fontSize: 12 }}>{Number(v.desconto || 0) > 0 ? fmt(v.desconto) : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{fmt(v.total)}</td>
                      <td>
                        {v.status === 'finalizada' && <span className="badge badge-success">Finalizada</span>}
                        {v.status === 'cancelada' && <span className="badge badge-danger">Cancelada</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vendas.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma venda registrada</p>}
            </div>
          </div>

          {/* Tabela de trocas/devoluções */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>
              Trocas e Devoluções
              {trocasPendentes.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 10 }}>{trocasPendentes.length} pendente(s)</span>
              )}
            </h3>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Motivo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trocas.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma troca ou devolução</td></tr>
                  ) : (
                    [...trocas].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).map(t => (
                      <tr key={t.id}>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>#{t.id}</td>
                        <td style={{ fontSize: 12 }}>{t.criado_em ? new Date(t.criado_em).toLocaleString('pt-BR') : '-'}</td>
                        <td>
                          {t.tipo === 'troca'
                            ? <span className="badge" style={{ background: '#9b59b6', color: 'white' }}>Troca</span>
                            : <span className="badge badge-danger">Devolução</span>}
                        </td>
                        <td style={{ fontSize: 13 }}>{t.motivo}</td>
                        <td>
                          {t.status === 'pendente' && <span className="badge badge-warning">Pendente</span>}
                          {t.status === 'concluida' && <span className="badge badge-success">Concluída</span>}
                          {t.status === 'recusada' && <span className="badge badge-danger">Recusada</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Receita x Despesas ── */}
      {tab === 'receita_despesas' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Receita Realizada</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)' }}>{fmt(receitaRealizada)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{vendasFinalizadas.length} vendas finalizadas</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Total de Despesas</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalDespesas)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{despesas.length} despesa(s) registrada(s)</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Saldo do Caixa</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: saldoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(saldoCaixa)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Receita − Despesas</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Margem Líquida</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: saldoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {receitaRealizada > 0 ? pct((saldoCaixa / receitaRealizada) * 100) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sobre a receita total</div>
            </div>
          </div>

          {/* Barra comparativa visual */}
          {receitaRealizada > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Distribuição do Caixa</h3>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--danger)' }}>Despesas {pct((totalDespesas / receitaRealizada) * 100)}</span>
                  <span style={{ color: 'var(--success)' }}>Saldo {pct(Math.max(0, (saldoCaixa / receitaRealizada) * 100))}</span>
                </div>
                <div style={{ height: 20, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${Math.min(100, (totalDespesas / receitaRealizada) * 100)}%`, background: 'var(--danger)', transition: 'width 0.4s' }} />
                  <div style={{ flex: 1, background: 'var(--success)', opacity: 0.7 }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Despesas por categoria */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Despesas por Categoria</h3>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>% Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(despesasPorCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>{fmt(val)}</td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {receitaRealizada > 0 ? pct((val / receitaRealizada) * 100) : '—'}
                        </td>
                      </tr>
                    ))}
                    {despesas.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma despesa</td></tr>
                    )}
                  </tbody>
                  {despesas.length > 0 && (
                    <tfoot>
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                        <td>TOTAL</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(totalDespesas)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>
                          {receitaRealizada > 0 ? pct((totalDespesas / receitaRealizada) * 100) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Resumo receita x despesa */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Resumo Financeiro</h3>
              <table>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>Receita Bruta</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)', padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>{fmt(receitaRealizada)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', color: 'var(--danger)' }}>( − ) Descontos Concedidos</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>{fmt(totalDescontos)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', color: 'var(--danger)' }}>( − ) Total de Despesas</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>{fmt(totalDespesas)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700, fontSize: 15 }}>
                    <td style={{ padding: '12px 8px' }}>Saldo Líquido do Caixa</td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', color: saldoCaixa >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(saldoCaixa)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
