// Fonte única de verdade para os formatos de tabela do banco.
// Derivado diretamente de electron/api/migrations/001_initial.sql.
// Consumido pelo backend (Express routes em .ts) e pelo frontend (wrappers de API).
//
// Convenções:
// - SQLite guarda INTEGER; booleanos são 0/1 (ver campos `ativo`, `ativa`).
// - Datas são ISO strings (`criado_em`, `data`, `aberto_em`, `fechado_em`).
// - Colunas que podem ser NULL no SQL são `| null` no TS.

export type IsoDate = string;
export type SqliteBool = 0 | 1;

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha_hash: string;
  cargo: 'admin' | 'vendedor' | string;
  ativo: SqliteBool;
  comissao: number | null;
  criado_em: IsoDate | null;
}

export interface Cliente {
  id: number;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  criado_por_usuario_id: number | null;
  criado_em: IsoDate | null;
}

export interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
}

export interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  preco_custo: number;
  preco_venda: number;
  codigo_barras: string | null;
  categoria_id: number | null;
  ativo: SqliteBool;
  criado_em: IsoDate | null;
  // Campos fiscais (Fase 1 NFC-e). NCM sem default; demais usam defaults do schema.
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  origem_mercadoria: number | null;
  csosn: string | null;
  unidade_comercial: string | null;
  pis_cst: string | null;
  cofins_cst: string | null;
}

export interface Estoque {
  id: number;
  produto_id: number;
  tamanho: string | null;
  cor: string | null;
  quantidade: number;
  minimo: number | null;
  codigo_barras: string | null;
}

export type EstoqueMovimentacaoTipo = 'entrada' | 'saida' | 'ajuste';

export interface EstoqueMovimentacao {
  id: number;
  estoque_id: number;
  tipo: EstoqueMovimentacaoTipo;
  quantidade: number;
  motivo: string | null;
  usuario_id: number | null;
  criado_em: IsoDate | null;
}

export type VendaStatus = 'finalizada' | 'cancelada';

export type FormaPagamento =
  | 'Dinheiro'
  | 'Pix'
  | 'Cartão de débito'
  | 'Cartão de crédito'
  | 'Fiado'
  | string;

export interface Venda {
  id: number;
  cliente_id: number | null;
  usuario_id: number;
  vendedor_id: number | null;
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: FormaPagamento;
  parcelas: number | null;
  taxa_cartao_pct: number | null;
  valor_taxa_cartao: number | null;
  valor_liquido: number | null;
  saldo_devedor: number | null;
  motivo_cancelamento: string | null;
  status: VendaStatus;
  data: IsoDate;
}

export interface VendaItem {
  id: number;
  venda_id: number;
  produto_id: number;
  estoque_id: number | null;
  quantidade: number;
  preco_unitario: number;
  desconto_item: number | null;
  tamanho: string | null;
  cor: string | null;
}

export interface Promocao {
  id: number;
  nome: string;
  tipo: 'percentual' | 'valor';
  valor: number;
  inicio: IsoDate | null;
  fim: IsoDate | null;
  aplicavel_a: string | null;
  ativa: SqliteBool;
}

export interface PromocaoRegra {
  id: number;
  promocao_id: number;
  categoria_id: number | null;
  produto_id: number | null;
}

export interface DespesaCategoria {
  id: number;
  nome: string;
  descricao: string | null;
}

export interface Despesa {
  id: number;
  descricao: string;
  valor: number;
  categoria_id: number | null;
  recorrencia: string | null;
  vencimento: IsoDate | null;
  data: IsoDate | null;
  criado_em: IsoDate | null;
}

export interface Configuracao {
  id: number;
  chave: string;
  valor: string | null;
}

export interface FormaPagamentoCadastro {
  id: number;
  nome: string;
  ativa: SqliteBool;
  ordem: number | null;
}

export type TrocaStatus = 'pendente' | 'aprovada' | 'recusada' | 'concluida';
export type TrocaTipo = 'troca' | 'devolucao';

