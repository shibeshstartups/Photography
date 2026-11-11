-- Initial schema for Photography Studio ERP
-- This creates all tables matching the Drizzle schema in packages/database

PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS studio_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_users_email ON studio_users(email);
CREATE INDEX IF NOT EXISTS idx_studio_users_status ON studio_users(status);

-- Devices
CREATE TABLE IF NOT EXISTS studio_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES studio_users(id),
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    device_key_hash TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_devices_user ON studio_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_devices_revoked ON studio_devices(revoked);

-- Clients
CREATE TABLE IF NOT EXISTS studio_clients (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    additional_info TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_clients_client_id ON studio_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_studio_clients_name ON studio_clients(full_name);

-- Client Contacts
CREATE TABLE IF NOT EXISTS studio_client_contacts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES studio_clients(id),
    name TEXT NOT NULL,
    relationship TEXT,
    phone TEXT,
    email TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_client_contacts_client ON studio_client_contacts(client_id);

-- Employees
CREATE TABLE IF NOT EXISTS studio_employees (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    designation TEXT,
    skills TEXT NOT NULL DEFAULT '[]',
    specializations TEXT NOT NULL DEFAULT '[]',
    experience REAL,
    status TEXT NOT NULL DEFAULT 'active',
    compensation TEXT,
    availability TEXT,
    leaves TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_employees_employee_id ON studio_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_studio_employees_status ON studio_employees(status);

-- Projects
CREATE TABLE IF NOT EXISTS studio_projects (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES studio_clients(id),
    title TEXT NOT NULL,
    project_manager_id TEXT REFERENCES studio_employees(id),
    booking_date TEXT,
    status TEXT NOT NULL DEFAULT 'ENQUIRY',
    quotation TEXT,
    total_agreed_amount REAL NOT NULL DEFAULT 0,
    advance_payment REAL NOT NULL DEFAULT 0,
    venue TEXT,
    locations TEXT,
    internal_notes TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_projects_project_id ON studio_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_client ON studio_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_status ON studio_projects(status);
CREATE INDEX IF NOT EXISTS idx_studio_projects_booking_date ON studio_projects(booking_date);

-- Events
CREATE TABLE IF NOT EXISTS studio_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES studio_projects(id),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    venue TEXT,
    city TEXT,
    location TEXT,
    travel TEXT,
    event_manager_id TEXT REFERENCES studio_employees(id),
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_events_project ON studio_events(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_events_date ON studio_events(event_date);
CREATE INDEX IF NOT EXISTS idx_studio_events_event_id ON studio_events(event_id);

-- Event Segments
CREATE TABLE IF NOT EXISTS studio_event_segments (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES studio_events(id),
    service TEXT NOT NULL,
    required_count INTEGER NOT NULL DEFAULT 1,
    assigned_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_event_segments_event ON studio_event_segments(event_id);

-- Assignments
CREATE TABLE IF NOT EXISTS studio_assignments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES studio_projects(id),
    event_id TEXT REFERENCES studio_events(id),
    segment_id TEXT REFERENCES studio_event_segments(id),
    employee_id TEXT NOT NULL REFERENCES studio_employees(id),
    assignment_date TEXT NOT NULL,
    time_window TEXT,
    status TEXT NOT NULL DEFAULT 'pending_validation',
    is_provisional INTEGER NOT NULL DEFAULT 1,
    validation TEXT,
    conflicts TEXT,
    logistics TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_assignments_project ON studio_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_assignments_event ON studio_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_studio_assignments_employee ON studio_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_studio_assignments_date ON studio_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_studio_assignments_status ON studio_assignments(status);

-- Attendance Events (append-only)
CREATE TABLE IF NOT EXISTS studio_attendance_events (
    id TEXT PRIMARY KEY,
    assignment_id TEXT REFERENCES studio_assignments(id),
    event_id TEXT REFERENCES studio_events(id),
    employee_id TEXT NOT NULL REFERENCES studio_employees(id),
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    recorded_by TEXT,
    segment_id TEXT REFERENCES studio_event_segments(id),
    metadata TEXT,
    replaces_event_id TEXT,
    device_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_studio_attendance_assignment ON studio_attendance_events(assignment_id);
CREATE INDEX IF NOT EXISTS idx_studio_attendance_event ON studio_attendance_events(event_id);
CREATE INDEX IF NOT EXISTS idx_studio_attendance_employee ON studio_attendance_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_studio_attendance_occurred ON studio_attendance_events(occurred_at);

-- Editing Tasks
CREATE TABLE IF NOT EXISTS studio_editing_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES studio_projects(id),
    event_id TEXT REFERENCES studio_events(id),
    status TEXT NOT NULL DEFAULT 'WAITING_FOR_FILES',
    editor_id TEXT REFERENCES studio_employees(id),
    album_designer_id TEXT REFERENCES studio_employees(id),
    source_folder_ref TEXT,
    output_folder_ref TEXT,
    deadline TEXT,
    completed_at TEXT,
    qc_checks TEXT,
    comments TEXT,
    revisions TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_editing_tasks_project ON studio_editing_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_editing_tasks_status ON studio_editing_tasks(status);

-- Quotations
CREATE TABLE IF NOT EXISTS studio_quotations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES studio_projects(id),
    items TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_quotations_project ON studio_quotations(project_id);

-- Invoices
CREATE TABLE IF NOT EXISTS studio_invoices (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES studio_projects(id),
    invoice_number TEXT NOT NULL UNIQUE,
    items TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_invoices_project ON studio_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_invoices_number ON studio_invoices(invoice_number);

-- Payments (immutable ledger)
CREATE TABLE IF NOT EXISTS studio_payments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES studio_projects(id),
    invoice_id TEXT REFERENCES studio_invoices(id),
    type TEXT NOT NULL DEFAULT 'advance',
    amount REAL NOT NULL,
    method TEXT,
    paid_at TEXT NOT NULL,
    replaces_payment_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT,
    receipt_ref TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_payments_project ON studio_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_payments_invoice ON studio_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_studio_payments_paid_at ON studio_payments(paid_at);

-- Expenses
CREATE TABLE IF NOT EXISTS studio_expenses (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES studio_projects(id),
    category TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    spent_at TEXT NOT NULL,
    incurred_by TEXT REFERENCES studio_employees(id),
    receipt_ref TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_expenses_project ON studio_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_expenses_category ON studio_expenses(category);
CREATE INDEX IF NOT EXISTS idx_studio_expenses_spent_at ON studio_expenses(spent_at);

-- Equipment
CREATE TABLE IF NOT EXISTS studio_equipment (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    serial_number TEXT,
    owner TEXT REFERENCES studio_employees(id),
    condition TEXT NOT NULL DEFAULT 'good',
    availability TEXT NOT NULL DEFAULT 'available',
    current_holder TEXT,
    metadata TEXT,
    maintenance TEXT,
    damage_reports TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_equipment_equipment_id ON studio_equipment(equipment_id);
CREATE INDEX IF NOT EXISTS idx_studio_equipment_category ON studio_equipment(category);
CREATE INDEX IF NOT EXISTS idx_studio_equipment_availability ON studio_equipment(availability);

-- Equipment Allocations
CREATE TABLE IF NOT EXISTS studio_equipment_allocations (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL REFERENCES studio_equipment(id),
    project_id TEXT REFERENCES studio_projects(id),
    event_id TEXT REFERENCES studio_events(id),
    assigned_to TEXT REFERENCES studio_employees(id),
    checked_out_at TEXT NOT NULL,
    checked_in_at TEXT,
    condition_out TEXT,
    condition_in TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_equipment_allocations_equipment ON studio_equipment_allocations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_studio_equipment_allocations_project ON studio_equipment_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_equipment_allocations_assigned_to ON studio_equipment_allocations(assigned_to);

-- Storage Locations
CREATE TABLE IF NOT EXISTS studio_storage_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_path TEXT NOT NULL,
    config TEXT,
    free_bytes REAL,
    total_bytes REAL,
    status TEXT NOT NULL DEFAULT 'online',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Media References
CREATE TABLE IF NOT EXISTS studio_media_references (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES studio_projects(id),
    event_id TEXT REFERENCES studio_events(id),
    storage_location_id TEXT REFERENCES studio_storage_locations(id),
    relative_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    size REAL,
    checksum TEXT,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    access_permission TEXT NOT NULL DEFAULT 'private',
    availability_status TEXT NOT NULL DEFAULT 'available',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_media_project ON studio_media_references(project_id);
CREATE INDEX IF NOT EXISTS idx_studio_media_event ON studio_media_references(event_id);
CREATE INDEX IF NOT EXISTS idx_studio_media_location ON studio_media_references(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_studio_media_type ON studio_media_references(file_type);

-- Notifications
CREATE TABLE IF NOT EXISTS studio_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES studio_users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_notifications_user ON studio_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_notifications_read ON studio_notifications(read_at);

-- Audit Log (append-only)
CREATE TABLE IF NOT EXISTS studio_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES studio_users(id),
    device_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous TEXT,
    next TEXT,
    project_id TEXT REFERENCES studio_projects(id),
    session_id TEXT,
    operation_id TEXT,
    ip TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_audit_user ON studio_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_audit_entity ON studio_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_studio_audit_timestamp ON studio_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_studio_audit_project ON studio_audit_log(project_id);

-- System Config
CREATE TABLE IF NOT EXISTS studio_system_config (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Sync Checkpoints
CREATE TABLE IF NOT EXISTS studio_sync_checkpoints (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    checkpoint TEXT NOT NULL,
    last_pulled_at TEXT,
    pending_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_studio_sync_checkpoints_device ON studio_sync_checkpoints(device_id);
CREATE INDEX IF NOT EXISTS idx_studio_sync_checkpoints_user ON studio_sync_checkpoints(user_id);

-- Sync Outbox
CREATE TABLE IF NOT EXISTS studio_sync_outbox (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    queued_at TEXT NOT NULL DEFAULT (datetime('now')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    accepted_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_sync_outbox_device ON studio_sync_outbox(device_id);
CREATE INDEX IF NOT EXISTS idx_studio_sync_outbox_status ON studio_sync_outbox(status);
CREATE INDEX IF NOT EXISTS idx_studio_sync_outbox_queued ON studio_sync_outbox(queued_at);

-- Sync Conflicts
CREATE TABLE IF NOT EXISTS studio_sync_conflicts (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operations TEXT NOT NULL,
    server_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'unresolved',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_sync_conflicts_device ON studio_sync_conflicts(device_id);
CREATE INDEX IF NOT EXISTS idx_studio_sync_conflicts_entity ON studio_sync_conflicts(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_studio_sync_conflicts_status ON studio_sync_conflicts(status);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);