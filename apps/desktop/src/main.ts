import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { Database } from "./db.js";
import { registerAuthHandlers } from "./ipc/auth.js";
import { registerProjectHandlers } from "./ipc/projects.js";
import { registerClientHandlers } from "./ipc/clients.js";
import { registerEmployeeHandlers } from "./ipc/employees.js";
import { registerAssignmentHandlers } from "./ipc/assignments.js";
import { registerAttendanceHandlers } from "./ipc/attendance.js";
import { registerEventHandlers } from "./ipc/events.js";
import { registerEditingHandlers } from "./ipc/editing.js";
import { registerFinanceHandlers } from "./ipc/finance.js";
import { registerEquipmentHandlers } from "./ipc/equipment.js";
import { registerDashboardHandlers } from "./ipc/dashboard.js";
import { registerNotificationHandlers } from "./ipc/notifications.js";
import { registerMediaHandlers } from "./ipc/media.js";
import { registerConfigHandlers } from "./ipc/config.js";
import { registerAuditHandlers } from "./ipc/audit.js";
import { registerSyncHandlers } from "./ipc/sync.js";
import { logger } from "./logger.js";

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "Studio ERP",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 16 },
  });

  Menu.setApplicationMenu(null);

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (!app.isPackaged) mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  const dbPath = path.join(userData, "studio-erp.db");
  db = new Database(dbPath);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  registerIpcHandlers();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  try {
    db?.close();
    logger.info("Database closed cleanly");
  } catch (e) {
    logger.error("Error closing database", e);
  }
});

function registerIpcHandlers() {
  if (!db) throw new Error("Database not initialized");
  registerAuthHandlers(ipcMain, db);
  registerProjectHandlers(ipcMain, db);
  registerClientHandlers(ipcMain, db);
  registerEmployeeHandlers(ipcMain, db);
  registerAssignmentHandlers(ipcMain, db);
  registerAttendanceHandlers(ipcMain, db);
  registerEventHandlers(ipcMain, db);
  registerEditingHandlers(ipcMain, db);
  registerFinanceHandlers(ipcMain, db);
  registerEquipmentHandlers(ipcMain, db);
  registerDashboardHandlers(ipcMain, db);
  registerNotificationHandlers(ipcMain, db);
  registerMediaHandlers(ipcMain, db);
  registerConfigHandlers(ipcMain, db);
  registerAuditHandlers(ipcMain, db);
  registerSyncHandlers(ipcMain, db);

  ipcMain.on("app:get-info", (e) => {
    e.reply("app:info", {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    });
  });

  ipcMain.on("app:open-external", (e, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.on("app:show-item-in-folder", (e, fullPath: string) => {
    shell.showItemInFolder(fullPath);
  });

  ipcMain.on("app:select-directory", async (e) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    });
    e.reply("app:directory-selected", result.canceled ? null : result.filePaths[0]);
  });

  ipcMain.on("app:save-backup", async (e, defaultName: string) => {
    const userData = app.getPath("userData");
    const dbPath = path.join(userData, "studio-erp.db");
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: "Export Backup",
      defaultPath: defaultName || "studio-erp-backup.db",
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    });
    if (canceled || !filePath) {
      e.reply("app:backup-cancelled");
      return;
    }
    try {
      fs.copyFileSync(dbPath, filePath);
      e.reply("app:backup-saved", filePath);
    } catch (err) {
      e.reply("app:backup-error", (err as Error).message);
    }
  });

  ipcMain.on("app:restore-backup", async (e, backupPath: string) => {
    const userData = app.getPath("userData");
    const dbPath = path.join(userData, "studio-erp.db");
    const { canceled, filePath } = await dialog.showOpenDialog(mainWindow!, {
      title: "Restore Backup",
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
      defaultPath: backupPath,
      properties: ["openFile"],
    });
    if (canceled || !filePath) {
      e.reply("app:restore-cancelled");
      return;
    }
    try {
      // Close current DB, replace, reopen
      db?.close();
      fs.copyFileSync(filePath, dbPath);
      db = new Database(dbPath);
      e.reply("app:restored", dbPath);
    } catch (err) {
      e.reply("app:restore-error", (err as Error).message);
    }
  });
}

export { db };