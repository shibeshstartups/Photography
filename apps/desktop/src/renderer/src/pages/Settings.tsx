import React, { useState, useEffect } from "react";

export function Settings() {
  const [activeTab, setActiveTab] = useState<"general" | "users" | "sync" | "backup" | "about">("general");
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userFormData, setUserFormData] = useState({ email: "", fullName: "", role: "editor", password: "" });
  const [syncStatus, setSyncStatus] = useState<{ pending: number; conflicts: number; rejected: number; lastSync: string | null }>({ pending: 0, conflicts: 0, rejected: 0, lastSync: null });
  const [deviceId, setDeviceId] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadConfig();
    if (activeTab === "users") loadUsers();
    if (activeTab === "sync") loadSyncStatus();
  }, [activeTab]);

  async function loadConfig() {
    try {
      const result = await window.electronAPI.config.getAll();
      setConfig(result);
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const result = await window.electronAPI.auth.listUsers({ limit: 100 });
      setUsers(result.items);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }

  async function loadSyncStatus() {
    try {
      const stored = localStorage.getItem("studio-device-id");
      if (stored) setDeviceId(stored);

      const status = await window.electronAPI.sync.outboxStatus(stored || "");
      setSyncStatus(status);
    } catch (error) {
      console.error("Failed to load sync status:", error);
    }
  }

  async function handleSaveConfig(key: string, value: any) {
    setSaving(true);
    try {
      await window.electronAPI.config.set(key, value);
      setConfig((prev) => ({ ...prev, [key]: value }));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUser() {
    try {
      await window.electronAPI.auth.register(userFormData);
      setShowUserForm(false);
      setUserFormData({ email: "", fullName: "", role: "editor", password: "" });
      loadUsers();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await window.electronAPI.auth.deleteUser(id);
      loadUsers();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleSync() {
    if (!deviceId) return alert("No device ID found");
    setSyncing(true);
    try {
      await window.electronAPI.sync.push(deviceId, "current-user", "", []);
      await window.electronAPI.sync.pull(deviceId, "current-user", "");
      loadSyncStatus();
      alert("Sync completed!");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleFullSync() {
    if (!deviceId) return alert("No device ID found");
    if (!confirm("This will pull all data from server. Continue?")) return;
    setSyncing(true);
    try {
      await window.electronAPI.sync.full(deviceId, "current-user");
      loadSyncStatus();
      alert("Full sync completed!");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleExportData() {
    try {
      const data = await window.electronAPI.config.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studio-erp-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleImportData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await window.electronAPI.config.importData(data);
      loadConfig();
      alert("Data imported successfully!");
    } catch (error: any) {
      alert(error.message);
    }
    event.target.value = "";
  }

  const tabs = [
    { id: "general", label: "General", icon: "⚙️" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "sync", label: "Sync", icon: "🔄" },
    { id: "backup", label: "Backup", icon: "💾" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Settings</h1>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* Tab Navigation */}
        <div style={{ width: "200px", flexShrink: 0, backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
          <nav>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      border: "none",
                      borderRadius: "8px",
                      backgroundColor: activeTab === tab.id ? "#3b82f6" : "transparent",
                      color: activeTab === tab.id ? "#fff" : "#94a3b8",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== tab.id) {
                        e.currentTarget.style.backgroundColor = "#334155";
                        e.currentTarget.style.color = "#f8fafc";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab.id) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#94a3b8";
                      }
                    }}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === "general" && (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 600, color: "#f8fafc" }}>General Settings</h2>
              {loading ? (
                <div style={{ color: "#64748b" }}>Loading...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Studio Name</label>
                    <input
                      value={config.studio_name || ""}
                      onChange={(e) => handleSaveConfig("studio_name", e.target.value)}
                      placeholder="My Photography Studio"
                      style={{ width: "100%", maxWidth: "400px", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Default Currency</label>
                    <select
                      value={config.default_currency || "INR"}
                      onChange={(e) => handleSaveConfig("default_currency", e.target.value)}
                      style={{ width: "100%", maxWidth: "200px", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Timezone</label>
                    <select
                      value={config.timezone || "Asia/Kolkata"}
                      onChange={(e) => handleSaveConfig("timezone", e.target.value)}
                      style={{ width: "100%", maxWidth: "300px", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Date Format</label>
                    <select
                      value={config.date_format || "DD/MM/YYYY"}
                      onChange={(e) => handleSaveConfig("date_format", e.target.value)}
                      style={{ width: "100%", maxWidth: "200px", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Project ID Prefix</label>
                    <input
                      value={config.project_id_prefix || "PRJ"}
                      onChange={(e) => handleSaveConfig("project_id_prefix", e.target.value)}
                      placeholder="PRJ"
                      style={{ width: "100%", maxWidth: "150px", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Enable Sync</label>
                    <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={config.sync_enabled === "true"}
                        onChange={(e) => handleSaveConfig("sync_enabled", e.target.checked.toString())}
                        style={{ width: "20px", height: "20px", accentColor: "#3b82f6" }}
                      />
                      <span style={{ color: "#f8fafc" }}>Enable automatic sync with server</span>
                    </label>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>Sync Interval (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={config.sync_interval || "60"}
                      onChange={(e) => handleSaveConfig("sync_interval", e.target.value)}
                      style={{ width: "100%", maxWidth: "150px", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
                    />
                  </div>

                  <div style={{ paddingTop: "16px", borderTop: "1px solid #334155" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>All Config Values</h3>
                    <pre style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", fontSize: "12px", color: "#94a3b8", overflow: "auto", maxHeight: "300px" }}>
                      {JSON.stringify(config, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: "#f8fafc" }}>User Management</h2>
                <button onClick={() => setShowUserForm(true)} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add User</button>
              </div>

              {showUserForm && (
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "20px", marginBottom: "24px" }}>
                  <h3 style={{ margin: "0 0 16px" }}>New User</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Email *</label>
                      <input type="email" value={userFormData.email} onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })} placeholder="user@example.com" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Full Name *</label>
                      <input value={userFormData.fullName} onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })} placeholder="John Doe" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Role *</label>
                      <select value={userFormData.role} onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Password *</label>
                      <input type="password" value={userFormData.password} onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })} placeholder="••••••••" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                    <button onClick={() => setShowUserForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
                    <button onClick={handleCreateUser} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Create User</button>
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155" }}>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>User</th>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Email</th>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Role</th>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Status</th>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Last Login</th>
                      <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #334155" }}>
                        <td style={{ padding: "16px", fontWeight: 500, color: "#f8fafc" }}>{u.full_name}</td>
                        <td style={{ padding: "16px", color: "#94a3b8" }}>{u.email}</td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: "#3b82f620", color: "#3b82f6" }}>{u.role}</span>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (u.is_active ? "#22c55e" : "#ef4444") + "20", color: u.is_active ? "#22c55e" : "#ef4444" }}>
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px" }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</td>
                        <td style={{ padding: "16px" }}>
                          <button onClick={() => handleDeleteUser(u.id)} style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "sync" && (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 600, color: "#f8fafc" }}>Sync Status</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Device ID</div>
                  <div style={{ fontFamily: "monospace", fontSize: "14px", color: "#f8fafc", wordBreak: "break-all" }}>{deviceId || "Not set"}</div>
                </div>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Pending Operations</div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: syncStatus.pending > 0 ? "#f59e0b" : "#22c55e" }}>{syncStatus.pending}</div>
                </div>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Conflicts</div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: syncStatus.conflicts > 0 ? "#ef4444" : "#22c55e" }}>{syncStatus.conflicts}</div>
                </div>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Rejected</div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: syncStatus.rejected > 0 ? "#ef4444" : "#22c55e" }}>{syncStatus.rejected}</div>
                </div>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Last Sync</div>
                  <div style={{ fontSize: "14px", color: "#f8fafc" }}>{syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : "Never"}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button onClick={handleSync} disabled={syncing || !deviceId} style={{ padding: "12px 24px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: syncing || !deviceId ? "not-allowed" : "pointer", opacity: syncing || !deviceId ? 0.6 : 1 }}>
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
                <button onClick={handleFullSync} disabled={syncing || !deviceId} style={{ padding: "12px 24px", backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: syncing || !deviceId ? "not-allowed" : "pointer", opacity: syncing || !deviceId ? 0.6 : 1 }}>
                  Full Sync (Pull All)
                </button>
                <button onClick={loadSyncStatus} disabled={syncing} style={{ padding: "12px 24px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: syncing ? "not-allowed" : "pointer" }}>
                  Refresh Status
                </button>
              </div>

              {syncStatus.conflicts > 0 && (
                <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#ef444410", border: "1px solid #ef444440", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px" }}>⚠️</span>
                    <strong style={{ color: "#ef4444" }}>Unresolved Conflicts</strong>
                  </div>
                  <p style={{ margin: 0, color: "#f8fafc" }}>There are {syncStatus.conflicts} conflict(s) that need manual resolution. Use the sync conflict resolution API to resolve them.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "backup" && (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 600, color: "#f8fafc" }}>Backup & Restore</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>Export Data</h3>
                  <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: "14px" }}>Download a complete backup of all application data including projects, clients, employees, finances, and settings.</p>
                  <button onClick={handleExportData} style={{ padding: "12px 24px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", width: "100%" }}>Export All Data (JSON)</button>
                </div>

                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>Import Data</h3>
                  <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: "14px" }}>Restore data from a previously exported backup file. This will merge with existing data.</p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    style={{ display: "none" }}
                    id="import-file"
                    ref={(el) => el && (window.importFileRef = el)}
                  />
                  <button
                    onClick={() => (window.importFileRef as HTMLInputElement)?.click()}
                    style={{ padding: "12px 24px", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", width: "100%" }}
                  >
                    Import Backup File
                  </button>
                </div>
              </div>

              <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>What's Included in Backup</h4>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#94a3b8", fontSize: "13px", lineHeight: 1.8 }}>
                  <li>All projects, events, and segments</li>
                  <li>Clients and contacts</li>
                  <li>Employees, assignments, and attendance</li>
                  <li>Editing tasks and revisions</li>
                  <li>Quotations, invoices, payments, expenses</li>
                  <li>Equipment and allocations</li>
                  <li>Media references and storage locations</li>
                  <li>Notifications and system config</li>
                  <li>Sync checkpoints and outbox</li>
                  <li>Audit logs</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "32px" }}>
                <div style={{ fontSize: "80px" }}>📸</div>
                <div>
                  <h2 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 700, color: "#f8fafc" }}>Studio ERP</h2>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "16px" }}>Version 1.0.0</p>
                  <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "14px" }}>Offline-first photography studio management</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px", marginBottom: "32px" }}>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Technology Stack</h3>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "#e2e8f0", fontSize: "13px", lineHeight: 2 }}>
                    <li>Electron 33 + React 18</li>
                    <li>TypeScript 5</li>
                    <li>SQLite (better-sqlite3)</li>
                    <li>Drizzle ORM</li>
                    <li>Zod validation</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Key Features</h3>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "#e2e8f0", fontSize: "13px", lineHeight: 2 }}>
                    <li>Offline-first architecture</li>
                    <li>Project & client management</li>
                    <li>Crew scheduling & attendance</li>
                    <li>Editing workflow tracking</li>
                    <li>Finance & invoicing</li>
                    <li>Equipment tracking</li>
                    <li>Media library</li>
                    <li>Sync with conflict resolution</li>
                  </ul>
                </div>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Architecture</h3>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "#e2e8f0", fontSize: "13px", lineHeight: 2 }}>
                    <li>Main process (Node.js)</li>
                    <li>Renderer (React + Vite)</li>
                    <li>Context isolation + preload</li>
                    <li>IPC with typed channels</li>
                    <li>Append-only data patterns</li>
                    <li>RBAC permissions</li>
                  </ul>
                </div>
              </div>

              <div style={{ padding: "16px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                Built with ❤️ for photography studios<br />
                <span style={{ color: "#3b82f6" }}>studio-erp</span> • Local-first • Privacy-focused
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}