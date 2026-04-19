import type { Produto } from '@shared/types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface ProdutoComCategoria extends Produto {
  categoria_nome: string | null;
}

export interface ProdutoCreateInput {
  nome: string;
  descricao?: string | null;
  preco_custo?: number;
  preco_venda?: number;
  categoria_id?: number | null;
  codigo_barras?: string | null;
  num_variacoes?: number;
  usuario_id?: number | null;
}

export interface ProdutoUpdateInput {
  nome?: string;
  descricao?: string | null;
  preco_custo?: number;
  preco_venda?: number;
  categoria_id?: number | null;
  codigo_barras?: string | null;
  ativo?: 0 | 1 | boolean;
  usuario_id?: number;
}

export interface ProdutoCreateResult {
  ids: number[];
  count: number;
  nome: string;
}

export function listProdutos(): Promise<ProdutoComCategoria[]> {
  return apiGet<ProdutoComCategoria[]>('/api/produtos');
}

export function buscarProdutos(q: string): Promise<ProdutoComCategoria[]> {
  return apiGet<ProdutoComCategoria[]>(`/api/produtos/buscar?q=${encodeURIComponent(q)}`);
}

export function getProduto(id: number): Promise<ProdutoComCategoria> {
  return apiGet<ProdutoComCategoria>(`/api/produtos/${id}`);
}

export function createProduto(input: ProdutoCreateInput): Promise<ProdutoCreateResult> {
  return apiPost<ProdutoCreateResult>('/api/produtos', input);
}

export function updateProduto(id: number, input: ProdutoUpdateInput): Promise<unknown> {
  return apiPut(`/api/produtos/${id}`, input);
}

export function deleteProduto(id: number, usuario_id?: number): Promise<unknown> {
  return apiDelete(`/api/produtos/${id}`, usuario_id ? { usuario_id } : undefined);
}
