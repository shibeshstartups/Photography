import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.js";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setShowUserMenu(false);
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        height: "56px",
        backgroundColor: "#1e293b",
        borderBottom: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "relative",
        zIndex: 100,
        // Allow window dragging
        WebkitAppRegion: "drag",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px", WebkitAppRegion: "no-drag" }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#334155")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <h1 style={{ fontSize: "18px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
          Studio ERP
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", WebkitAppRegion: "no-drag" }}>
        {/* Notifications bell */}
        <button
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "8px",
            position: "relative",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#334155")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#ef4444",
            }}
          />
        </button>

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <button
            ref={buttonRef}
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#334155")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <span style={{ color: "#f8fafc", fontSize: "14px", fontWeight: 500 }}>
              {user?.name || "User"}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showUserMenu && (
            <div
              ref={userMenuRef}
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "8px",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "12px",
                padding: "8px",
                minWidth: "200px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                zIndex: 200,
              }}
            >
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #334155", marginBottom: "4px" }}>
                <div style={{ fontWeight: 600, color: "#f8fafc" }}>{user?.name}</div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>{user?.email}</div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Role: {user?.role}</div>
              </div>
              <button
                onClick={logout}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  color: "#ef4444",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#334155")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Window controls (for non-macOS) */}
        <div style={{ display: "flex", gap: "8px", WebkitAppRegion: "no-drag" }}>
          <button
            onClick={() => window.electronAPI?.send?.("app:minimize") || window.electronAPI?.openExternal?.("")}
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "#fbbf24",
              cursor: "pointer",
            }}
          />
          <button
            onClick={() => window.electronAPI?.send?.("app:maximize")}
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "#34d399",
              cursor: "pointer",
            }}
          />
          <button
            onClick={() => window.electronAPI?.send?.("app:close")}
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "#f87171",
              cursor: "pointer",
            }}
          />
        </div>
      </div>
    </div>
  );
}