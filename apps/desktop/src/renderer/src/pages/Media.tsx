import React, { useState, useEffect } from "react";

export function Media() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ projectId: "", title: "", type: "photo", storageLocationId: "", filePath: "", fileSize: "", mimeType: "", width: "", height: "", duration: "", checksum: "", metadata: "" });
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterProject, setFilterProject] = useState("");

  useEffect(() => {
    loadMedia();
    loadProjects();
    loadLocations();
  }, [filterType, filterProject]);

  async function loadMedia() {
    try {
      const result = await window.electronAPI.media.list({ projectId: filterProject || undefined, type: filterType || undefined, limit: 100 });
      setItems(result.items);
    } catch (error) {
      console.error("Failed to load media:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const result = await window.electronAPI.projects.list({ limit: 100 });
      setProjects(result.items);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  }

  async function loadLocations() {
    try {
      const result = await window.electronAPI.media.listLocations({ limit: 100 });
      setLocations(result.items);
    } catch (error) {
      console.error("Failed to load storage locations:", error);
    }
  }

  async function handleCreate() {
    try {
      await window.electronAPI.media.create(formData);
      setShowForm(false);
      setFormData({ projectId: "", title: "", type: "photo", storageLocationId: "", filePath: "", fileSize: "", mimeType: "", width: "", height: "", duration: "", checksum: "", metadata: "" });
      loadMedia();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const typeIcons: Record<string, string> = {
    photo: "📷",
    video: "🎬",
    audio: "🎵",
    document: "📄",
    raw: "📦",
    other: "📎",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Media Library</h1>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", minWidth: "200px" }}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
            <option value="">All Types</option>
            <option value="photo">Photo</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="raw">Raw</option>
            <option value="document">Document</option>
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Media</button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 16px" }}>Add Media Reference</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project</label>
              <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select project (optional)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Title *</label>
              <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Bride portrait 001" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Type *</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="raw">Raw</option>
                <option value="document">Document</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Storage Location</label>
              <select value={formData.storageLocationId} onChange={(e) => setFormData({ ...formData, storageLocationId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                <option value="">Select location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.location_type})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>File Path *</label>
              <input value={formData.filePath} onChange={(e) => setFormData({ ...formData, filePath: e.target.value })} placeholder="/media/projects/PRJ-2024-0001/IMG_001.jpg" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>File Size (bytes)</label>
              <input type="number" value={formData.fileSize} onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })} placeholder="25485760" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>MIME Type</label>
              <input value={formData.mimeType} onChange={(e) => setFormData({ ...formData, mimeType: e.target.value })} placeholder="image/jpeg" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Width</label>
              <input type="number" value={formData.width} onChange={(e) => setFormData({ ...formData, width: e.target.value })} placeholder="9504" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Height</label>
              <input type="number" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} placeholder="6336" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Duration (seconds)</label>
              <input type="number" step="0.01" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="120.5" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Checksum (SHA256)</label>
              <input value={formData.checksum} onChange={(e) => setFormData({ ...formData, checksum: e.target.value })} placeholder="a1b2c3d4..." style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontFamily: "monospace", fontSize: "12px" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Metadata (JSON)</label>
              <textarea value={formData.metadata} onChange={(e) => setFormData({ ...formData, metadata: e.target.value })} placeholder='{"camera": "Sony A7R IV", "lens": "85mm f/1.4", "iso": 100, "aperture": "f/1.4", "shutter": "1/200"}' rows={3} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc", fontFamily: "monospace", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Media</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No media files yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Preview</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Title</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Type</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Project</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Size</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Dimensions</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Location</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px" }}>
                    <span style={{ fontSize: "24px" }}>{typeIcons[m.type] || "📎"}</span>
                  </td>
                  <td style={{ padding: "16px", fontWeight: 500, color: "#f8fafc" }}>{m.title}</td>
                  <td style={{ padding: "16px", color: "#94a3b8", textTransform: "capitalize" }}>{m.type}</td>
                  <td style={{ padding: "16px", color: "#e2e8f0", fontSize: "13px" }}>{m.projectId || "-"}</td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontFamily: "monospace", fontSize: "12px" }}>{formatFileSize(m.file_size)}</td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontFamily: "monospace", fontSize: "12px" }}>{m.width && m.height ? `${m.width}×${m.height}` : m.duration ? `${m.duration}s` : "-"}</td>
                  <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px" }}>{m.storageLocationId || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}