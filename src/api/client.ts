// Wrappers tipados sobre `window.api` (exposto via electron/preload.js).
// Componentes podem importar daqui ao invés de `window.api.*` diretamente para
// ganhar tipagem de entrada/saída via `@shared/types`.

export interface ApiError extends Error {
  status?: number;
}

interface WindowApi {
  get<T = unknown>(url: string): Promise<T>;
  post<T = unknown>(url: string, body: unknown): Promise<T>;
  put<T = unknown>(url: string, body: unknown): Promise<T>;
  delete<T = unknown>(url: string, body?: unknown): Promise<T>;
}

declare global {
  interface Window {
    api: WindowApi;
    electron: {
      print(content: unknown): Promise<{ success: boolean }>;
      getPrinters(): Promise<Array<{ name: string; isDefault?: boolean; displayName?: string }>>;
      printReceipt(
        html: string,
        printerName?: string
      ): Promise<{ success: boolean; reason?: string }>;
    };
  }
}

function api(): WindowApi {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('window.api não disponível — este código precisa rodar dentro do Electron.');
  }
  return window.api;
}

export function apiGet<T = unknown>(url: string): Promise<T> {
  return api().get<T>(url);
}

export function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  return api().post<T>(url, body);
}

export function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
  return api().put<T>(url, body);
}

export function apiDelete<T = unknown>(url: string, body?: unknown): Promise<T> {
  return api().delete<T>(url, body);
}
