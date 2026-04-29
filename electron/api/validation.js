// Schemas Zod para validação de entrada das rotas Express.
// Runtime: valida + coerce antes de chegar ao banco (evita bugs string×number).
// Tipos: consumers TS podem usar `z.infer<typeof SchemaName>` para inferência.
const { z } = require('zod');

// Helper: aceita número OU string numérica e converte. Usado para campos que
// vêm do `req.body` onde o frontend pode enviar string ("5") ou number (5).
const numericInt = z.coerce.number().int();
const numericPositiveInt = z.coerce.number().int().positive();
const numericNonNegative = z.coerce.number().nonnegative();
const numericPositive = z.coerce.number().positive();

// ─────────────────────────────────────────────────────────────────────────────
// Vendas
// ─────────────────────────────────────────────────────────────────────────────

const VendaItemSchema = z.object({
  produto_id: numericPositiveInt,
  estoque_id: numericPositiveInt,
  quantidade: numericPositiveInt,
  preco_unitario: numericNonNegative,
  desconto_item: numericNonNegative.optional().default(0)
});

const VendaCreateSchema = z.object({
  cliente_id: numericPositiveInt.nullable().optional(),
  usuario_id: numericPositiveInt,
  vendedor_id: numericPositiveInt.nullable().optional(),
  forma_pagamento: z.string().min(1),
  parcelas: numericPositiveInt.nullable().optional(),
  desconto: numericNonNegative.optional().default(0),
  itens: z.array(VendaItemSchema).min(1)
});

const VendaUpdateSchema = z.object({
  forma_pagamento: z.string().optional(),
  status: z.enum(['finalizada', 'cancelada']).optional(),
  usuario_id: numericPositiveInt.optional(),
  motivo_cancelamento: z.string().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Produtos
// ─────────────────────────────────────────────────────────────────────────────

// Campos fiscais (Fase 1 NFC-e). Aceitam string vazia ou null para "não
// preenchido"; quando vier conteúdo, valida o formato. NCM/CEST/CFOP têm
// tamanhos fixos definidos pela SEFAZ; CSOSN é whitelist do Simples Nacional.
const optionalDigits = (n) =>
  z.string()
    .nullable()
    .optional()
    .refine(
      v => v == null || v === '' || new RegExp(`^\\d{${n}}$`).test(v),
      { message: `deve ter ${n} dígitos numéricos` }
    );

const CSOSN_VALIDOS = ['101','102','103','201','202','203','300','400','500','900'];
const optionalCsosn = z.string().nullable().optional().refine(
  v => v == null || v === '' || CSOSN_VALIDOS.includes(v),
  { message: `CSOSN inválido (use ${CSOSN_VALIDOS.join(', ')})` }
);

const ProdutoFiscalFields = {
  ncm: optionalDigits(8),
  cest: optionalDigits(7),
  cfop: optionalDigits(4),
  origem_mercadoria: z.coerce.number().int().min(0).max(8).nullable().optional(),
  csosn: optionalCsosn,
  unidade_comercial: z.string().nullable().optional(),
  pis_cst: optionalDigits(2),
  cofins_cst: optionalDigits(2)
};

const ProdutoCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().nullable().optional(),
  preco_custo: numericNonNegative.optional().default(0),
  preco_venda: numericNonNegative.optional().default(0),
  categoria_id: numericPositiveInt.nullable().optional(),
  codigo_barras: z.string().nullable().optional(),
  num_variacoes: numericPositiveInt.optional().default(1),
  usuario_id: numericPositiveInt.nullable().optional(),
  ...ProdutoFiscalFields
});

const ProdutoUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().nullable().optional(),
  preco_custo: numericNonNegative.optional(),
  preco_venda: numericNonNegative.optional(),
  categoria_id: numericPositiveInt.nullable().optional(),
  codigo_barras: z.string().nullable().optional(),
  ativo: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
  usuario_id: numericPositiveInt.optional(),
  ...ProdutoFiscalFields
});

// ─────────────────────────────────────────────────────────────────────────────
// Estoque
// ─────────────────────────────────────────────────────────────────────────────

const EstoqueMovimentacaoSchema = z.object({
  estoque_id: numericPositiveInt,
  tipo: z.enum(['entrada', 'saida', 'ajuste']),
  quantidade: numericInt,  // ajuste pode ser negativo/zero
  motivo: z.string().nullable().optional(),
  usuario_id: numericPositiveInt.nullable().optional()
});

const EstoqueCreateSchema = z.object({
  produto_id: numericPositiveInt,
  tamanho: z.string().nullable().optional().default(''),
  cor: z.string().nullable().optional().default(''),
  quantidade: numericNonNegative.optional().default(0),
  minimo: numericNonNegative.optional().default(5),
  codigo_barras: z.string().nullable().optional()
});

