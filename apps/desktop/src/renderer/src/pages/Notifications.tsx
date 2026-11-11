import React, { useState, useEffect } from "react";

export function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRead, setFilterRead] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [filterRead]);

  async function loadNotifications() {
    try {
      const result = await window.electronAPI.notifications.list({ unreadOnly: filterRead, limit: 100 });
      setNotifications(result.items);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnreadCount() {
    try {
      const result = await window.electronAPI.notifications.unreadCount();
      setUnreadCount(result.count);
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await window.electronAPI.notifications.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      loadUnreadCount();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleMarkAllRead() {
    try {
      await window.electronAPI.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      loadUnreadCount();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const typeIcons: Record<string, string> = {
    info: "ℹ️",
    warning: "⚠️",
    success: "✅",
    error: "❌",
    assignment: "📋",
    payment: "💰",
    project: "📁",
    system: "⚙️",
  };

  const typeColors: Record<string, string> = {
    info: "#3b82f6",
    warning: "#f59e0b",
    success: "#22c55e",
    error: "#ef4444",
    assignment: "#8b5cf6",
    payment: "#22c55e",
    project: "#3b82f6",
    system: "#64748b",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Notifications</h1>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "14px", cursor: "pointer" }}>
            <input type="checkbox" checked={filterRead} onChange={(e) => setFilterRead(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#3b82f6" }} />
            Unread only
          </label>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={{ padding: "10px 20px", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Mark All Read</button>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
            {filterRead ? "No unread notifications." : "No notifications yet."}
          </div>
        ) : (
          <div style={{ maxHeight: "70vh", overflow: "auto" }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: "16px",
                  padding: "16px 24px",
                  borderBottom: "1px solid #334155",
                  backgroundColor: n.read ? "transparent" : "#3b82f610",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    backgroundColor: (typeColors[n.type] || "#64748b") + "20",
                    flexShrink: 0,
                  }}
                >
                  {typeIcons[n.type] || "🔔"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "#f8fafc" }}>{n.title}</h3>
                      <p style={{ margin: 0, fontSize: "13px", color: "#e2e8f0", lineHeight: 1.5 }}>{n.message}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          style={{
                            padding: "4px 10px",
                            backgroundColor: "transparent",
                            color: "#3b82f6",
                            border: "1px solid #3b82f6",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                  {n.data && (
                    <details style={{ marginTop: "8px" }}>
                      <summary style={{ fontSize: "11px", color: "#64748b", cursor: "pointer" }}>View details</summary>
                      <pre style={{ margin: "8px 0 0", padding: "8px", backgroundColor: "#0f172a", borderRadius: "6px", fontSize: "11px", color: "#94a3b8", overflow: "auto", maxHeight: "150px" }}>
                        {JSON.stringify(n.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}