import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }

  reset = () => {
    this.setState({ error: null, info: null });
    window.location.hash = '#/';
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-primary)' }}>
        <div className="card" style={{ maxWidth: 620, width: '100%', padding: 24 }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 12 }}>Ocorreu um erro inesperado</h2>
          <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            A aplicação encontrou um problema e precisa ser recuperada. Seus dados foram preservados.
          </p>
          <pre style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, fontSize: 12, overflow: 'auto', maxHeight: 200, color: 'var(--danger)' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={this.reset}>Voltar ao Início</button>
            <button className="btn-primary" onClick={this.reload}>Recarregar Aplicação</button>
          </div>
        </div>
      </div>
    );
  }
}
