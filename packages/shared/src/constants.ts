/** Project statuses — configurable where appropriate. */
export const PROJECT_STATUSES = [
  "ENQUIRY",
  "QUOTATION_SENT",
  "BOOKED",
  "PLANNING",
  "CREW_PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "POST_PRODUCTION",
  "CLIENT_SELECTION",
  "REVISION",
  "APPROVAL_PENDING",
  "DELIVERY_PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Editing task workflow states. */
export const EDITING_TASK_STATUSES = [
  "WAITING_FOR_FILES",
  "FILES_RECEIVED",
  "EDITING",
  "INTERNAL_REVIEW",
  "REVISION_REQUIRED",
  "CLIENT_REVIEW",
  "APPROVED",
  "FINAL_EXPORT",
  "DELIVERED",
] as const;

export type EditingTaskStatus = (typeof EDITING_TASK_STATUSES)[number];

/** Default employee roles. */
export const EMPLOYEE_ROLES = [
  "Lead Photographer",
  "Candid Photographer",
  "Traditional Photographer",
  "Cinematographer",
  "Traditional Videographer",
  "Drone Operator",
  "Editor",
  "Album Designer",
  "Graphic Designer",
  "Project Manager",
  "Production Assistant",
  "Administrator",
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Default event segment services. */
export const SEGMENT_SERVICES = [
  "Traditional Photography",
  "Candid Photography",
  "Traditional Videography",
  "Cinematic Videography",
  "Drone",
  "Lighting",
  "Behind-the-scenes",
] as const;

export type SegmentService = (typeof SEGMENT_SERVICES)[number];

/** Permission keys for RBAC. */
export const PERMISSIONS = {
  // Clients
  CLIENTS_READ: "clients:read",
  CLIENTS_WRITE: "clients:write",
  // Projects
  PROJECTS_READ: "projects:read",
  PROJECTS_WRITE: "projects:write",
  PROJECTS_MANAGE: "projects:manage",
  // Events
  EVENTS_READ: "events:read",
  EVENTS_WRITE: "events:write",
  // Crew
  CREW_READ: "crew:read",
  CREW_WRITE: "crew:write",
  CREW_ASSIGN: "crew:assign",
  // Attendance
  ATTENDANCE_READ: "attendance:read",
  ATTENDANCE_WRITE: "attendance:write",
  // Editing
  EDITING_READ: "editing:read",
  EDITING_WRITE: "editing:write",
  // Finance
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",
  // Equipment
  EQUIPMENT_READ: "equipment:read",
  EQUIPMENT_WRITE: "equipment:write",
  // Reports
  REPORTS_READ: "reports:read",
  // Admin
  ADMIN: "admin",
  AUDIT_READ: "audit:read",
  DEVICE_MANAGE: "device:manage",
  // Client portal
  PORTAL_ACCESS: "portal:access",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Role → permissions mapping. */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Administrator: [
    "admin",
    "audit:read",
    "device:manage",
    "clients:read",
    "clients:write",
    "projects:read",
    "projects:write",
    "projects:manage",
    "events:read",
    "events:write",
    "crew:read",
    "crew:write",
    "crew:assign",
    "attendance:read",
    "attendance:write",
    "editing:read",
    "editing:write",
    "finance:read",
    "finance:write",
    "equipment:read",
    "equipment:write",
    "reports:read",
    "portal:access",
  ],
  "Project Manager": [
    "clients:read",
    "clients:write",
    "projects:read",
    "projects:write",
    "projects:manage",
    "events:read",
    "events:write",
    "crew:read",
    "crew:assign",
    "attendance:read",
    "attendance:write",
    "editing:read",
    "editing:write",
    "reports:read",
    "portal:access",
  ],
  Photographer: [
    "projects:read",
    "events:read",
    "crew:read",
    "attendance:read",
    "attendance:write",
    "editing:read",
    "reports:read",
  ],
  Editor: [
    "projects:read",
    "events:read",
    "editing:read",
    "editing:write",
    "reports:read",
  ],
  Videographer: [
    "projects:read",
    "events:read",
    "crew:read",
    "attendance:read",
    "attendance:write",
    "reports:read",
  ],
  "Production Assistant": [
    "projects:read",
    "events:read",
    "crew:read",
    "attendance:read",
    "attendance:write",
    "reports:read",
  ],
  Administrator: [
    "clients:read",
    "clients:write",
    "projects:read",
    "events:read",
    "crew:read",
    "attendance:read",
    "editing:read",
    "finance:read",
    "equipment:read",
    "reports:read",
    "portal:access",
  ],
};