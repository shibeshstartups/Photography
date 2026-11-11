import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  status: string;
}

interface Device {
  id: string;
  name: string;
  platform: string;
}

interface AuthState {
  user: User | null;
  device: Device | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, deviceName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    device: null,
    token: null,
    loading: true,
  });

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    const deviceId = localStorage.getItem("device_id");

    if (!token || !deviceId) {
      setState({ user: null, device: null, token: null, loading: false });
      return;
    }

    try {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      api.defaults.headers.common["X-Device-ID"] = deviceId;

      const response = await api.get("/api/auth/me");
      setState({
        user: response.data.user,
        device: response.data.device,
        token,
        loading: false,
      });
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("device_id");
      delete api.defaults.headers.common["Authorization"];
      delete api.defaults.headers.common["X-Device-ID"];
      setState({ user: null, device: null, token: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string, deviceName?: string) => {
    const deviceId = localStorage.getItem("device_id") || crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);

    const response = await api.post("/api/auth/login", {
      email,
      password,
      deviceId,
      deviceName: deviceName || `Web (${navigator.platform})`,
      platform: "web",
    });

    const { user, device, token } = response.data;
    localStorage.setItem("auth_token", token);

    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    api.defaults.headers.common["X-Device-ID"] = device.id;

    setState({ user, device, token, loading: false });
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("device_id");
    delete api.defaults.headers.common["Authorization"];
    delete api.defaults.headers.common["X-Device-ID"];
    setState({ user: null, device: null, token: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}