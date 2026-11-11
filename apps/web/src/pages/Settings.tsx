import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { formatCurrency } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Moon, Sun } from "lucide-react";

export function Settings() {
  const { user } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "",
  });

  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", newTheme);
  };

  const updateProfile = async () => {
    await api.put("/api/config", profile);
    alert("Profile updated successfully!");
  };

  if (!user) {
    return <div className="flex h-screen items-center justify-center">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Account and system configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium mb-4">Profile</h2>
            <form className="space-y-4">
              <Input label="Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
              <Input type="email" label="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required readOnly />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Role: {profile.role}</span>
              </div>
              <Button type="submit" onClick={updateProfile} className="w-full">
                Update Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-medium mb-4">Appearance</h2>
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => setTheme("light")}
                className={theme === "light" ? "bg-primary text-primary-foreground" : ""}
              >
                Light Mode
              </Button>
              <Button
                variant="outline"
                onClick={() => setTheme("dark")}
                className={theme === "dark" ? "bg-primary text-primary-foreground" : ""}
              >
                Dark Mode
              </Button>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                System preference: {document.documentElement.classList.contains("dark") ? "Dark" : "Light"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h2 className="text-lg font-medium mb-4">Security</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your account security and device sessions
          </p>
          <div className="space-y-3">
            <Button variant="destructive" onClick={() => {
              localStorage.removeItem("auth_token");
              localStorage.removeItem("device_id");
              window.location.href = "/login";
            }}>
              <Shield className="h-4 w-4 mr-2" /> Log Out All Sessions
            </Button>
            <div className="text-xs text-muted-foreground">
              <p>Last login: Just now</p>
              <p>Active devices: 1</p>
            </div>
            <Button variant="outline" onClick={() => setTheme("light")}>
              Refresh Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useAuth } from "../contexts/AuthContext";