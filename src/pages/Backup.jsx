import React, { useState, useEffect } from 'react';

const TABLES = [
  'usuarios', 'clientes', 'categorias', 'produtos',
  'estoque', 'estoque_movimentacoes', 'vendas',
  'venda_itens', 'promocoes', 'promocoes_regras',
  'despesas_categorias', 'despesas',
  'configuracoes', 'formas_pagamento', 'trocas'
];

export default function Backup({ user }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [backupData, setBackupData] = useState(null);
  const [fileSelected, setFileSelected] = useState(null);
  const [tablesInfo, setTablesInfo] = useState([]);

  useEffect(() => {
    loadTablesInfo();
  }, []);

  const loadTablesInfo = () => {
    const promises = TABLES.map(table =>
      window.api.get(`/api/${table}`).catch(() => Promise.resolve([]))
    );
    Promise.all(promises).then(results => {
      setTablesInfo(TABLES.map((table, i) => ({ name: table, count: results[i]?.length || 0 })));
    });
  };

  const handleExport = async () => {
    setLoading(true);
    setStatus('Exportando dados...');
    try {
      const backup = { version: '1.0', exportDate: new Date().toISOString(), data: {} };
      for (const table of TABLES) {
        try {
          const data = await window.api.get(`/api/${table}`);
          backup.data[table] = data;
        } catch {
          backup.data[table] = [];
        }
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdv-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Backup exportado com sucesso!');
    } catch (err) {
      setStatus('Erro ao exportar backup: ' + err.message);
    }
    setLoading(false);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!fileSelected) {
      setStatus('Selecione um arquivo de backup');
      return;
    }
    if (!confirm('ATENÇÃO: Isso irá substituir TODOS os dados atuais pelos dados do backup. Deseja continuar?')) {
      return;
    }
    setLoading(true);
    setStatus('Importando backup...');
    try {
      const text = await fileSelected.text();
      const backup = JSON.parse(text);
      if (!backup.data) {
        setStatus('Arquivo de backup inválido');
        setLoading(false);
        return;
      }
      // Import each table
      for (const [table, records] of Object.entries(backup.data)) {
        if (!TABLES.includes(table)) continue;
        if (!Array.isArray(records)) continue;
        // Delete all existing records first, then insert new ones
        // Since we don't have a "clear table" endpoint, we'll delete one by one
        // For a more efficient approach, we'll use a batch import
        const existing = await window.api.get(`/api/${table}`).catch(() => []);
        // Delete existing
        for (const record of existing) {
          await window.api.delete(`/api/${table}/${record.id}`).catch(() => {});
        }
        // Insert new
        for (const record of records) {
          const { id, ...data } = record;
          await window.api.post(`/api/${table}`, data).catch(() => {});
        }
      }
      setStatus('Backup restaurado com sucesso! Recarregando...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setStatus('Erro ao importar: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Backup e Restauração</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Export */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Exportar Backup</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Exporte todos os dados do sistema em um arquivo JSON para backup.
          </p>
          <button className="btn-primary" onClick={handleExport} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Exportando...' : 'Exportar Backup'}
          </button>
        </div>

        {/* Import */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Restaurar Backup</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Restaure os dados a partir de um arquivo de backup JSON exportado anteriormente.
          </p>
          <form onSubmit={handleImport}>
            <input type="file" accept=".json" onChange={e => setFileSelected(e.target.files[0])}
              style={{ marginBottom: 12, fontSize: 13 }} />
            <button type="submit" className="btn-warning" disabled={loading || !fileSelected} style={{ width: '100%' }}>
              {loading ? 'Restaurando...' : 'Restaurar Backup'}
            </button>
          </form>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ color: status.includes('sucesso') ? 'var(--success)' : status.includes('Erro') ? 'var(--danger)' : 'var(--accent)' }}>
            {status}
          </p>
        </div>
      )}

      {/* Tables Info */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Dados do Sistema</h3>
        <table>
          <thead><tr><th>Tabela</th><th>Registros</th></tr></thead>
          <tbody>
            {tablesInfo.map(t => (
              <tr key={t.name}>
                <td>{t.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                <td>{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
