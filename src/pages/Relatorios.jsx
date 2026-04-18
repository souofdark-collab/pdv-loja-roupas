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
      } else if (tipoRelatorio === 'margem-lucro') {
        const params = new URLSearchParams();
        if (inicio) params.append('data_inicio', inicio);
        if (fim) params.append('data_fim', fim);
        res = await window.api.get(`/api/relatorios/margem-lucro?${params}`);
      } else if (tipoRelatorio === 'ranking-clientes') {
        const params = new URLSearchParams();
        if (inicio) params.append('data_inicio', inicio);
        if (fim) params.append('data_fim', fim);
        res = await window.api.get(`/api/relatorios/ranking-clientes?${params}`);
      } else if (tipoRelatorio === 'giro-estoque') {
        res = await window.api.get(`/api/relatorios/giro-estoque?dias=30`);
      } else if (tipoRelatorio === 'comparativo-mensal') {
        res = await window.api.get(`/api/relatorios/comparativo-mensal`);
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
    } else if (tipoRelatorio === 'margem-lucro' && Array.isArray(data) && data.length) {
      title = 'Margem de Lucro por Produto';
      headers = ['Produto', 'Qtd', 'Receita', 'Custo', 'Lucro', 'Margem %'];
      rows = data.map(p => [p.nome, p.qtd, formatCurrency(p.receita), formatCurrency(p.custo), formatCurrency(p.lucro), `${p.margem_pct.toFixed(1)}%`]);
    } else if (tipoRelatorio === 'ranking-clientes' && Array.isArray(data) && data.length) {
      title = 'Ranking de Clientes';
      headers = ['#', 'Cliente', 'Telefone', 'Compras', 'Ticket Médio', 'Total Gasto'];
      rows = data.map((c, i) => [i + 1, c.nome, c.telefone || '-', c.qtd_compras, formatCurrency(c.ticket_medio), formatCurrency(c.total_gasto)]);
    } else if (tipoRelatorio === 'giro-estoque' && data.produtos) {
      title = `Giro de Estoque — ${data.dias} dias`;
      headers = ['Produto', 'Estoque Atual', 'Vendido', 'Média Diária', 'Dias Restantes'];
      rows = data.produtos.map(p => [p.nome, p.estoque_atual, p.vendido_periodo, p.media_diaria, p.dias_restantes === null ? '—' : `${p.dias_restantes}`]);
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
    } else if (tipoRelatorio === 'margem-lucro' && Array.isArray(data)) {
      csv = 'Produto,Qtd,Receita,Custo,Lucro,Margem %\n';
      data.forEach(p => {
        csv += [p.nome, p.qtd, p.receita, p.custo, p.lucro, p.margem_pct.toFixed(2)].map(escapeCSV).join(',') + '\n';
      });
    } else if (tipoRelatorio === 'ranking-clientes' && Array.isArray(data)) {
      csv = 'Cliente,Telefone,Compras,Ticket Médio,Total Gasto,Última Compra\n';
      data.forEach(c => {
        csv += [c.nome, c.telefone || '', c.qtd_compras, c.ticket_medio.toFixed(2), c.total_gasto.toFixed(2), c.ultima_compra || ''].map(escapeCSV).join(',') + '\n';
      });
    } else if (tipoRelatorio === 'giro-estoque' && data.produtos) {
      csv = 'Produto,Estoque Atual,Vendido,Média Diária,Dias Restantes\n';
      data.produtos.forEach(p => {
        csv += [p.nome, p.estoque_atual, p.vendido_periodo, p.media_diaria, p.dias_restantes ?? ''].map(escapeCSV).join(',') + '\n';
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

  const escXml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const buildReportRows = () => {
    let title = '', headers = [], rows = [];
    if (tipoRelatorio === 'vendas' && data?.vendas) {
      title = 'Vendas por Período';
      headers = ['ID', 'Data', 'Cliente', 'Vendedor', 'Pagamento', 'Total'];
      rows = data.vendas.map(v => [v.id, new Date(v.data).toLocaleString('pt-BR'), v.cliente_nome || '-', v.usuario_nome, v.forma_pagamento, Number(v.total).toFixed(2)]);
    } else if (tipoRelatorio === 'mais-vendidos' && data?.length) {
      title = 'Mais Vendidos';
      headers = ['Produto', 'Categoria', 'Qtd Vendida', 'Total'];
      rows = data.map(p => [p.nome, p.categoria || '-', p.qtd_vendida, Number(p.total).toFixed(2)]);
    } else if (tipoRelatorio === 'estoque-valor' && data?.length) {
      title = 'Valor em Estoque';
      headers = ['Produto', 'Categoria', 'Qtd Total', 'Valor Venda', 'Valor Custo'];
      rows = data.map(p => [p.nome, p.categoria || '-', p.qtd_total, Number(p.valor_venda).toFixed(2), Number(p.valor_custo).toFixed(2)]);
    } else if (tipoRelatorio === 'por-vendedor' && data?.length) {
      title = 'Vendas por Vendedor';
      headers = ['Vendedor', 'Qtd Vendas', 'Total'];
      rows = data.map(v => [v.nome, v.qtd_vendas, Number(v.total).toFixed(2)]);
    } else if (tipoRelatorio === 'comissoes' && data?.length) {
      title = 'Comissões por Vendedor';
      headers = ['Vendedor', 'Comissão %', 'Qtd Vendas', 'Total Vendas', 'Comissão R$'];
      rows = data.map(v => [v.nome, v.comissao_pct, v.qtd_vendas, Number(v.total_vendas).toFixed(2), Number(v.comissao_valor).toFixed(2)]);
    } else if (tipoRelatorio === 'margem-lucro' && Array.isArray(data)) {
      title = 'Margem de Lucro';
      headers = ['Produto', 'Qtd', 'Receita', 'Custo', 'Lucro', 'Margem %'];
      rows = data.map(p => [p.nome, p.qtd, Number(p.receita).toFixed(2), Number(p.custo).toFixed(2), Number(p.lucro).toFixed(2), Number(p.margem_pct).toFixed(2)]);
    } else if (tipoRelatorio === 'ranking-clientes' && Array.isArray(data)) {
      title = 'Ranking de Clientes';
      headers = ['Cliente', 'Telefone', 'Compras', 'Ticket Médio', 'Total Gasto', 'Última Compra'];
      rows = data.map(c => [c.nome, c.telefone || '', c.qtd_compras, Number(c.ticket_medio).toFixed(2), Number(c.total_gasto).toFixed(2), c.ultima_compra || '']);
    } else if (tipoRelatorio === 'giro-estoque' && data?.produtos) {
      title = `Giro de Estoque (${data.dias} dias)`;
      headers = ['Produto', 'Estoque Atual', 'Vendido', 'Média Diária', 'Dias Restantes'];
      rows = data.produtos.map(p => [p.nome, p.estoque_atual, p.vendido_periodo, p.media_diaria, p.dias_restantes ?? '']);
    } else if (tipoRelatorio === 'comparativo-mensal' && Array.isArray(data)) {
      title = 'Comparativo Mensal';
      headers = ['Mês', 'Qtd Vendas', 'Receita', 'Ticket Médio'];
      rows = data.map(m => [m.mes, m.qtd_vendas, Number(m.receita).toFixed(2), Number(m.ticket_medio).toFixed(2)]);
    }
    return { title, headers, rows };
  };

  const exportXLSX = () => {
    if (!data) return;
    const { title, headers, rows } = buildReportRows();
    if (!headers.length) return;
    const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v));
    const cells = (arr) => arr.map(c => {
      if (isNum(c)) return `<Cell><Data ss:Type="Number">${escXml(c)}</Data></Cell>`;
      return `<Cell><Data ss:Type="String">${escXml(c)}</Data></Cell>`;
    }).join('');
    const headerRow = `<Row>${headers.map(h => `<Cell ss:StyleID="sH"><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}</Row>`;
    const body = rows.map(r => `<Row>${cells(r)}</Row>`).join('');
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="sH"><Font ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${escXml(title || 'Relatorio')}">
  <Table>
   ${headerRow}
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${tipoRelatorio}-${new Date().toISOString().split('T')[0]}.xls`;
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
              <option value="margem-lucro">Margem de Lucro por Produto</option>
              <option value="ranking-clientes">Ranking de Clientes</option>
              <option value="giro-estoque">Giro de Estoque (30 dias)</option>
              <option value="comparativo-mensal">Comparativo Mensal</option>
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
              <button className="btn-secondary" onClick={exportXLSX}>Exportar Excel</button>
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

          {/* Margem de Lucro */}
          {tipoRelatorio === 'margem-lucro' && Array.isArray(data) && data.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>Margem de Lucro por Produto</h3>
              <table>
                <thead><tr><th>Produto</th><th>Qtd</th><th>Receita</th><th>Custo</th><th>Lucro</th><th>Margem %</th></tr></thead>
                <tbody>
                  {data.map(p => (
                    <tr key={p.produto_id}>
                      <td>{p.nome}</td>
                      <td>{p.qtd}</td>
                      <td>{formatCurrency(p.receita)}</td>
                      <td>{formatCurrency(p.custo)}</td>
                      <td style={{ fontWeight: 600, color: p.lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(p.lucro)}</td>
                      <td>{p.margem_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700 }}>
                Lucro Total: {formatCurrency(data.reduce((s, p) => s + p.lucro, 0))}
              </div>
            </>
          )}

          {/* Ranking Clientes */}
          {tipoRelatorio === 'ranking-clientes' && Array.isArray(data) && data.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>Ranking de Clientes</h3>
              <table>
                <thead><tr><th>#</th><th>Cliente</th><th>Telefone</th><th>Compras</th><th>Ticket Médio</th><th>Total Gasto</th><th>Última Compra</th></tr></thead>
                <tbody>
                  {data.map((c, i) => (
                    <tr key={c.cliente_id}>
                      <td>{i + 1}</td>
                      <td><strong>{c.nome}</strong></td>
                      <td>{c.telefone || '-'}</td>
                      <td>{c.qtd_compras}</td>
                      <td>{formatCurrency(c.ticket_medio)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(c.total_gasto)}</td>
                      <td style={{ fontSize: 12 }}>{c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Giro de Estoque */}
          {tipoRelatorio === 'giro-estoque' && data.produtos && data.produtos.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16 }}>Giro de Estoque — últimos {data.dias} dias</h3>
              <table>
                <thead><tr><th>Produto</th><th>Estoque Atual</th><th>Vendido</th><th>Média Diária</th><th>Dias Restantes</th></tr></thead>
                <tbody>
                  {data.produtos.map(p => (
                    <tr key={p.produto_id}>
                      <td>{p.nome}</td>
                      <td>{p.estoque_atual}</td>
                      <td>{p.vendido_periodo}</td>
                      <td>{p.media_diaria}</td>
                      <td style={{ color: p.dias_restantes !== null && p.dias_restantes < 7 ? 'var(--danger)' : 'inherit', fontWeight: p.dias_restantes !== null && p.dias_restantes < 7 ? 600 : 400 }}>
                        {p.dias_restantes === null ? '—' : `${p.dias_restantes} dias`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Comparativo Mensal */}
          {tipoRelatorio === 'comparativo-mensal' && data.atual && (
            <>
              <h3 style={{ marginBottom: 16 }}>Comparativo Mensal</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mês Anterior ({data.mes_anterior})</p>
                  <p style={{ fontSize: 26, fontWeight: 700 }}>{formatCurrency(data.anterior.total)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.anterior.qtd} vendas | Ticket: {formatCurrency(data.anterior.ticket_medio)}</p>
                </div>
                <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mês Atual ({data.mes_atual})</p>
                  <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(data.atual.total)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.atual.qtd} vendas | Ticket: {formatCurrency(data.atual.ticket_medio)}</p>
                </div>
                <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Variação</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: data.variacao_pct === null ? 'var(--text-secondary)' : data.variacao_pct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {data.variacao_pct === null ? '—' : `${data.variacao_pct >= 0 ? '+' : ''}${data.variacao_pct.toFixed(1)}%`}
                  </p>
                </div>
              </div>
            </>
          )}

          {((tipoRelatorio === 'mais-vendidos' || tipoRelatorio === 'estoque-valor' || tipoRelatorio === 'por-vendedor' || tipoRelatorio === 'comissoes' || tipoRelatorio === 'margem-lucro' || tipoRelatorio === 'ranking-clientes') && Array.isArray(data) && data.length === 0) && (
            <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Sem dados para exibir</p>
          )}
          {tipoRelatorio === 'giro-estoque' && data.produtos && data.produtos.length === 0 && (
            <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Sem movimentação no período</p>
          )}
          {tipoRelatorio === 'vendas' && data.vendas && data.vendas.length === 0 && (
            <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhuma venda no período</p>
          )}
        </div>
      )}
    </div>
  );
}
