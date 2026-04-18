import React, { useState, useEffect } from 'react';
import { exportPDF } from '../utils/pdfExport';

export default function FechamentoCaixa({ user }) {
  const [fechamento, setFechamento] = useState(null);
  const [periodo, setPeriodo] = useState('diario');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [quinzena, setQuinzena] = useState('1');

  useEffect(() => {
    loadFechamento();
  }, [periodo, data, mes, quinzena]);

  const getDateRange = () => {
    if (periodo === 'diario') return { data_inicio: data, data_fim: data };
    const [year, month] = mes.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    if (periodo === 'quinzenal') {
      if (quinzena === '1') return { data_inicio: `${mes}-01`, data_fim: `${mes}-15` };
      return { data_inicio: `${mes}-16`, data_fim: `${mes}-${String(lastDay).padStart(2, '0')}` };
    }
    // mensal
    return { data_inicio: `${mes}-01`, data_fim: `${mes}-${String(lastDay).padStart(2, '0')}` };
  };

  const loadFechamento = () => {
    const { data_inicio, data_fim } = getDateRange();
    window.api.get(`/api/relatorios/fechamento?data_inicio=${data_inicio}&data_fim=${data_fim}`).then(setFechamento);
  };

  const getPeriodoLabel = () => {
    const { data_inicio, data_fim } = getDateRange();
    if (periodo === 'diario') return new Date(data_inicio + 'T00:00:00').toLocaleDateString('pt-BR');
    if (periodo === 'quinzenal') {
      const q = quinzena === '1' ? '1ª Quinzena' : '2ª Quinzena';
      const [y, m] = mes.split('-');
      return `${q} de ${new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    }
    const [y, m] = mes.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getFilename = () => {
    const { data_inicio, data_fim } = getDateRange();
    if (periodo === 'diario') return `fechamento-caixa-${data_inicio}.pdf`;
    if (periodo === 'quinzenal') return `fechamento-quinzenal-${data_inicio}-${data_fim}.pdf`;
    return `fechamento-mensal-${mes}.pdf`;
  };

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  const exportToPDF = () => {
    if (!fechamento) return;
    const title = `Fechamento de Caixa - ${getPeriodoLabel()}`;

    const headers = ['Resumo', 'Valor'];
    const rows = [
      ['Total Vendas', formatCurrency(fechamento.total_vendas)],
      ['Despesas', formatCurrency(fechamento.total_despesas)],
      ['Devoluções', fechamento.devolucoes_qtd > 0 ? `-${formatCurrency(fechamento.total_devolucoes)} (${fechamento.devolucoes_qtd}x)` : 'Nenhuma'],
      ['Taxas Cartão', fechamento.total_taxas_cartao > 0 ? `-${formatCurrency(fechamento.total_taxas_cartao)}` : 'Nenhuma'],
      ['Líquido', formatCurrency(fechamento.liquido)],
      ['Dinheiro em Caixa', formatCurrency(fechamento.dinheiro_em_caixa)],
      ['Ticket Médio', formatCurrency(fechamento.ticket_medio)]
    ];

    if (fechamento.por_pagamento && fechamento.por_pagamento.some(p => p.qtd > 0)) {
      rows.push(['', '']);
      rows.push(['Forma de Pagamento', 'Qtd / Total']);
      fechamento.por_pagamento.filter(p => p.qtd > 0).forEach(p => {
        rows.push([p.nome, `${p.qtd} - ${formatCurrency(p.total)}`]);
      });
    }

    if (fechamento.por_usuario && fechamento.por_usuario.length > 0) {
      rows.push(['', '']);
      rows.push(['Vendedor', 'Qtd / Total']);
      fechamento.por_usuario.forEach(u => {
        rows.push([u.nome, `${u.qtd} - ${formatCurrency(u.total)}`]);
      });
    }

    if (fechamento.vendas_detalhes && fechamento.vendas_detalhes.length > 0) {
      rows.push(['', '']);
      rows.push(['# Venda', 'Data / Pagamento / Total']);
      fechamento.vendas_detalhes.forEach(v => {
        rows.push([`#${v.id}`, `${new Date(v.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} - ${v.forma_pagamento} - ${formatCurrency(v.total)}`]);
      });
    }

    const footer = `Total: ${formatCurrency(fechamento.total_vendas)} | Líquido: ${formatCurrency(fechamento.liquido)}`;
    exportPDF({ title, headers, data: rows, footer, filename: getFilename() });
  };

  if (!fechamento) return <p>Carregando...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1>Fechamento de Caixa</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ width: 'auto' }}>
            <option value="diario">Diário</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal</option>
          </select>

          {periodo === 'diario' && (
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ width: 'auto' }} />
          )}

          {(periodo === 'quinzenal' || periodo === 'mensal') && (
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 'auto' }} />
          )}

          {periodo === 'quinzenal' && (
            <select value={quinzena} onChange={e => setQuinzena(e.target.value)} style={{ width: 'auto' }}>
              <option value="1">1ª Quinzena (1-15)</option>
              <option value="2">2ª Quinzena (16-fim)</option>
            </select>
          )}

          <button className="btn-secondary" onClick={exportToPDF} style={{ marginLeft: 8 }}>Exportar PDF</button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Período: <strong style={{ color: 'var(--text-primary)' }}>{getPeriodoLabel()}</strong>
      </p>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Total Vendas</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(fechamento.total_vendas)}</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fechamento.vendas} vendas</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Despesas</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(fechamento.total_despesas)}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Devoluções</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>
            {fechamento.devolucoes_qtd > 0 ? `-${formatCurrency(fechamento.total_devolucoes)}` : formatCurrency(0)}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fechamento.devolucoes_qtd} devolução(ões)</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Taxas Cartão</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>
            {fechamento.total_taxas_cartao > 0 ? `-${formatCurrency(fechamento.total_taxas_cartao)}` : formatCurrency(0)}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>juros operadora</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Líquido</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: fechamento.liquido >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(fechamento.liquido)}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Dinheiro em Caixa</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(fechamento.dinheiro_em_caixa)}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Ticket Médio</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(fechamento.ticket_medio)}</p>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Por Forma de Pagamento</h3>
        <table>
          <thead><tr><th>Forma</th><th>Qtd</th><th>Valor</th></tr></thead>
          <tbody>
            {fechamento.por_pagamento.filter(p => p.qtd > 0).map(p => (
              <tr key={p.nome}>
                <td>{p.nome}</td>
                <td>{p.qtd}</td>
                <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(p.total)}</td>
              </tr>
            ))}
            {fechamento.por_pagamento.every(p => p.qtd === 0) && (
              <tr><td colSpan="3" style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)' }}>Nenhuma venda no período</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sales by User */}
      {fechamento.por_usuario.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Vendas por Usuário</h3>
          <table>
            <thead><tr><th>Usuário</th><th>Qtd Vendas</th><th>Total</th></tr></thead>
            <tbody>
              {fechamento.por_usuario.map(u => (
                <tr key={u.usuario_id}>
                  <td>{u.nome}</td>
                  <td>{u.qtd}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(u.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sales Details */}
      {fechamento.vendas_detalhes.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Detalhe das Vendas</h3>
          <div style={{ maxHeight: '40vh', overflow: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Data/Hora</th><th>Pagamento</th><th>Total</th></tr></thead>
              <tbody>
                {fechamento.vendas_detalhes.map(v => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{new Date(v.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{v.forma_pagamento}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
