import React, { useState, useEffect } from "react";

export function Editing() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ projectId: "", assigneeId: "", type: "culling", priority: "normal", dueDate: "" });
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    loadTasks();
    loadProjects();
    loadEmployees();
  }, [filterStatus]);

  async function loadTasks() {
    try {
      const result = await window.electronAPI.editing.list({ status: filterStatus || undefined, limit: 100 });
      setTasks(result.items);
    } catch (error) {
      console.error("Failed to load editing tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const result = await window.electronAPI.projects.list({ limit: 100, status: "IN_PROGRESS" });
      setProjects(result.items);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  }

  async function loadEmployees() {
    try {
      const result = await window.electronAPI.employees.list({ limit: 100, status: "active" });
      setEmployees(result.items);
    } catch (error) {
      console.error("Failed to load employees:", error);
    }
  }

  async function handleCreate() {
    try {
      await window.electronAPI.editing.create(formData);
      setShowForm(false);
      setFormData({ projectId: "", assigneeId: "", type: "culling", priority: "normal", dueDate: "" });
      loadTasks();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await window.electronAPI.editing.updateStatus(id, status);
      loadTasks();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const statusColors: Record<string, string> = {
    pending: "#64748b",
    in_progress: "#3b82f6",
    qc_pending: "#f59e0b",
    qc_failed: "#ef4444",
    approved: "#22c55e",
    delivered: "#8b5cf6",
  };

  const typeLabels: Record<string, string> = {
    culling: "Culling",
    editing: "Editing",
    color_grading: "Color Grading",
    retouching: "Retouching",
    qc: "Quality Check",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Editing Tasks</h1>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="qc_pending">QC Pending</option>
            <option value="qc_failed">QC Failed</option>
            <option value="approved">Approved</option>
            <option value="delivered">Delivered</option>
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>New Task</button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>New Editing Task</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project *</label>
              <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Assignee *</label>
              <select value={formData.assigneeId} onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select editor</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} - {e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Task Type *</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="culling">Culling</option>
                <option value="editing">Editing</option>
                <option value="color_grading">Color Grading</option>
                <option value="retouching">Retouching</option>
                <option value="qc">Quality Check</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Due Date</label>
              <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Create Task</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No editing tasks yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Project</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Type</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Assignee</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Due Date</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px", fontWeight: 500, color: "#f8fafc" }}>{t.projectId}</td>
                  <td style={{ padding: "16px", color: "#e2e8f0" }}>{typeLabels[t.type] || t.type}</td>
                  <td style={{ padding: "16px", color: "#94a3b8" }}>{t.assigneeId}</td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px" }}>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "-"}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (statusColors[t.status] || "#64748b") + "20", color: statusColors[t.status] || "#64748b" }}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {t.status !== "delivered" && (
                        <button
                          onClick={() => handleStatusChange(t.id, t.status === "pending" ? "in_progress" : t.status === "in_progress" ? "qc_pending" : t.status === "qc_pending" ? "approved" : "delivered")}
                          style={{ padding: "6px 12px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                        >
                          {t.status === "pending" ? "Start" : t.status === "in_progress" ? "Submit QC" : t.status === "qc_pending" ? "Approve" : "Deliver"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}