import React, { useState, useEffect, createContext, useContext } from "react";
import { Dashboard } from "./pages/Dashboard.js";
import { Projects } from "./pages/Projects.js";
import { Clients } from "./pages/Clients.js";
import { Employees } from "./pages/Employees.js";
import { Assignments } from "./pages/Assignments.js";
import { Attendance } from "./pages/Attendance.js";
import { Editing } from "./pages/Editing.js";
import { Finance } from "./pages/Finance.js";
import { Equipment } from "./pages/Equipment.js";
import { Media } from "./pages/Media.js";
import { Notifications } from "./pages/Notifications.js";
import { Settings } from "./pages/Settings.js";
import { Login } from "./pages/Login.js";
import { Sidebar } from "./components/Sidebar.js";
import { TopBar } from "./components/TopBar.js";
import { useAuth } from "./hooks/useAuth.js";

type Page = "dashboard" | "projects" | "clients" | "employees" | "assignments" | "attendance" | "editing" | "finance" | "equipment" | "media" | "notifications" | "settings";

const pages: Record<Page, React.FC> = {
  dashboard: Dashboard,
  projects: Projects,
  clients: Clients,
  employees: Employees,
  assignments: Assignments,
  attendance: Attendance,
  editing: Editing,
  finance: Finance,
  equipment: Equipment,
  media: Media,
  notifications: Notifications,
  settings: Settings,
};

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div style={{ color: "#64748b" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={() => {}} />;
  }

  const PageComponent = pages[currentPage];

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f172a" }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} collapsed={sidebarCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <PageComponent />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}