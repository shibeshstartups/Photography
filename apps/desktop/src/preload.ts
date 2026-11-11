import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

// Type definitions for the API exposed to renderer
interface ElectronAPI {
  // App info
  getInfo(): Promise<{ version: string; platform: string; arch: string; isPackaged: boolean }>;
  openExternal(url: string): void;
  showItemInFolder(fullPath: string): void;
  selectDirectory(): Promise<string | null>;
  saveBackup(defaultName?: string): Promise<{ success: boolean; path?: string; error?: string }>;
  restoreBackup(backupPath: string): Promise<{ success: boolean; path?: string; error?: string }>;

  // Auth
  auth: {
    login(email: string, password: string): Promise<{ user: any; deviceId: string; token: string }>;
    register(data: { email: string; name: string; password: string }): Promise<{ user: any; deviceId: string; token: string }>;
    me(): Promise<any>;
    changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }>;
    listUsers(filters?: any): Promise<any>;
    updateUser(userId: string, data: any): Promise<{ success: boolean }>;
    deleteUser(userId: string): Promise<{ success: boolean }>;
  };

  // Projects
  projects: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    stats(id: string): Promise<any>;
  };

  // Clients
  clients: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    addContact(clientId: string, data: any): Promise<any>;
    updateContact(contactId: string, data: any): Promise<any>;
    deleteContact(contactId: string): Promise<{ success: boolean }>;
  };

  // Employees
  employees: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    addLeave(id: string, leave: any): Promise<{ success: boolean }>;
    updateAvailability(id: string, availability: any): Promise<{ success: boolean }>;
  };

  // Assignments
  assignments: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    confirm(id: string): Promise<{ success: boolean; validation: any }>;
    byDateRange(from: string, to: string): Promise<any[]>;
  };

  // Attendance
  attendance: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    checkIn(data: any): Promise<any>;
    bulkCheckIn(data: any): Promise<{ created: number; ids: string[] }>;
    correct(originalId: string, data: any): Promise<any>;
    eventSummary(eventId: string): Promise<any[]>;
    employeeSummary(employeeId: string, from: string, to: string): Promise<any[]>;
  };

  // Editing
  editing: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    updateStatus(id: string, status: string, comment?: string): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
  };

  // Finance
  finance: {
    listQuotations(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    listInvoices(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    listPayments(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    listExpenses(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    createQuotation(data: any): Promise<any>;
    createInvoice(data: any): Promise<any>;
    recordPayment(data: any): Promise<any>;
    createExpense(data: any): Promise<any>;
    quotations: {
      list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
      create(data: any): Promise<any>;
      update(id: string, data: any): Promise<{ success: boolean }>;
    };
    invoices: {
      list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
      create(data: any): Promise<any>;
      update(id: string, data: any): Promise<{ success: boolean }>;
    };
    payments: {
      list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
      create(data: any): Promise<any>;
    };
    expenses: {
      list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
      create(data: any): Promise<any>;
    };
    projectSummary(projectId: string): Promise<any>;
  };

  // Equipment
  equipment: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    checkout(equipmentId: string, data: any): Promise<any>;
    checkin(allocationId: string, data: any): Promise<any>;
    allocations: {
      list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    };
  };

  // Media
  media: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    storage: {
      list(): Promise<any[]>;
      create(data: any): Promise<any>;
      update(id: string, data: any): Promise<any>;
      delete(id: string): Promise<{ success: boolean }>;
    };
  };

  // Notifications
  notifications: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    unreadCount(): Promise<{ count: number }>;
    markRead(id: string): Promise<{ success: boolean }>;
    markAllRead(): Promise<{ success: boolean }>;
    create(data: any): Promise<any>;
    broadcast(data: any): Promise<{ created: number; ids: string[] }>;
    delete(id: string): Promise<{ success: boolean }>;
  };

  // Config
  config: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    get(key: string, scope?: string): Promise<any>;
    set(data: { key: string; value: any; type?: string; scope?: string; description?: string }): Promise<any>;
    delete(key: string, scope?: string): Promise<{ success: boolean }>;
    getAll(): Promise<Record<string, any>>;
  };

  // Audit
  audit: {
    list(filters?: any): Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>;
    entityTrail(entityType: string, entityId: string): Promise<any[]>;
    write(data: any): Promise<any>;
  };

  // Sync
  sync: {
    push(request: any): Promise<any>;
    pull(request: any): Promise<any>;
    status(deviceId: string): Promise<any>;
    resolveConflict(conflictId: string, resolution: "client" | "server" | "merged", mergedData?: any): Promise<{ success: boolean }>;
  };

  // Dashboard
  dashboard: {
    overview(): Promise<any>;
    projectStatusDistribution(): Promise<any[]>;
    revenueTrend(): Promise<any[]>;
    upcomingEvents(limit?: number): Promise<any[]>;
    recentActivity(limit?: number): Promise<any[]>;
    employeeWorkload(from: string, to: string): Promise<any[]>;
    equipmentUtilization(from: string, to: string): Promise<any[]>;
  };

  // Events
  on(channel: string, listener: (...args: any[]) => void): () => void;
  off(channel: string, listener: (...args: any[]) => void): void;
}

