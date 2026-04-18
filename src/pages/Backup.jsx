import React, { useState, useEffect } from 'react';
import { useModal } from '../components/Modal';

const TABLES = [
  'usuarios', 'clientes', 'categorias', 'produtos',
  'estoque', 'estoque_movimentacoes', 'vendas',
  'venda_itens', 'promocoes', 'promocoes_regras',
  'despesas_categorias', 'despesas',
  'configuracoes', 'formas_pagamento', 'trocas',
  'historico_precos', 'log_acoes', 'abertura_caixa'
];

export default function Backup({ user }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [backupData, setBackupData] = useState(null);
  const [fileSelected, setFileSelected] = useState(null);
  const [tablesInfo, setTablesInfo] = useState([]);
  const [wipeModal, setWipeModal] = useState(false);
  const [wipeLogin, setWipeLogin] = useState('');
  const [wipeSenha, setWipeSenha] = useState('');
  const [wipeErro, setWipeErro] = useState('');
  const { askConfirm, modalEl } = useModal();

  useEffect(() => {
    loadTablesInfo();
  }, []);

  const loadTablesInfo = () => {
    window.api.get('/api/backup/export').then(backup => {
      setTablesInfo(TABLES.map(table => ({ name: table, count: (backup.data[table] || []).length })));
    }).catch(() => {});
  };

  const handleExport = async () => {
    setLoading(true);
    setStatus('Exportando dados...');
    try {
      const backup = await window.api.get('/api/backup/export');
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
    askConfirm('ATENÇÃO: Isso irá substituir TODOS os dados atuais pelos dados do backup. Deseja continuar?', async () => {
      setLoading(true);
      setStatus('Importando backup...');
      try {
        const text = await fileSelected.text();
        const backup = JSON.parse(text);
        if (!backup.data) { setStatus('Arquivo de backup inválido'); setLoading(false); return; }
        await window.api.post('/api/backup/restore', { data: backup.data, integrity: backup.integrity });
        setStatus('Backup restaurado com sucesso! Recarregando...');
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        setStatus('Erro ao importar: ' + err.message);
      }
      setLoading(false);
    });
  };

  const handleWipe = async () => {
    setWipeErro('');
    if (!wipeLogin.trim() || !wipeSenha) { setWipeErro('Preencha login e senha.'); return; }
    try {
      setLoading(true);
      const res = await window.api.post('/api/backup/wipe', { login: wipeLogin.trim(), senha: wipeSenha });
      if (res && res.success) {
        setWipeModal(false);
        setWipeLogin('');
        setWipeSenha('');
        setStatus('Banco de dados limpo com sucesso! Recarregando...');
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err) {
      setWipeErro(err?.message || 'Erro ao limpar banco de dados.');
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Backup e Restauração</h1>

      {wipeModal && (
        <div className="modal-overlay" onClick={() => { setWipeModal(false); setWipeErro(''); setWipeLogin(''); setWipeSenha(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Limpar Banco de Dados</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Esta ação é <strong>irreversível</strong> e apagará todos os dados (vendas, produtos, clientes, etc.).<br />
              Apenas o administrador principal do sistema pode realizar esta ação.
            </p>
            <div className="form-group">
              <label>Login do Administrador Principal</label>
              <input value={wipeLogin} onChange={e => { setWipeLogin(e.target.value); setWipeErro(''); }} autoFocus placeholder="ex: admin" />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input type="password" value={wipeSenha} onChange={e => { setWipeSenha(e.target.value); setWipeErro(''); }}
                onKeyDown={e => e.key === 'Enter' && handleWipe()} placeholder="Senha" />
              {wipeErro && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{wipeErro}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setWipeModal(false); setWipeErro(''); setWipeLogin(''); setWipeSenha(''); }}>Cancelar</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleWipe} disabled={loading}>Confirmar Limpeza</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Danger Zone */}
      <div className="card" style={{ marginBottom: 24, border: '1px solid var(--danger)' }}>
        <h3 style={{ marginBottom: 8, color: 'var(--danger)' }}>Zona de Perigo</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Limpa todos os dados do sistema. Esta ação não pode ser desfeita. Apenas o administrador principal pode executar.
        </p>
        <button className="btn-danger" onClick={() => setWipeModal(true)} style={{ width: '100%' }}>
          Limpar Banco de Dados
        </button>
      </div>

      {modalEl}

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
