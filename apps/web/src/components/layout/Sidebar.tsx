import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  CreditCard,
  Camera,
  Package,
  Bell,
  ClipboardList,
  Settings,
  Shield,
  BarChart3,
  LogOut,
} from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "photographer", "editor", "sales"] },
  { name: "Projects", href: "/projects", icon: FileText, roles: ["admin", "manager", "photographer", "editor", "sales"] },
  { name: "Clients", href: "/clients", icon: Users, roles: ["admin", "manager", "sales"] },
  { name: "Team", href: "/employees", icon: Users, roles: ["admin", "manager"] },
  { name: "Events", href: "/events", icon: Calendar, roles: ["admin", "manager", "photographer"] },
  { name: "Assignments", href: "/assignments", icon: ClipboardList, roles: ["admin", "manager", "photographer"] },
  { name: "Attendance", href: "/attendance", icon: ClipboardList, roles: ["admin", "manager"] },
  { name: "Editing", href: "/editing", icon: Camera, roles: ["admin", "manager", "editor"] },
  { name: "Finance", href: "/finance", icon: CreditCard, roles: ["admin", "manager", "sales"] },
  { name: "Equipment", href: "/equipment", icon: Package, roles: ["admin", "manager"] },
  { name: "Media", href: "/media", icon: Camera, roles: ["admin", "manager", "photographer", "editor"] },
  { name: "Notifications", href: "/notifications", icon: Bell, roles: ["admin", "manager", "photographer", "editor", "sales"] },
  { name: "Audit Log", href: "/audit", icon: Shield, roles: ["admin"] },
  { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin", "manager"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredNav = navigation.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  return (
    <aside className="fixed left-0 top-0 z-40 w-64 h-screen border-r bg-card transition-all duration-200 flex flex-col">
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <NavLink to="/dashboard" className="font-bold text-xl text-primary">
          StudioERP
        </NavLink>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1" role="navigation" aria-label="Main navigation">
        {filteredNav.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}