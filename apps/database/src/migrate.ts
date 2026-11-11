// Database migration runner - applies SQL migrations from desktop app
import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "desktop", "src", "migrations");

export function runMigrations(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  // Create migrations tracking table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    sqlite.prepare("SELECT id FROM _migrations").all().map((r: any) => r.id)
  );

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log("No migrations directory found:", MIGRATIONS_DIR);
    sqlite.close();
    return;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR).sort();
  const insert = sqlite.prepare(
    "INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES (?, datetime('now'))"
  );

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    const id = file.replace(/\.sql$/, "");
    if (applied.has(id)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const run = sqlite.transaction(() => {
      sqlite.exec(sql);
      insert.run(id);
    });
    run();
    console.log("Applied migration:", id);
  }

  sqlite.close();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || path.join(process.cwd(), "studio-erp.db");
  runMigrations(dbPath);
  console.log("Migrations complete");
}