function invoke<T>(channel: string, ...args: any[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args);
}

function on(channel: string, listener: (...args: any[]) => void): () => void {
  const wrappedListener = (_event: IpcRendererEvent, ...args: any[]) => listener(...args);
  ipcRenderer.on(channel, wrappedListener);
  return () => ipcRenderer.off(channel, wrappedListener);
}

// Expose the API to the renderer
const electronAPI: ElectronAPI = {
  getInfo: () => invoke("app:info"),
  openExternal: (url) => ipcRenderer.send("app:open-external", url),
  showItemInFolder: (fullPath) => ipcRenderer.send("app:show-item-in-folder", fullPath),
  selectDirectory: () => invoke("app:directory-selected"),
  saveBackup: (defaultName) => invoke("app:backup-saved", defaultName),
  restoreBackup: (backupPath) => invoke("app:restored", backupPath),

  auth: {
    login: (email, password) => invoke("auth:login", email, password),
    register: (data) => invoke("auth:register", data),
    me: () => invoke("auth:me"),
    changePassword: (current, next) => invoke("auth:change-password", current, next),
    listUsers: (filters) => invoke("auth:list-users", filters),
    updateUser: (id, data) => invoke("auth:update-user", id, data),
    deleteUser: (userId) => invoke("auth:delete-user", userId),
  },

  projects: {
    list: (filters) => invoke("projects:list", filters),
    get: (id) => invoke("projects:get", id),
    create: (data) => invoke("projects:create", data),
    update: (id, data) => invoke("projects:update", id, data),
    delete: (id) => invoke("projects:delete", id),
    stats: (id) => invoke("projects:stats", id),
  },

  clients: {
    list: (filters) => invoke("clients:list", filters),
    get: (id) => invoke("clients:get", id),
    create: (data) => invoke("clients:create", data),
    update: (id, data) => invoke("clients:update", id, data),
    delete: (id) => invoke("clients:delete", id),
    addContact: (clientId, data) => invoke("clients:add-contact", clientId, data),
    updateContact: (contactId, data) => invoke("clients:update-contact", contactId, data),
    deleteContact: (contactId) => invoke("clients:delete-contact", contactId),
  },

  employees: {
    list: (filters) => invoke("employees:list", filters),
    get: (id) => invoke("employees:get", id),
    create: (data) => invoke("employees:create", data),
    update: (id, data) => invoke("employees:update", id, data),
    delete: (id) => invoke("employees:delete", id),
    addLeave: (id, leave) => invoke("employees:add-leave", id, leave),
    updateAvailability: (id, availability) => invoke("employees:update-availability", id, availability),
  },

  assignments: {
    list: (filters) => invoke("assignments:list", filters),
    get: (id) => invoke("assignments:get", id),
    create: (data) => invoke("assignments:create", data),
    update: (id, data) => invoke("assignments:update", id, data),
    delete: (id) => invoke("assignments:delete", id),
    confirm: (id) => invoke("assignments:confirm", id),
    byDateRange: (from, to) => invoke("assignments:by-date-range", from, to),
  },

  attendance: {
    list: (filters) => invoke("attendance:list", filters),
    checkIn: (data) => invoke("attendance:check-in", data),
    bulkCheckIn: (data) => invoke("attendance:bulk-check-in", data),
    correct: (originalId, data) => invoke("attendance:correct", originalId, data),
    eventSummary: (eventId) => invoke("attendance:event-summary", eventId),
    employeeSummary: (employeeId, from, to) => invoke("attendance:employee-summary", employeeId, from, to),
  },

  editing: {
    list: (filters) => invoke("editing:list", filters),
    get: (id) => invoke("editing:get", id),
    create: (data) => invoke("editing:create", data),
    update: (id, data) => invoke("editing:update", id, data),
    updateStatus: (id, status, comment) => invoke("editing:update-status", id, status, comment),
    delete: (id) => invoke("editing:delete", id),
  },

  finance: {
    listQuotations: (filters) => invoke("finance:quotations:list", filters),
    listInvoices: (filters) => invoke("finance:invoices:list", filters),
    listPayments: (filters) => invoke("finance:payments:list", filters),
    listExpenses: (filters) => invoke("finance:expenses:list", filters),
    createQuotation: (data) => invoke("finance:quotations:create", data),
    createInvoice: (data) => invoke("finance:invoices:create", data),
    recordPayment: (data) => invoke("finance:payments:create", data),
    createExpense: (data) => invoke("finance:expenses:create", data),
    quotations: {
      list: (filters) => invoke("finance:quotations:list", filters),
      create: (data) => invoke("finance:quotations:create", data),
      update: (id, data) => invoke("finance:quotations:update", id, data),
    },
    invoices: {
      list: (filters) => invoke("finance:invoices:list", filters),
      create: (data) => invoke("finance:invoices:create", data),
      update: (id, data) => invoke("finance:invoices:update", id, data),
    },
    payments: {
      list: (filters) => invoke("finance:payments:list", filters),
      create: (data) => invoke("finance:payments:create", data),
    },
    expenses: {
      list: (filters) => invoke("finance:expenses:list", filters),
      create: (data) => invoke("finance:expenses:create", data),
    },
    projectSummary: (projectId) => invoke("finance:project-summary", projectId),
  },

  equipment: {
    list: (filters) => invoke("equipment:list", filters),
    get: (id) => invoke("equipment:get", id),
    create: (data) => invoke("equipment:create", data),
    update: (id, data) => invoke("equipment:update", id, data),
    delete: (id) => invoke("equipment:delete", id),
    checkout: (equipmentId, data) => invoke("equipment:checkout", equipmentId, data),
    checkin: (allocationId, data) => invoke("equipment:checkin", allocationId, data),
    allocations: {
      list: (filters) => invoke("equipment:allocations:list", filters),
    },
  },

  media: {
    list: (filters) => invoke("media:list", filters),
    create: (data) => invoke("media:create", data),
    update: (id, data) => invoke("media:update", id, data),
    delete: (id) => invoke("media:delete", id),
    storage: {
      list: () => invoke("media:storage:list"),
      create: (data) => invoke("media:storage:create", data),
      update: (id, data) => invoke("media:storage:update", id, data),
      delete: (id) => invoke("media:storage:delete", id),
    },
  },

  notifications: {
    list: (filters) => invoke("notifications:list", filters),
    unreadCount: () => invoke("notifications:unread-count"),
    markRead: (id) => invoke("notifications:mark-read", id),
    markAllRead: () => invoke("notifications:mark-all-read"),
    create: (data) => invoke("notifications:create", data),
    broadcast: (data) => invoke("notifications:broadcast", data),
    delete: (id) => invoke("notifications:delete", id),
  },

  config: {
    list: (filters) => invoke("config:list", filters),
    get: (key, scope) => invoke("config:get", key, scope),
    set: (data) => invoke("config:set", data),
    delete: (key, scope) => invoke("config:delete", key, scope),
    getAll: () => invoke("config:get-all"),
  },

  audit: {
    list: (filters) => invoke("audit:list", filters),
    entityTrail: (entityType, entityId) => invoke("audit:entity-trail", entityType, entityId),
    write: (data) => invoke("audit:write", data),
  },

  sync: {
    push: (request) => invoke("sync:push", request),
    pull: (request) => invoke("sync:pull", request),
    status: (deviceId) => invoke("sync:status", deviceId),
    resolveConflict: (conflictId, resolution, mergedData) => invoke("sync:resolve-conflict", conflictId, resolution, mergedData),
  },

  dashboard: {
    overview: () => invoke("dashboard:overview"),
    projectStatusDistribution: () => invoke("dashboard:project-status-distribution"),
    revenueTrend: () => invoke("dashboard:revenue-trend"),
    upcomingEvents: (limit) => invoke("dashboard:upcoming-events", limit),
    recentActivity: (limit) => invoke("dashboard:recent-activity", limit),
    employeeWorkload: (from, to) => invoke("dashboard:employee-workload", from, to),
    equipmentUtilization: (from, to) => invoke("dashboard:equipment-utilization", from, to),
  },

  on,
  off,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type declaration for the renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}