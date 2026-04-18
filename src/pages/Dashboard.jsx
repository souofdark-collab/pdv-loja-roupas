import React, { useEffect, useState } from 'react';

export default function Dashboard({ onOpenModal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.get('/api/relatorios/dashboard')
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>;
  if (!data) return <p style={{ color: 'var(--danger)' }}>Erro ao carregar dados</p>;

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>

      {/* Quick Action Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px 16px' }} onClick={() => onOpenModal('pdv')}>
          <p style={{ fontSize: 24, marginBottom: 4 }}>🛒</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Iniciar Venda</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 0 }}>F1</p>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px 16px' }} onClick={() => onOpenModal('vendas-hoje')}>
          <p style={{ fontSize: 24, marginBottom: 4 }}>📋</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Vendas Hoje</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 0 }}>F6</p>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px 16px' }} onClick={() => onOpenModal('vendas-semana')}>
          <p style={{ fontSize: 24, marginBottom: 4 }}>📊</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Vendas na Semana</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 0 }}>F7</p>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px 16px' }} onClick={() => onOpenModal('vendas-mes')}>
          <p style={{ fontSize: 24, marginBottom: 4 }}>📅</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Vendas no Mês</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 0 }}>F8</p>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px 16px' }} onClick={() => onOpenModal('vendas-geral')}>
          <p style={{ fontSize: 24, marginBottom: 4 }}>📜</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Histórico de Vendas</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 0 }}>F9</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Vendas Hoje</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{data.vendas_hoje.qtd}</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{formatCurrency(data.vendas_hoje.valor)}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Vendas na Semana</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>{data.vendas_semana.qtd}</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{formatCurrency(data.vendas_semana.valor)}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Vendas no Mês</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>{data.vendas_mes.qtd}</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{formatCurrency(data.vendas_mes.valor)}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ticket Médio (Mês)</p>
          <p style={{ fontSize: 32, fontWeight: 700 }}>{formatCurrency(data.ticket_medio)}</p>
        </div>
      </div>

      {/* Grafico 7 dias */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16 }}>Vendas - Últimos 7 Dias</h3>
        {data.grafico_7dias && data.grafico_7dias.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 180, padding: '0 10px' }}>
            {(() => {
              const maxValor = Math.max(...data.grafico_7dias.map(d => d.valor), 1);
              return data.grafico_7dias.map((d, i) => {
                const barHeight = (d.valor / maxValor) * 140;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {d.valor > 0 ? formatCurrency(d.valor) : '-'}
                    </span>
                    <div style={{
                      width: '100%',
                      height: Math.max(barHeight, 4),
                      background: d.valor > 0 ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s',
                      minHeight: 4
                    }}></div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {d.qtd}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {d.label}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>Nenhuma venda registrada ainda</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Pagamentos */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Vendas por Pagamento (Hoje)</h3>
          {data.por_pagamento.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma venda hoje</p>
          ) : (
            <table>
              <thead>
                <tr><th>Forma</th><th>Qtd</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {data.por_pagamento.map((p, i) => (
                  <tr key={i}>
                    <td>{p.forma_pagamento}</td>
                    <td>{p.qtd}</td>
                    <td>{formatCurrency(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Produtos */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Mais Vendidos (7 dias)</h3>
          {data.top_produtos.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma venda recente</p>
          ) : (
            <table>
              <thead>
                <tr><th>Produto</th><th>Qtd</th><th>Total</th></tr>
              </thead>
              <tbody>
                {data.top_produtos.map((p, i) => (
                  <tr key={i}>
                    <td>{p.nome}</td>
                    <td>{p.qtd_vendida}</td>
                    <td>{formatCurrency(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Estoque Baixo */}
      {data.estoque_baixo.length > 0 && (
        <div className="card" style={{ marginTop: 16, border: '1px solid var(--danger)', background: 'rgba(220,53,69,0.05)' }}>
          <h3 style={{ marginBottom: 4, color: 'var(--danger)' }}>
            ⚠️ Atenção: Estoque Baixo ({data.estoque_baixo.length} {data.estoque_baixo.length === 1 ? 'item' : 'itens'})
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Os seguintes produtos precisam de reposição urgente:</p>
          <table>
            <thead>
              <tr><th>Produto</th><th>Tamanho</th><th>Cor</th><th>Qtd Atual</th><th>Qtd Mínima</th><th>Falta</th></tr>
            </thead>
            <tbody>
              {data.estoque_baixo.map((e, i) => (
                <tr key={i} style={e.quantidade === 0 ? { background: 'rgba(220,53,69,0.1)' } : {}}>
                  <td><strong>{e.produto_nome}</strong></td>
                  <td>{e.tamanho}</td>
                  <td>{e.cor}</td>
                  <td><span className={`badge ${e.quantidade === 0 ? 'badge-danger' : 'badge-danger'}`}>{e.quantidade}</span></td>
                  <td>{e.minimo}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    {e.quantidade === 0 ? 'SEM ESTOQUE' : `-${e.minimo - e.quantidade}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
