-- Migration 002: campos fiscais para emissão de NFC-e (Fase 1).
-- Estende `produtos` com classificação fiscal e cria `notas_fiscais` (1 linha
-- por tentativa de emissão). NCM fica sem default por escolha consciente — bloqueia
-- emissão até o usuário revisar item por item. Demais campos têm defaults para
-- Simples Nacional + venda intra-estadual de varejo, que cobre o caso comum.

ALTER TABLE produtos ADD COLUMN ncm TEXT;
ALTER TABLE produtos ADD COLUMN cest TEXT;
ALTER TABLE produtos ADD COLUMN cfop TEXT DEFAULT '5102';
ALTER TABLE produtos ADD COLUMN origem_mercadoria INTEGER DEFAULT 0;
ALTER TABLE produtos ADD COLUMN csosn TEXT DEFAULT '102';
ALTER TABLE produtos ADD COLUMN unidade_comercial TEXT DEFAULT 'UN';
ALTER TABLE produtos ADD COLUMN pis_cst TEXT DEFAULT '49';
ALTER TABLE produtos ADD COLUMN cofins_cst TEXT DEFAULT '49';

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id INTEGER PRIMARY KEY,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'NFCe',
  ambiente INTEGER NOT NULL,                -- 1 = produção, 2 = homologação
  status TEXT NOT NULL,                      -- processando|autorizada|rejeitada|cancelada|denegada|erro
  ref_externa TEXT UNIQUE,                   -- uuid enviado pra Focus NFe
  numero INTEGER,
  serie INTEGER,
  chave TEXT,
  protocolo TEXT,
  data_emissao TEXT,
  data_autorizacao TEXT,
  data_cancelamento TEXT,
  motivo_rejeicao TEXT,
  motivo_cancelamento TEXT,
  url_danfce TEXT,
  url_xml TEXT,
  qrcode_url TEXT,
  payload_enviado TEXT,                      -- JSON debug
  resposta_focus TEXT,                       -- JSON debug
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nf_venda ON notas_fiscais(venda_id);
CREATE INDEX IF NOT EXISTS idx_nf_status ON notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_nf_chave ON notas_fiscais(chave);
