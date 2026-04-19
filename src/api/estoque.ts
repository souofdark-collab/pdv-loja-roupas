import type { Estoque, EstoqueMovimentacao, EstoqueMovimentacaoTipo } from '@shared/types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface EstoqueItem extends Estoque {
  produto_nome: string;
  codigo_barras_produto: string | null;
}

export interface EstoqueMovimentacaoInput {
  estoque_id: number;
  tipo: EstoqueMovimentacaoTipo;
  quantidade: number;
  motivo?: string | null;
  usuario_id?: number | null;
}

export function listEstoque(): Promise<EstoqueItem[]> {
  return apiGet<EstoqueItem[]>('/api/estoque');
}

export function estoqueBaixo(): Promise<EstoqueItem[]> {
  return apiGet<EstoqueItem[]>('/api/estoque/baixo');
}

export function updateEstoque(
  id: number,
  patch: Partial<Pick<Estoque, 'quantidade' | 'minimo' | 'tamanho' | 'cor' | 'codigo_barras'>>
): Promise<Estoque> {
  return apiPut<Estoque>(`/api/estoque/${id}`, patch);
}

export function deleteEstoque(id: number): Promise<unknown> {
  return apiDelete(`/api/estoque/${id}`);
}

export function movimentarEstoque(input: EstoqueMovimentacaoInput): Promise<unknown> {
  return apiPost('/api/estoque/movimentacao', input);
}

export function listMovimentacoes(estoqueId?: number): Promise<EstoqueMovimentacao[]> {
  const q = estoqueId !== undefined ? `?estoque_id=${estoqueId}` : '';
  return apiGet<EstoqueMovimentacao[]>(`/api/estoque/movimentacoes${q}`);
}
