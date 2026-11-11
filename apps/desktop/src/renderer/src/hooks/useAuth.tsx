import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  status: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // Check for stored token
      const token = localStorage.getItem("auth_token");
      if (token) {
        const userData = await window.electronAPI.auth.me();
        setUser(userData);
      }
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("device_id");
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await window.electronAPI.auth.login(email, password);
    localStorage.setItem("auth_token", result.token);
    localStorage.setItem("device_id", result.deviceId);
    setUser(result.user);
  }

  async function logout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("device_id");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}