import React, { useState, useEffect } from "react";

export function Equipment() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAllocationForm, setShowAllocationForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", category: "", serialNumber: "", purchaseDate: "", purchaseCost: "", location: "", condition: "excellent", specifications: "" });
  const [allocationData, setAllocationData] = useState({ equipmentId: "", projectId: "", employeeId: "", checkoutDate: new Date().toISOString().slice(0, 10), expectedReturnDate: "", purpose: "" });
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    loadEquipment();
    loadProjects();
    loadEmployees();
  }, [filterStatus]);

  async function loadEquipment() {
    try {
      const result = await window.electronAPI.equipment.list({ status: filterStatus || undefined, limit: 100 });
      setItems(result.items);
    } catch (error) {
      console.error("Failed to load equipment:", error);
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
      await window.electronAPI.equipment.create(formData);
      setShowForm(false);
      setFormData({ name: "", category: "", serialNumber: "", purchaseDate: "", purchaseCost: "", location: "", condition: "excellent", specifications: "" });
      loadEquipment();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleAllocate() {
    try {
      await window.electronAPI.equipment.allocate(allocationData);
      setShowAllocationForm(false);
      setAllocationData({ equipmentId: "", projectId: "", employeeId: "", checkoutDate: new Date().toISOString().slice(0, 10), expectedReturnDate: "", purpose: "" });
      loadEquipment();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleCheckin(equipmentId: string) {
    try {
      await window.electronAPI.equipment.checkin(equipmentId);
      loadEquipment();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const statusColors: Record<string, string> = {
    available: "#22c55e",
    allocated: "#3b82f6",
    maintenance: "#f59e0b",
    retired: "#64748b",
    damaged: "#ef4444",
    lost: "#ef4444",
  };

  const conditionColors: Record<string, string> = {
    excellent: "#22c55e",
    good: "#3b82f6",
    fair: "#f59e0b",
    poor: "#ef4444",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Equipment</h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="allocated">Allocated</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Equipment</button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>Add Equipment</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Name *</label>
              <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Sony A7R IV" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Category *</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select category</option>
                <option value="camera">Camera</option>
                <option value="lens">Lens</option>
                <option value="lighting">Lighting</option>
                <option value="audio">Audio</option>
                <option value="accessory">Accessory</option>
                <option value="storage">Storage</option>
                <option value="computer">Computer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Serial Number</label>
              <input value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} placeholder="1234567890" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Purchase Date</label>
              <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Purchase Cost</label>
              <input type="number" step="0.01" value={formData.purchaseCost} onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })} placeholder="250000" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Condition</label>
              <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Location</label>
              <input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Studio A / Shelf 3" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Specifications (JSON)</label>
              <textarea value={formData.specifications} onChange={(e) => setFormData({ ...formData, specifications: e.target.value })} placeholder='{"sensor": "61MP", "mount": "Sony E"}' rows={3} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontFamily: "monospace", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Equipment</button>
          </div>
        </div>
      )}

      {showAllocationForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>Allocate Equipment</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Equipment *</label>
              <select value={allocationData.equipmentId} onChange={(e) => setAllocationData({ ...allocationData, equipmentId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select equipment</option>
                {items.filter((i) => i.status === "available").map((eq) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.equipment_id})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project *</label>
              <select value={allocationData.projectId} onChange={(e) => setAllocationData({ ...allocationData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Employee *</label>
              <select value={allocationData.employeeId} onChange={(e) => setAllocationData({ ...allocationData, employeeId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} - {e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Checkout Date</label>
              <input type="date" value={allocationData.checkoutDate} onChange={(e) => setAllocationData({ ...allocationData, checkoutDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Expected Return</label>
              <input type="date" value={allocationData.expectedReturnDate} onChange={(e) => setAllocationData({ ...allocationData, expectedReturnDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Purpose</label>
              <input value={allocationData.purpose} onChange={(e) => setAllocationData({ ...allocationData, purpose: e.target.value })} placeholder="Wedding shoot - Sharma family" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowAllocationForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAllocate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Allocate</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No equipment yet. Add your first item!</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Equipment ID</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Name</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Category</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Condition</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Location</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px", fontFamily: "monospace", fontSize: "13px", color: "#f8fafc" }}>{e.equipment_id}</td>
                  <td style={{ padding: "16px", fontWeight: 500, color: "#f8fafc" }}>{e.name}</td>
                  <td style={{ padding: "16px", color: "#94a3b8" }}>{e.category}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (statusColors[e.status] || "#64748b") + "20", color: statusColors[e.status] || "#64748b" }}>
                      {e.status}
                    </span>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (conditionColors[e.condition] || "#64748b") + "20", color: conditionColors[e.condition] || "#64748b" }}>
                      {e.condition}
                    </span>
                  </td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px" }}>{e.location || "-"}</td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {e.status === "available" && (
                        <button onClick={() => { setAllocationData({ ...allocationData, equipmentId: e.id }); setShowAllocationForm(true); }} style={{ padding: "6px 12px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Allocate</button>
                      )}
                      {e.status === "allocated" && (
                        <button onClick={() => handleCheckin(e.id)} style={{ padding: "6px 12px", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Check In</button>
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