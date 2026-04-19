-- Migration 001: schema inicial do PDV (SQLite)
-- Reflete o formato dos arquivos JSON existentes. Tipos permissivos em colunas
-- que já variaram no passado (ex.: categoria_id). FKs ON em runtime via PRAGMA.

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'vendedor',
  ativo INTEGER NOT NULL DEFAULT 1,
  comissao REAL DEFAULT 0,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  criado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_custo REAL DEFAULT 0,
  preco_venda REAL DEFAULT 0,
  codigo_barras TEXT,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);

CREATE TABLE IF NOT EXISTS estoque (
  id INTEGER PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tamanho TEXT,
  cor TEXT,
  quantidade INTEGER NOT NULL DEFAULT 0,
  minimo INTEGER DEFAULT 1,
  codigo_barras TEXT
);
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_codigo_barras ON estoque(codigo_barras);

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id INTEGER PRIMARY KEY,
  estoque_id INTEGER NOT NULL REFERENCES estoque(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                   -- 'entrada' | 'saida' | 'ajuste'
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_mov_estoque ON estoque_movimentacoes(estoque_id);
CREATE INDEX IF NOT EXISTS idx_mov_criado_em ON estoque_movimentacoes(criado_em);

CREATE TABLE IF NOT EXISTS vendas (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  desconto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL,
  parcelas INTEGER,
  taxa_cartao_pct REAL DEFAULT 0,
  valor_taxa_cartao REAL DEFAULT 0,
  valor_liquido REAL DEFAULT 0,
  saldo_devedor REAL DEFAULT 0,
  motivo_cancelamento TEXT,
  status TEXT NOT NULL DEFAULT 'finalizada',
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data);
CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor ON vendas(vendedor_id);

CREATE TABLE IF NOT EXISTS venda_itens (
  id INTEGER PRIMARY KEY,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  estoque_id INTEGER REFERENCES estoque(id) ON DELETE SET NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario REAL NOT NULL,
  desconto_item REAL DEFAULT 0,
  tamanho TEXT,
  cor TEXT
);
CREATE INDEX IF NOT EXISTS idx_vi_venda ON venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vi_produto ON venda_itens(produto_id);

CREATE TABLE IF NOT EXISTS promocoes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,                   -- 'percentual' | 'valor'
  valor REAL NOT NULL DEFAULT 0,
  inicio TEXT,
  fim TEXT,
  aplicavel_a TEXT DEFAULT 'tudo',
  ativa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS promocoes_regras (
  id INTEGER PRIMARY KEY,
  promocao_id INTEGER NOT NULL REFERENCES promocoes(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
  produto_id INTEGER REFERENCES produtos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pr_promocao ON promocoes_regras(promocao_id);

CREATE TABLE IF NOT EXISTS despesas_categorias (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS despesas (
  id INTEGER PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  categoria_id INTEGER REFERENCES despesas_categorias(id) ON DELETE SET NULL,
  recorrencia TEXT,
  vencimento TEXT,
  data TEXT,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);

CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  ativa INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trocas (
  id INTEGER PRIMARY KEY,
  venda_id INTEGER REFERENCES vendas(id) ON DELETE SET NULL,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  estoque_id INTEGER REFERENCES estoque(id) ON DELETE SET NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  motivo TEXT,
  tipo TEXT NOT NULL DEFAULT 'troca',     -- 'troca' | 'devolucao'
  novo_produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  novo_estoque_id INTEGER REFERENCES estoque(id) ON DELETE SET NULL,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  valor_devolvido REAL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_trocas_venda ON trocas(venda_id);
CREATE INDEX IF NOT EXISTS idx_trocas_status ON trocas(status);

CREATE TABLE IF NOT EXISTS historico_precos (
  id INTEGER PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  produto_nome TEXT,
  preco_custo_anterior REAL,
  preco_venda_anterior REAL,
  preco_custo_novo REAL,
  preco_venda_novo REAL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_hp_produto ON historico_precos(produto_id);

CREATE TABLE IF NOT EXISTS log_acoes (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  detalhes TEXT,
  criado_em TEXT,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_log_criado_em ON log_acoes(criado_em);
CREATE INDEX IF NOT EXISTS idx_log_acao ON log_acoes(acao);

CREATE TABLE IF NOT EXISTS abertura_caixa (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  valor_inicial REAL DEFAULT 0,
  valor_final REAL,
  aberto_em TEXT NOT NULL,
  fechado_em TEXT,
  observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_caixa_fechado_em ON abertura_caixa(fechado_em);

CREATE TABLE IF NOT EXISTS fiado_pagamentos (
  id INTEGER PRIMARY KEY,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  valor REAL NOT NULL,
  forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  observacao TEXT,
  criado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_fp_venda ON fiado_pagamentos(venda_id);
CREATE INDEX IF NOT EXISTS idx_fp_cliente ON fiado_pagamentos(cliente_id);