const EstoqueUpdateSchema = z.object({
  quantidade: numericNonNegative.optional(),
  minimo: numericNonNegative.optional(),
  tamanho: z.string().nullable().optional(),
  cor: z.string().nullable().optional(),
  codigo_barras: z.string().nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Trocas
// ─────────────────────────────────────────────────────────────────────────────

const TrocaCreateSchema = z.object({
  venda_id: numericPositiveInt.nullable().optional(),
  produto_id: numericPositiveInt,
  estoque_id: numericPositiveInt.nullable().optional(),
  quantidade: numericPositiveInt.optional().default(1),
  motivo: z.string().min(1),
  tipo: z.enum(['troca', 'devolucao']).optional().default('troca'),
  novo_produto_id: numericPositiveInt.nullable().optional(),
  novo_estoque_id: numericPositiveInt.nullable().optional(),
  observacao: z.string().nullable().optional(),
  usuario_id: numericPositiveInt.nullable().optional()
});

const TrocaUpdateSchema = z.object({
  status: z.enum(['pendente', 'concluida', 'recusada']).optional(),
  observacao: z.string().nullable().optional(),
  novo_estoque_id: numericPositiveInt.nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Fiado
// ─────────────────────────────────────────────────────────────────────────────

const FiadoPagamentoSchema = z.object({
  venda_id: numericPositiveInt,
  cliente_id: numericPositiveInt.nullable().optional(),
  valor: numericPositive,
  forma_pagamento: z.string().min(1).optional().default('dinheiro'),
  usuario_id: numericPositiveInt.nullable().optional(),
  observacao: z.string().nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Caixa
// ─────────────────────────────────────────────────────────────────────────────

const CaixaAberturaSchema = z.object({
  usuario_id: numericPositiveInt,
  valor_inicial: numericNonNegative.optional().default(0),
  observacao: z.string().nullable().optional()
});

const CaixaFechamentoSchema = z.object({
  usuario_id: numericPositiveInt.nullable().optional(),
  valor_final: numericNonNegative.optional(),
  observacao: z.string().nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Clientes
// ─────────────────────────────────────────────────────────────────────────────

const ClienteCreateSchema = z.object({
  nome: z.string().min(1),
  cpf: z.string().nullable().optional().default(''),
  telefone: z.string().nullable().optional().default(''),
  email: z.string().nullable().optional().default(''),
  endereco: z.string().nullable().optional().default(''),
  criado_por_usuario_id: numericPositiveInt.nullable().optional()
});

const ClienteUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  cpf: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  endereco: z.string().nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Categorias
// ─────────────────────────────────────────────────────────────────────────────

const CategoriaCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().nullable().optional().default('')
});

const CategoriaUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Despesas
// ─────────────────────────────────────────────────────────────────────────────

const DespesaCategoriaCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().nullable().optional().default('')
});

const DespesaCategoriaUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().nullable().optional()
});

const DespesaCreateSchema = z.object({
  descricao: z.string().min(1),
  valor: numericNonNegative.optional().default(0),
  categoria_id: numericPositiveInt.nullable().optional(),
  recorrencia: z.string().nullable().optional().default('nenhuma'),
  vencimento: z.string().nullable().optional()
});

const DespesaUpdateSchema = z.object({
  descricao: z.string().min(1).optional(),
  valor: numericNonNegative.optional(),
  categoria_id: numericPositiveInt.nullable().optional(),
  recorrencia: z.string().nullable().optional(),
  vencimento: z.string().nullable().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Usuários
// ─────────────────────────────────────────────────────────────────────────────

const UsuarioCreateSchema = z.object({
  nome: z.string().min(1),
  login: z.string().min(1),
  senha: z.string().min(1),
  cargo: z.string().nullable().optional().default('caixa'),
  comissao: numericNonNegative.optional().default(0)
});

const UsuarioUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  login: z.string().min(1).optional(),
  senha: z.string().optional(),
  cargo: z.string().nullable().optional(),
  comissao: numericNonNegative.optional(),
  ativo: z.union([z.literal(0), z.literal(1), z.boolean()]).optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// Configurações — aceita dicionário flexível chave→string. Chaves são livres
// porque o frontend adiciona configs novas (tema, impressora, taxas) sem
// migrations. Só valida que o payload é objeto com valores string-coercíveis.
// ─────────────────────────────────────────────────────────────────────────────

const ConfiguracoesPutSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .refine(obj => Object.keys(obj).length > 0, 'Payload vazio');

// ─────────────────────────────────────────────────────────────────────────────
// Helper de middleware: aplica schema em `req.body`, responde 400 se falhar.
// Substitui req.body pelos dados parseados/coagidos para uso no handler.
// ─────────────────────────────────────────────────────────────────────────────

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first.path.join('.');
      return res.status(400).json({
        error: field ? `${field}: ${first.message}` : first.message,
        issues: parsed.error.issues
      });
    }
    req.body = parsed.data;
    next();
  };
}

module.exports = {
  validate,
  VendaItemSchema,
  VendaCreateSchema,
  VendaUpdateSchema,
  ProdutoCreateSchema,
  ProdutoUpdateSchema,
  EstoqueMovimentacaoSchema,
  EstoqueCreateSchema,
  EstoqueUpdateSchema,
  TrocaCreateSchema,
  TrocaUpdateSchema,
  FiadoPagamentoSchema,
  CaixaAberturaSchema,
  CaixaFechamentoSchema,
  ClienteCreateSchema,
  ClienteUpdateSchema,
  CategoriaCreateSchema,
  CategoriaUpdateSchema,
  DespesaCategoriaCreateSchema,
  DespesaCategoriaUpdateSchema,
  DespesaCreateSchema,
  DespesaUpdateSchema,
  UsuarioCreateSchema,
  UsuarioUpdateSchema,
  ConfiguracoesPutSchema
};
