import type {
  Venda,
  VendaItem,
  VendaStatus,
  FormaPagamento
} from '@shared/types';
import { apiGet, apiPost, apiPut } from './client';

// Venda com campos enriquecidos pelos joins feitos em electron/api/routes/vendas.js.
export interface VendaComDetalhes extends Venda {
  cliente_nome: string | null;
  usuario_nome: string;
  vendedor_nome: string;
  itens?: Array<VendaItem & { produto_nome: string }>;
}

// Item enviado pelo PDV ao criar uma venda. Validado server-side por
// VendaCreateSchema (Zod) — string×number é coerced automaticamente.
export interface VendaItemInput {
  produto_id: number;
  estoque_id: number;
  quantidade: number;
  preco_unitario: number;
  desconto_item?: number;
}

export interface VendaCreateInput {
  cliente_id?: number | null;
  usuario_id: number;
  vendedor_id?: number | null;
  forma_pagamento: FormaPagamento;
  parcelas?: number | null;
  desconto?: number;
  itens: VendaItemInput[];
}

export interface VendaUpdateInput {
  forma_pagamento?: FormaPagamento;
  status?: VendaStatus;
  usuario_id?: number;
  motivo_cancelamento?: string;
}

export function listVendas(params?: { inicio?: string; fim?: string }): Promise<VendaComDetalhes[]> {
  const q = params?.inicio && params?.fim ? `?inicio=${params.inicio}&fim=${params.fim}` : '';
  return apiGet<VendaComDetalhes[]>(`/api/vendas${q}`);
}

export function getVenda(id: number): Promise<VendaComDetalhes> {
  return apiGet<VendaComDetalhes>(`/api/vendas/${id}`);
}

export function createVenda(input: VendaCreateInput): Promise<VendaComDetalhes> {
  return apiPost<VendaComDetalhes>('/api/vendas', input);
}

export function updateVenda(id: number, input: VendaUpdateInput): Promise<unknown> {
  return apiPut(`/api/vendas/${id}`, input);
}
