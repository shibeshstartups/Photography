import * as fs from "node:fs";
import * as path from "node:path";
import { app } from "electron";

const LOG_DIR = path.join(app.getPath("userData"), "logs");
let logStream: fs.WriteStream | null = null;

function ensureStream() {
  if (!logStream) {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `app-${new Date().toISOString().slice(0, 10)}.log`);
    logStream = fs.createWriteStream(file, { flags: "a" });
  }
  return logStream;
}

function format(level: string, msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} [${level}] ${msg}${metaStr}`;
}

export const logger = {
  info(msg: string, meta?: unknown) {
    const line = format("INFO", msg, meta);
    console.log(line);
    ensureStream().write(line + "\n");
  },
  warn(msg: string, meta?: unknown) {
    const line = format("WARN", msg, meta);
    console.warn(line);
    ensureStream().write(line + "\n");
  },
  error(msg: string, meta?: unknown) {
    const line = format("ERROR", msg, meta);
    console.error(line);
    ensureStream().write(line + "\n");
  },
  debug(msg: string, meta?: unknown) {
    const line = format("DEBUG", msg, meta);
    if (!app.isPackaged) console.debug(line);
    ensureStream().write(line + "\n");
  },
};