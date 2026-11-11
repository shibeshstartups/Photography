/**
 * Database client wrapper.
 *
 * Supports two backends:
 * - Local: better-sqlite3 (Electron / CLI)
 * - Cloud: Cloudflare D1 (via fetch API in Workers)
 *
 * The interface is intentionally minimal so the same repositories can run
 * against either backend.
 */
import * as schema from "./schema/index.js";

export type Database = typeof schema;

export interface QueryClient {
  select(): any;
  insert(table: any): any;
  update(table: any): any;
  delete(table: any): any;
  run(sql: string, params?: unknown[]): any;
  all(sql: string, params?: unknown[]): any[];
  get<T>(sql: string, params?: unknown[]): T | undefined;
  transaction<T>(fn: (tx: QueryClient) => T): T;
  close(): void;
}

export { schema };