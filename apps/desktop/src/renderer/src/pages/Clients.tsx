import React, { useState, useEffect } from "react";

export function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ fullName: "", phone: "", email: "", address: "" });

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const result = await window.electronAPI.clients.list({ limit: 100 });
      setClients(result.items);
    } catch (error) {
      console.error("Failed to load clients:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await window.electronAPI.clients.create(formData);
      setShowForm(false);
      setFormData({ fullName: "", phone: "", email: "", address: "" });
      loadClients();
    } catch (error: any) {
      alert(error.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Clients</h1>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          New Client
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>New Client</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Full Name *</label>
              <input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Rajesh Sharma"
                style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Phone</label>
              <input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="rajesh@example.com"
                style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Address</label>
              <input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City"
                style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Create Client</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No clients yet. Add your first client!</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Client ID</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Name</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Phone</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px", fontFamily: "monospace", fontSize: "13px", color: "#f8fafc" }}>{c.client_id}</td>
                  <td style={{ padding: "16px", fontWeight: 500, color: "#f8fafc" }}>{c.full_name}</td>
                  <td style={{ padding: "16px", color: "#94a3b8" }}>{c.phone || "-"}</td>
                  <td style={{ padding: "16px", color: "#94a3b8" }}>{c.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}