export interface Troca {
  id: number;
  venda_id: number | null;
  produto_id: number;
  estoque_id: number | null;
  quantidade: number;
  motivo: string | null;
  tipo: TrocaTipo;
  novo_produto_id: number | null;
  novo_estoque_id: number | null;
  observacao: string | null;
  status: TrocaStatus;
  valor_devolvido: number | null;
  usuario_id: number | null;
  criado_em: IsoDate | null;
}

export interface HistoricoPreco {
  id: number;
  produto_id: number;
  produto_nome: string | null;
  preco_custo_anterior: number | null;
  preco_venda_anterior: number | null;
  preco_custo_novo: number | null;
  preco_venda_novo: number | null;
  usuario_id: number | null;
  criado_em: IsoDate | null;
}

export interface LogAcao {
  id: number;
  usuario_id: number | null;
  usuario_nome: string | null;
  acao: string;
  detalhes: string | null;
  criado_em: IsoDate | null;
  prev_hash: string;
  hash: string;
}

export interface AberturaCaixa {
  id: number;
  usuario_id: number;
  valor_inicial: number | null;
  valor_final: number | null;
  aberto_em: IsoDate;
  fechado_em: IsoDate | null;
  observacao: string | null;
}

export interface FiadoPagamento {
  id: number;
  venda_id: number;
  cliente_id: number | null;
  valor: number;
  forma_pagamento: FormaPagamento;
  usuario_id: number | null;
  observacao: string | null;
  criado_em: IsoDate | null;
}

export type NotaFiscalTipo = 'NFCe' | 'NFe';
export type NotaFiscalStatus =
  | 'processando'
  | 'autorizada'
  | 'rejeitada'
  | 'cancelada'
  | 'denegada'
  | 'erro';
export type NotaFiscalAmbiente = 1 | 2; // 1 = produção, 2 = homologação

export interface NotaFiscal {
  id: number;
  venda_id: number;
  tipo: NotaFiscalTipo;
  ambiente: NotaFiscalAmbiente;
  status: NotaFiscalStatus;
  ref_externa: string | null;
  numero: number | null;
  serie: number | null;
  chave: string | null;
  protocolo: string | null;
  data_emissao: IsoDate | null;
  data_autorizacao: IsoDate | null;
  data_cancelamento: IsoDate | null;
  motivo_rejeicao: string | null;
  motivo_cancelamento: string | null;
  url_danfce: string | null;
  url_xml: string | null;
  qrcode_url: string | null;
  payload_enviado: string | null;
  resposta_focus: string | null;
  usuario_id: number | null;
  criado_em: IsoDate;
}

// Map nome-da-tabela → tipo da linha. Usado como fonte de verdade para
// generics no db.ts (ex.: db.select<'produtos'>() retorna Produto[]).
export interface TableMap {
  usuarios: Usuario;
  clientes: Cliente;
  categorias: Categoria;
  produtos: Produto;
  estoque: Estoque;
  estoque_movimentacoes: EstoqueMovimentacao;
  vendas: Venda;
  venda_itens: VendaItem;
  promocoes: Promocao;
  promocoes_regras: PromocaoRegra;
  despesas_categorias: DespesaCategoria;
  despesas: Despesa;
  configuracoes: Configuracao;
  formas_pagamento: FormaPagamentoCadastro;
  trocas: Troca;
  historico_precos: HistoricoPreco;
  log_acoes: LogAcao;
  abertura_caixa: AberturaCaixa;
  fiado_pagamentos: FiadoPagamento;
  notas_fiscais: NotaFiscal;
}

export type TableName = keyof TableMap;
export type Row<T extends TableName> = TableMap[T];

// Input para INSERT: `id` é opcional (AUTOINCREMENT), demais campos podem ser
// omitidos se tiverem DEFAULT no schema. `Partial` é permissivo; rotas devem
// validar com Zod antes de chamar `db.insert`.
export type InsertInput<T extends TableName> = Partial<Row<T>> & { id?: number };

// Input para UPDATE: id fora do payload (vai como argumento separado).
export type UpdateInput<T extends TableName> = Partial<Omit<Row<T>, 'id'>>;
