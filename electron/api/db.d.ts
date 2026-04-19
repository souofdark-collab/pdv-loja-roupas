// Types for db.js (CommonJS). TS picks this up automatically when importing
// './db' from a .ts file. Runtime remains untyped JS — we just describe the
// public surface here.

import type { Database } from 'better-sqlite3';
import type { TableName, Row, InsertInput, UpdateInput } from '../../shared/types';

export interface InsertResult {
  lastInsertRowid: number;
}

export interface AuditChainResult {
  ok: boolean;
  broken: Array<{ id: number; expected: string; actual: string }>;
  total: number;
}

export interface DataProxy {
  [key: string]: unknown[];
}

export interface Db {
  /** Handle raw do better-sqlite3. Use apenas para SQL direto em casos especiais. */
  _sqlite: Database;

  /** Proxy sobre as tabelas. Getter retorna SELECT *; setter faz DELETE+INSERT atômico. */
  _data: DataProxy;

  /** No-op — SQLite persiste sincronamente. Mantido por compat. */
  _save(): void;

  /** Executado automaticamente no require. Chamar de novo é idempotente. */
  init(): void;

  select<T extends TableName>(table: T, where?: Partial<Row<T>>): Array<Row<T>>;

  findOne<T extends TableName>(table: T, where?: Partial<Row<T>>): Row<T> | null;

  insert<T extends TableName>(table: T, data: InsertInput<T>): InsertResult;

  update<T extends TableName>(table: T, id: number, data: UpdateInput<T>): boolean;

  delete<T extends TableName>(table: T, id: number): void;

  /** Envelopa fn em transação SQLite. Retorna função chamável que executa a transação. */
  transaction<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;

  /** Online backup via sqlite.backup(). Seguro durante escrita. */
  backupTo(destPath: string): Promise<{ totalPages: number; remainingPages: number }>;

  /** Valida cadeia SHA256 em log_acoes por id ASC. */
  verifyAuditChain(): AuditChainResult;
}

declare const db: Db;
export = db;
