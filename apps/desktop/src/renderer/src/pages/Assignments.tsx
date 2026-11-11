import React, { useState, useEffect } from "react";

export function Assignments() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ projectId: "", employeeId: "", assignmentDate: "", status: "pending_validation" });
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadAssignments();
    loadProjects();
    loadEmployees();
  }, []);

  async function loadAssignments() {
    try {
      const result = await window.electronAPI.assignments.list({ limit: 100 });
      setAssignments(result.items);
    } catch (error) {
      console.error("Failed to load assignments:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const result = await window.electronAPI.projects.list({ limit: 100, status: "CONFIRMED" });
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
      await window.electronAPI.assignments.create(formData);
      setShowForm(false);
      setFormData({ projectId: "", employeeId: "", assignmentDate: "", status: "pending_validation" });
      loadAssignments();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const statusColors: Record<string, string> = {
    confirmed: "#22c55e",
    tentative: "#f59e0b",
    pending_validation: "#3b82f6",
    provisional: "#8b5cf6",
    cancelled: "#ef4444",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Assignments</h1>
        <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>New Assignment</button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>New Assignment</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project *</label>
              <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Employee *</label>
              <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} - {e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Date *</label>
              <input type="date" value={formData.assignmentDate} onChange={(e) => setFormData({ ...formData, assignmentDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="pending_validation">Pending Validation</option>
                <option value="tentative">Tentative</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Create Assignment</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : assignments.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No assignments yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Project</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Employee</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Date</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px", color: "#f8fafc" }}>{a.projectId}</td>
                  <td style={{ padding: "16px", color: "#f8fafc" }}>{a.employeeId}</td>
                  <td style={{ padding: "16px", color: "#94a3b8" }}>{a.assignment_date ? new Date(a.assignment_date).toLocaleDateString() : "-"}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (statusColors[a.status] || "#64748b") + "20", color: statusColors[a.status] || "#64748b" }}>
                      {a.status.replace(/_/g, " ")}
                    </span>
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