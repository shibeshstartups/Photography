import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Employees from "./pages/Employees";
import Events from "./pages/Events";
import Assignments from "./pages/Assignments";
import Attendance from "./pages/Attendance";
import Editing from "./pages/Editing";
import Finance from "./pages/Finance";
import Equipment from "./pages/Equipment";
import Media from "./pages/Media";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Audit from "./pages/Audit";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/events" element={<Events />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/editing" element={<Editing />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/media" element={<Media />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}