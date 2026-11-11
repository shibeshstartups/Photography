import React, { useState, useEffect } from "react";

export function Attendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ employeeId: "", eventType: "check_in", timestamp: new Date().toISOString().slice(0, 16), location: "", notes: "" });
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadAttendance();
    loadEmployees();
  }, [filterDate]);

  async function loadAttendance() {
    try {
      const result = await window.electronAPI.attendance.list({ date: filterDate, limit: 100 });
      setRecords(result.items);
    } catch (error) {
      console.error("Failed to load attendance:", error);
    } finally {
      setLoading(false);
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
      await window.electronAPI.attendance.create(formData);
      setShowForm(false);
      setFormData({ employeeId: "", eventType: "check_in", timestamp: new Date().toISOString().slice(0, 16), location: "", notes: "" });
      loadAttendance();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const eventColors: Record<string, string> = {
    check_in: "#22c55e",
    check_out: "#ef4444",
    break_start: "#f59e0b",
    break_end: "#3b82f6",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Attendance</h1>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}
          />
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Log Event</button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>Log Attendance Event</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Employee *</label>
              <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} - {e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Event Type *</label>
              <select value={formData.eventType} onChange={(e) => setFormData({ ...formData, eventType: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="check_in">Check In</option>
                <option value="check_out">Check Out</option>
                <option value="break_start">Break Start</option>
                <option value="break_end">Break End</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Timestamp *</label>
              <input type="datetime-local" value={formData.timestamp} onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Location</label>
              <input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Venue address or GPS coords" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" rows={3} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Log Event</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No attendance records for this date.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Employee</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Event</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Time</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Location</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px", fontWeight: 500, color: "#f8fafc" }}>{r.employeeId}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (eventColors[r.event_type] || "#64748b") + "20", color: eventColors[r.event_type] || "#64748b" }}>
                      {r.event_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px" }}>{r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}</td>
                  <td style={{ padding: "16px", color: "#94a3b8" }}>{r.location || "-"}</td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px" }}>{r.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}