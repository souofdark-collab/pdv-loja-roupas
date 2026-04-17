import React, { useEffect, useState } from 'react';
import { exportPDF } from '../utils/pdfExport';

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [filtro, setFiltro] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    window.api.get('/api/auditoria?limit=500').then(setLogs);
  };

  const filtered = logs.filter(l =>
    !filtro ||
    l.acao?.toLowerCase().includes(filtro.toLowerCase()) ||
    l.usuario_nome?.toLowerCase().includes(filtro.toLowerCase()) ||
    l.detalhes?.toLowerCase().includes(filtro.toLowerCase())
  );

  const exportToPDF = () => {
    exportPDF({
      title: 'Log de Auditoria',
      filename: `auditoria-${new Date().toISOString().split('T')[0]}.pdf`,
      headers: ['Data/Hora', 'Usuário', 'Ação', 'Detalhes'],
      data: filtered.map(l => [
        new Date(l.criado_em).toLocaleString('pt-BR'),
        l.usuario_nome,
        l.acao,
        l.detalhes
      ]),
      footer: `Total: ${filtered.length} registros`
    });
  };

  const acaoColor = (acao) => {
    if (acao?.includes('Cancelamento')) return 'var(--danger)';
    if (acao?.includes('Abertura')) return 'var(--success)';
    if (acao?.includes('Fechamento')) return 'var(--warning)';
    if (acao?.includes('Preço')) return 'var(--accent)';
    return 'var(--text-primary)';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Log de Auditoria</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ width: 220 }} />
          <button className="btn-secondary" onClick={exportToPDF}>Exportar PDF</button>
          <button className="btn-secondary" onClick={loadData}>Atualizar</button>
        </div>
      </div>

      <div className="card">
        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <table>
            <thead>
              <tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                  <td>{l.usuario_nome}</td>
                  <td><span style={{ fontWeight: 600, color: acaoColor(l.acao) }}>{l.acao}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{l.detalhes}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{filtered.length} registros</p>
      </div>
    </div>
  );
}
