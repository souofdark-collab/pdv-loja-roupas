import React, { useEffect, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState('vendas');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`;

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      let res;
      if (tipoRelatorio === 'vendas') {
        const params = new URLSearchParams();
        if (inicio) params.append('inicio', inicio);
        if (fim) params.append('fim', fim);
        res = await window.api.get(`/api/relatorios/vendas?${params}`);
      } else if (tipoRelatorio === 'mais-vendidos') {
        const params = new URLSearchParams({ tipo: 'mais-vendidos' });
        if (inicio) params.append('inicio', inicio);
        if (fim) params.append('fim', fim);
        res = await window.api.get(`/api/relatorios/produtos?${params}`);
      } else if (tipoRelatorio === 'estoque-valor') {
        res = await window.api.get('/api/relatorios/produtos?tipo=estoque-valor');
      } else if (tipoRelatorio === 'por-vendedor') {
        const params = new URLSearchParams({ tipo: 'por-vendedor' });
        if (inicio) params.append('inicio', inicio);
        if (fim) params.append('fim', fim);
        res = await window.api.get(`/api/relatorios/produtos?${params}`);
      } else if (tipoRelatorio === 'comissoes') {
        const params = new URLSearchParams();
        if (inicio) params.append('data_inicio', inicio);
        if (fim) params.append('data_fim', fim);
        res = await window.api.get(`/api/relatorios/comissoes?${params}`);
      }
      setData(res);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const exportToPDF = () => {
    if (!data) return;
    let headers, rows, title;
    if (tipoRelatorio === 'vendas' && data.vendas) {
      title = 'Relatório de Vendas por Período';
      headers = ['#', 'Data', 'Cliente', 'Vendedor', 'Pagamento', 'Total'];
      rows = data.vendas.map(v => [v.id, new Date(v.data).toLocaleString('pt-BR'), v.cliente_nome || '-', v.usuario_nome, v.forma_pagamento, formatCurrency(v.total)]);
    } else if (tipoRelatorio === 'mais-vendidos' && data.length) {
      title = 'Produtos Mais Vendidos';
      headers = ['Produto', 'Categoria', 'Qtd Vendida', 'Total'];
      rows = data.map(p => [p.nome, p.categoria || '-', p.qtd_vendida, formatCurrency(p.total)]);
    } else if (tipoRelatorio === 'estoque-valor' && data.length) {
      title = 'Valor em Estoque';
      headers = ['Produto', 'Categoria', 'Qtd', 'Valor Venda', 'Valor Custo'];
      rows = data.map(p => [p.nome, p.categoria || '-', p.qtd_total, formatCurrency(p.valor_venda), formatCurrency(p.valor_custo)]);
    } else if (tipoRelatorio === 'por-vendedor' && data.length) {
      title = 'Vendas por Vendedor';
      headers = ['Vendedor', 'Qtd Vendas', 'Total'];
      rows = data.map(v => [v.nome, v.qtd_vendas, formatCurrency(v.total)]);
    } else if (tipoRelatorio === 'comissoes' && data.length) {
      title = 'Relatório de Comissões';
      headers = ['Vendedor', 'Comissão %', 'Qtd Vendas', 'Total Vendas', 'Comissão R$'];
      rows = data.map(v => [v.nome, `${v.comissao_pct}%`, v.qtd_vendas, formatCurrency(v.total_vendas), formatCurrency(v.comissao_valor)]);
    }
    const footer = data.resumo ? `Total Geral: ${formatCurrency(data.resumo.total_geral)}` : `${rows.length} registros`;
    exportPDF({ title, headers, data: rows, footer, filename: `relatorio-${tipoRelatorio}-${new Date().toISOString().split('T')[0]}.pdf` });
  };

  const escapeCSV = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const exportCSV = () => {
    if (!data) return;
    let csv = '';
    if (tipoRelatorio === 'vendas' && data.vendas) {
      csv = 'ID,Data,Cliente,Vendedor,Pagamento,Total\n';
      data.vendas.forEach(v => {
        csv += [v.id, new Date(v.data).toLocaleString('pt-BR'), v.cliente_nome || '-', v.usuario_nome, v.forma_pagamento, v.total].map(escapeCSV).join(',') + '\n';
      });
    } else if (tipoRelatorio === 'mais-vendidos' && data.length) {
      csv = 'Produto,Categoria,Qtd Vendida,Total\n';
      data.forEach(p => {
        csv += [p.nome, p.categoria || '-', p.qtd_vendida, p.total].map(escapeCSV).join(',') + '\n';
      });
    } else if (tipoRelatorio === 'estoque-valor' && data.length) {
      csv = 'Produto,Categoria,Qtd Total,Valor Venda,Valor Custo\n';
      data.forEach(p => {
        csv += [p.nome, p.categoria || '-', p.qtd_total, p.valor_venda, p.valor_custo].map(escapeCSV).join(',') + '\n';
      });
    } else if (tipoRelatorio === 'por-vendedor' && data.length) {
      csv = 'Vendedor,Qtd Vendas,Total\n';
      data.forEach(v => {
        csv += [v.nome, v.qtd_vendas, v.total].map(escapeCSV).join(',') + '\n';
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${tipoRelatorio}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Relatórios</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Tipo de Relatório</label>
            <select value={tipoRelatorio} onChange={e => setTipoRelatorio(e.target.value)}>
              <option value="vendas">Vendas por Período</option>
              <option value="mais-vendidos">Mais Vendidos</option>
              <option value="estoque-valor">Valor em Estoque</option>
              <option value="por-vendedor">Vendas por Vendedor</option>
              <option value="comissoes">Comissões por Vendedor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Data Início</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data Fim</label>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-primary" onClick={gerarRelatorio} disabled={loading}>
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </button>
          {data && (
            <>
              <button className="btn-secondary" onClick={exportCSV}>Exportar CSV</button>
              <button className="btn-secondary" onClick={exportToPDF}>Exportar PDF</button>
            </>
          )}
        </div>
      </div>

      {data && (
        <div className="card">
          {/* Vendas */}
          {tipoRelatorio === 'vendas' && data.vendas && (
            <>
              <h3 style={{ marginBottom: 16 }}>
                Resultado: {data.vendas.length} vendas
                {data.resumo && ` | Total: ${formatCurrency(data.resumo.total_geral)}`}
              </h3>
              <table>
                <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th><th>Total</th></tr></thead>
                <tbody>
                  {data.vendas.map(v => (
                    <tr key={v.id}>
                      <td>{v.id}</td>
                      <td>{new Date(v.data).toLocaleString('pt-BR')}</td>
                      <td>{v.cliente_nome || '-'}</td>
                      <td>{v.usuario_nome}</td>
                      <td>{v.forma_pagamento}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Mais Vendidos */}
          {tipoRelatorio === 'mais-vendidos' && data.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>Produtos Mais Vendidos</h3>
              <table>
                <thead><tr><th>Produto</th><th>Categoria</th><th>Qtd Vendida</th><th>Total</th></tr></thead>
                <tbody>
                  {data.map(p => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td>{p.categoria || '-'}</td>
                      <td>{p.qtd_vendida}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Estoque Valor */}
          {tipoRelatorio === 'estoque-valor' && data.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>Valor em Estoque</h3>
              <table>
                <thead><tr><th>Produto</th><th>Categoria</th><th>Qtd</th><th>Valor Venda</th><th>Valor Custo</th></tr></thead>
                <tbody>
                  {data.map(p => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td>{p.categoria || '-'}</td>
                      <td>{p.qtd_total}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(p.valor_venda)}</td>
                      <td>{formatCurrency(p.valor_custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Por Vendedor */}
          {tipoRelatorio === 'por-vendedor' && data.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>Vendas por Vendedor</h3>
              <table>
                <thead><tr><th>Vendedor</th><th>Qtd Vendas</th><th>Total</th></tr></thead>
                <tbody>
                  {data.map(v => (
                    <tr key={v.usuario_id}>
                      <td>{v.nome}</td>
                      <td>{v.qtd_vendas}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Comissões */}
          {tipoRelatorio === 'comissoes' && Array.isArray(data) && data.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>
                Comissões por Vendedor
                {inicio && fim && ` — ${new Date(inicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(fim+'T00:00:00').toLocaleDateString('pt-BR')}`}
              </h3>
              <table>
                <thead><tr><th>Vendedor</th><th>Comissão %</th><th>Qtd Vendas</th><th>Total Vendas</th><th>Comissão R$</th></tr></thead>
                <tbody>
                  {data.map(v => (
                    <tr key={v.usuario_id}>
                      <td><strong>{v.nome}</strong></td>
                      <td>{v.comissao_pct}%</td>
                      <td>{v.qtd_vendas}</td>
                      <td>{formatCurrency(v.total_vendas)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(v.comissao_valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700, fontSize: 16 }}>
                Total Comissões: {formatCurrency(data.reduce((s, v) => s + v.comissao_valor, 0))}
              </div>
            </>
          )}

          {((tipoRelatorio === 'mais-vendidos' || tipoRelatorio === 'estoque-valor' || tipoRelatorio === 'por-vendedor' || tipoRelatorio === 'comissoes') && Array.isArray(data) && data.length === 0) && (
            <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Sem dados para exibir</p>
          )}
          {tipoRelatorio === 'vendas' && data.vendas && data.vendas.length === 0 && (
            <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma venda no período</p>
          )}
        </div>
      )}
    </div>
  );
}
