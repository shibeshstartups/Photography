import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger.js";

export class LocalDatabase {
  private db: Database.Database;
  private closed = false;

  constructor(private dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath, {
      verbose: process.env.DEBUG ? (message?: unknown, ...additionalArgs: unknown[]) => logger.debug(message as string, ...additionalArgs) : undefined,
    });
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("synchronous = NORMAL");

    this.runMigrations();
    logger.info("Database opened", { path: dbPath });
  }

  private runMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const applied = new Set(
      this.db.prepare("SELECT id FROM _migrations").all().map((r: any) => r.id)
    );

    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir).sort();
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES (?, datetime('now'))"
    );
    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      const id = file.replace(/\.sql$/, "");
      if (applied.has(id)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const run = this.db.transaction(() => {
        this.db.exec(sql);
        insert.run(id);
      });
      run();
      logger.info("Applied migration", { id });
    }
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
    logger.info("Database closed");
  }

  /** Run a write and return the last inserted row id + changes. */
  run(sql: string, params: unknown[] = []) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }

  /** Get a single row. Rows come from raw SQL, so the shape is caller-provided. */
  get<T>(sql: string, params: unknown[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  /** Get all rows. Rows come from raw SQL, so the shape is caller-provided. */
  all<T>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }
}

export type Database = LocalDatabase;