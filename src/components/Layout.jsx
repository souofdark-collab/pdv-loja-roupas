import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const allMenuItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard', roles: ['admin', 'caixa', 'vendedor'] },
  { path: '/produtos', icon: '👕', label: 'Produtos', roles: ['admin', 'caixa'] },
  { path: '/categorias', icon: '🏷️', label: 'Categorias', roles: ['admin', 'caixa'] },
  { path: '/estoque', icon: '📦', label: 'Estoque', roles: ['admin', 'caixa'] },
  { path: '/clientes', icon: '👥', label: 'Clientes', roles: ['admin', 'caixa', 'vendedor'] },
  { path: '/trocas', icon: '🔄', label: 'Trocas', roles: ['admin', 'caixa'] },
  { path: '/promocoes', icon: '💰', label: 'Promoções', roles: ['admin', 'caixa'] },
  { path: '/despesas', icon: '💸', label: 'Despesas', roles: ['admin', 'caixa'] },
  { path: '/fechamento', icon: '🧾', label: 'Fechamento', roles: ['admin', 'caixa'] },
  { path: '/relatorios', icon: '📈', label: 'Relatórios', roles: ['admin'] },
  { path: '/backup', icon: '💾', label: 'Backup', roles: ['admin'] },
  { path: '/usuarios', icon: '👤', label: 'Usuários', roles: ['admin'] },
  { path: '/configuracoes', icon: '⚙️', label: 'Configurações', roles: ['admin'] },
];

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 220 : 60,
        background: 'var(--bg-secondary)',
        borderRight: `1px solid var(--border)`,
        transition: 'width 0.3s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 18 }}>PDV</span>}
          <button
            className="btn-secondary"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ minWidth: 32, padding: '4px 8px' }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {allMenuItems.filter(item => item.roles.includes(user.cargo)).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                  textDecoration: 'none',
                  background: isActive ? 'rgba(233,69,96,0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  fontSize: 14,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div style={{
          padding: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {sidebarOpen && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {user.nome} ({user.cargo})
            </span>
          )}
          <button
            className="btn-danger"
            onClick={() => { onLogout(); navigate('/'); }}
            style={{ fontSize: 13 }}
          >
            {sidebarOpen ? 'Sair' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
