// Database package exports - Drizzle ORM schema and utilities
export { schema, type Schema } from "./schema.js";
export { createDatabase, type Database } from "./db.js";
export { users, devices, clients, clientContacts, employees, projects, events, eventSegments, assignments, attendance, editingTasks, quotations, invoices, payments, expenses, equipment, equipmentAllocations, storageLocations, mediaReferences, notifications, auditLogs, systemConfig, syncCheckpoints, syncOutbox, syncConflicts, usersRelations, devicesRelations, clientsRelations, clientContactsRelations, employeesRelations, projectsRelations, eventsRelations, eventSegmentsRelations, assignmentsRelations, attendanceRelations, editingTasksRelations, quotationsRelations, invoicesRelations, paymentsRelations, expensesRelations, equipmentRelations, equipmentAllocationsRelations, storageLocationsRelations, mediaReferencesRelations, notificationsRelations, auditLogsRelations, syncCheckpointsRelations, syncOutboxRelations, syncConflictsRelations } from "./schema.js";

// Export manually-defined types (snake_case rows + camelCase inputs)
export type {
  User, NewUser, Device, NewDevice, Client, NewClient, ClientContact, NewClientContact,
  Employee, NewEmployee, Project, NewProject, Event, NewEvent, EventSegment, NewEventSegment,
  Assignment, NewAssignment, AttendanceEvent, NewAttendanceEvent, EditingTask, NewEditingTask,
  Quotation, NewQuotation, Invoice, NewInvoice, Payment, NewPayment, Expense, NewExpense,
  Equipment, NewEquipment, EquipmentAllocation, NewEquipmentAllocation, StorageLocation, NewStorageLocation,
  MediaReference, NewMediaReference, Notification, NewNotification, AuditLog, NewAuditLog,
  SystemConfig, NewSystemConfig, SyncCheckpoint, NewSyncCheckpoint, SyncOutbox, NewSyncOutbox,
  SyncConflict, NewSyncConflict,
} from "./types.js";

// Re-export drizzle-orm for convenience
export { eq, and, or, not, gt, gte, lt, lte, like, ilike, inArray, isNull, isNotNull, desc, asc, sql, count, sum, avg, min, max } from "drizzle-orm";
export type { SQL, SQLWrapper } from "drizzle-orm";