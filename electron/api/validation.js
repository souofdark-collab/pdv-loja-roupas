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

const ProdutoCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().nullable().optional(),
  preco_custo: numericNonNegative.optional().default(0),
  preco_venda: numericNonNegative.optional().default(0),
  categoria_id: numericPositiveInt.nullable().optional(),
  codigo_barras: z.string().nullable().optional(),
  num_variacoes: numericPositiveInt.optional().default(1),
  usuario_id: numericPositiveInt.nullable().optional()
});

const ProdutoUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().nullable().optional(),
  preco_custo: numericNonNegative.optional(),
  preco_venda: numericNonNegative.optional(),
  categoria_id: numericPositiveInt.nullable().optional(),
  codigo_barras: z.string().nullable().optional(),
  ativo: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
  usuario_id: numericPositiveInt.optional()
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
  valor_final: numericNonNegative,
  observacao: z.string().nullable().optional()
});

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
  FiadoPagamentoSchema,
  CaixaAberturaSchema,
  CaixaFechamentoSchema
};
