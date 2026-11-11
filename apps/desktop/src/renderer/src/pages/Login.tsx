import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "48px",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "16px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📸</div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: "0 0 8px" }}>Studio ERP</h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>Photography Production Management</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#ef444420",
                border: "1px solid #ef4444",
                borderRadius: "8px",
                color: "#fca5a5",
                fontSize: "14px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#e2e8f0", marginBottom: "6px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@studio.com"
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#e2e8f0", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: loading ? "#3b82f680" : "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #334155", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            First time? No users exist yet. Create the first admin account.
          </p>
          <button
            onClick={async () => {
              try {
                await window.electronAPI.auth.register({
                  email: "admin@studio.com",
                  name: "Admin User",
                  password: "password123",
                });
                alert("Admin created! Use admin@studio.com / password123");
              } catch (e: any) {
                alert(e.message);
              }
            }}
            style={{
              marginTop: "12px",
              padding: "10px 20px",
              backgroundColor: "transparent",
              color: "#94a3b8",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Create First Admin
          </button>
        </div>
      </div>
    </div>
  );
}