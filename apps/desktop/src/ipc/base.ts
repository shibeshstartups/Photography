import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Database } from "../db.js";
import { logger } from "../logger.js";

export type HandlerFn<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TResult>;

export function createHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: HandlerFn<TArgs, TResult>,
  db: Database
) {
  ipcMain.handle(channel, async (event, ...args: TArgs) => {
    const start = Date.now();
    try {
      const result = await handler(event, ...args);
      logger.debug(`IPC ${channel} completed`, { durationMs: Date.now() - start });
      return result;
    } catch (error) {
      logger.error(`IPC ${channel} failed`, { error: (error as Error).message, durationMs: Date.now() - start });
      throw error;
    }
  });
}

export function createSyncHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: HandlerFn<TArgs, TResult>,
  db: Database
) {
  ipcMain.on(channel, async (event, ...args: TArgs) => {
    const start = Date.now();
    try {
      const result = await handler(event, ...args);
      event.reply(`${channel}:result`, result);
      logger.debug(`IPC ${channel} (sync) completed`, { durationMs: Date.now() - start });
    } catch (error) {
      logger.error(`IPC ${channel} (sync) failed`, { error: (error as Error).message, durationMs: Date.now() - start });
      event.reply(`${channel}:error`, (error as Error).message);
    }
  });
}

export function requireAuth(event: IpcMainInvokeEvent): { userId: string; deviceId: string } {
  // In a real app, this would validate session/token
  // For now, we'll use a simple approach - the renderer sends user/device info
  const sender = event.sender;
  // This is a placeholder - actual auth would come from a session store
  return { userId: "current-user", deviceId: "current-device" };
}