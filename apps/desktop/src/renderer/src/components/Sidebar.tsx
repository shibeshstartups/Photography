import React from "react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "projects", label: "Projects", icon: "📁" },
  { id: "clients", label: "Clients", icon: "👥" },
  { id: "employees", label: "Crew", icon: "👤" },
  { id: "assignments", label: "Assignments", icon: "📋" },
  { id: "attendance", label: "Attendance", icon: "⏰" },
  { id: "editing", label: "Editing", icon: "🎬" },
  { id: "finance", label: "Finance", icon: "💰" },
  { id: "equipment", label: "Equipment", icon: "📷" },
  { id: "media", label: "Media", icon: "🖼️" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar({ currentPage, onNavigate, collapsed }: SidebarProps) {
  const width = collapsed ? 64 : 240;

  return (
    <div
      style={{
        width,
        height: "100vh",
        backgroundColor: "#1e293b",
        borderRight: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ fontSize: "24px" }}>📸</div>
        {!collapsed && (
          <span style={{ fontSize: "18px", fontWeight: 600, color: "#f8fafc" }}>
            Studio ERP
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "8px", overflow: "auto" }}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "none",
                  borderRadius: "8px",
                  backgroundColor:
                    currentPage === item.id ? "#3b82f6" : "transparent",
                  color: currentPage === item.id ? "#fff" : "#94a3b8",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: collapsed ? "center" : "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: "12px",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== item.id && !collapsed) {
                    e.currentTarget.style.backgroundColor = "#334155";
                    e.currentTarget.style.color = "#f8fafc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== item.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#94a3b8";
                  }
                }}
                title={collapsed ? item.label : ""}
              >
                <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom info */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #334155",
          fontSize: "11px",
          color: "#64748b",
          textAlign: collapsed ? "center" : "left",
        }}
      >
        {!collapsed && "v1.0.0 • Offline-first"}
        {collapsed && "v1.0.0"}
      </div>
    </div>
  );
}