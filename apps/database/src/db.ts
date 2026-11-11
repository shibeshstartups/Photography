// Database connection using Drizzle ORM with better-sqlite3
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import * as schema from "./schema.js";

export function createDatabase(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath, {
    verbose: process.env.DEBUG ? (message?: unknown, ...additionalArgs: unknown[]) => console.debug(message, ...additionalArgs) : undefined,
  });

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof createDatabase>;