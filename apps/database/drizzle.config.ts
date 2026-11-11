import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "better-sqlite3",
  dbCredentials: {
    url: "file:./studio-erp.db",
  },
} satisfies Config;