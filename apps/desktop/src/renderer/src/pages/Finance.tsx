import React, { useState, useEffect } from "react";

export function Finance() {
  const [tab, setTab] = useState<"overview" | "quotations" | "invoices" | "payments" | "expenses">("overview");
  const [projects, setProjects] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ projectId: "", type: "quotation", amount: "", status: "draft", dueDate: "", notes: "" });

  useEffect(() => {
    loadProjects();
    loadAll();
  }, [tab]);

  async function loadProjects() {
    try {
      const result = await window.electronAPI.projects.list({ limit: 100 });
      setProjects(result.items);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      if (tab === "overview" || tab === "quotations") {
        const result = await window.electronAPI.finance.listQuotations({ limit: 100 });
        setQuotations(result.items);
      }
      if (tab === "overview" || tab === "invoices") {
        const result = await window.electronAPI.finance.listInvoices({ limit: 100 });
        setInvoices(result.items);
      }
      if (tab === "overview" || tab === "payments") {
        const result = await window.electronAPI.finance.listPayments({ limit: 100 });
        setPayments(result.items);
      }
      if (tab === "overview" || tab === "expenses") {
        const result = await window.electronAPI.finance.listExpenses({ limit: 100 });
        setExpenses(result.items);
      }
    } catch (error) {
      console.error("Failed to load finance data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      if (formData.type === "quotation") {
        await window.electronAPI.finance.createQuotation(formData);
      } else if (formData.type === "invoice") {
        await window.electronAPI.finance.createInvoice(formData);
      } else if (formData.type === "payment") {
        await window.electronAPI.finance.recordPayment(formData);
      } else if (formData.type === "expense") {
        await window.electronAPI.finance.createExpense(formData);
      }
      setShowForm(false);
      setFormData({ projectId: "", type: "quotation", amount: "", status: "draft", dueDate: "", notes: "" });
      loadAll();
    } catch (error: any) {
      alert(error.message);
    }
  }

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  if (tab === "overview") {
    const totalQuotations = quotations.reduce((sum, q) => sum + (q.total_amount || 0), 0);
    const totalInvoices = invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Finance</h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Total Quotations</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#3b82f6" }}>{formatCurrency(totalQuotations)}</div>
          </div>
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Total Invoiced</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#8b5cf6" }}>{formatCurrency(totalInvoices)}</div>
          </div>
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Payments Received</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#22c55e" }}>{formatCurrency(totalPayments)}</div>
          </div>
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Total Expenses</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#ef4444" }}>{formatCurrency(totalExpenses)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "16px" }}>
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>Recent Quotations</h3>
              <button onClick={() => setTab("quotations")} style={{ fontSize: "12px", color: "#3b82f6", background: "none", border: "none", cursor: "pointer" }}>View All</button>
            </div>
            <div style={{ maxHeight: "300px", overflow: "auto" }}>
              {quotations.slice(0, 5).map((q) => (
                <div key={q.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #334155" }}>
                  <div>
                    <div style={{ fontWeight: 500, color: "#f8fafc" }}>{q.quotation_number || q.id}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>{q.projectId}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, color: "#3b82f6" }}>{formatCurrency(q.total_amount || 0)}</div>
                    <div style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "#3b82f620", color: "#3b82f6", display: "inline-block" }}>{q.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>Recent Invoices</h3>
              <button onClick={() => setTab("invoices")} style={{ fontSize: "12px", color: "#8b5cf6", background: "none", border: "none", cursor: "pointer" }}>View All</button>
            </div>
            <div style={{ maxHeight: "300px", overflow: "auto" }}>
              {invoices.slice(0, 5).map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #334155" }}>
                  <div>
                    <div style={{ fontWeight: 500, color: "#f8fafc" }}>{i.invoice_number || i.id}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>{i.projectId}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, color: "#8b5cf6" }}>{formatCurrency(i.total_amount || 0)}</div>
                    <div style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "#8b5cf620", color: "#8b5cf6", display: "inline-block" }}>{i.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Common table rendering for list tabs
  const statusColors: Record<string, string> = {
    draft: "#64748b",
    sent: "#3b82f6",
    accepted: "#22c55e",
    rejected: "#ef4444",
    expired: "#f59e0b",
    paid: "#22c55e",
    partial: "#f59e0b",
    overdue: "#ef4444",
    cancelled: "#ef4444",
  };

  function renderTable(data: any[], columns: { key: string; header: string; render?: (row: any) => React.ReactNode }[]) {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #334155" }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid #334155" }}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: "16px" }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === "quotations") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Quotations</h1>
          <button onClick={() => { setFormData({ ...formData, type: "quotation" }); setShowForm(true); }} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>New Quotation</button>
        </div>

        {showForm && (
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <h2 style={{ margin: "0 0 16px" }}>New Quotation</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project *</label>
                <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Amount *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="50000" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Valid Until</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Create Quotation</button>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
          ) : quotations.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No quotations yet.</div>
          ) : (
            renderTable(quotations, [
              { key: "quotation_number", header: "Number", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#f8fafc" }}>{r.quotation_number || r.id}</span> },
              { key: "projectId", header: "Project" },
              { key: "total_amount", header: "Amount", render: (r) => <span style={{ fontWeight: 600, color: "#3b82f6" }}>{formatCurrency(r.total_amount || 0)}</span> },
              { key: "status", header: "Status", render: (r) => <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (statusColors[r.status] || "#64748b") + "20", color: statusColors[r.status] || "#64748b" }}>{r.status}</span> },
              { key: "valid_until", header: "Valid Until", render: (r) => r.valid_until ? new Date(r.valid_until).toLocaleDateString() : "-" },
            ])
          )}
        </div>
      </div>
    );
  }

  if (tab === "invoices") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Invoices</h1>
          <button onClick={() => { setFormData({ ...formData, type: "invoice" }); setShowForm(true); }} style={{ padding: "10px 20px", backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>New Invoice</button>
        </div>

        {showForm && (
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <h2 style={{ margin: "0 0 16px" }}>New Invoice</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project *</label>
                <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Amount *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="50000" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Due Date</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Create Invoice</button>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No invoices yet.</div>
          ) : (
            renderTable(invoices, [
              { key: "invoice_number", header: "Number", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#f8fafc" }}>{r.invoice_number || r.id}</span> },
              { key: "projectId", header: "Project" },
              { key: "total_amount", header: "Amount", render: (r) => <span style={{ fontWeight: 600, color: "#8b5cf6" }}>{formatCurrency(r.total_amount || 0)}</span> },
              { key: "status", header: "Status", render: (r) => <span style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: (statusColors[r.status] || "#64748b") + "20", color: statusColors[r.status] || "#64748b" }}>{r.status}</span> },
              { key: "due_date", header: "Due Date", render: (r) => r.due_date ? new Date(r.due_date).toLocaleDateString() : "-" },
            ])
          )}
        </div>
      </div>
    );
  }

  if (tab === "payments") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Payments</h1>
          <button onClick={() => { setFormData({ ...formData, type: "payment" }); setShowForm(true); }} style={{ padding: "10px 20px", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Record Payment</button>
        </div>

        {showForm && (
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <h2 style={{ margin: "0 0 16px" }}>Record Payment</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Invoice ID *</label>
                <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="">Select invoice</option>
                  {invoices.filter((i) => i.status !== "paid").map((i) => <option key={i.id} value={i.id}>{i.invoice_number} - {formatCurrency(i.total_amount || 0)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Amount *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="25000" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Method</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Date</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Record Payment</button>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
          ) : payments.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No payments yet.</div>
          ) : (
            renderTable(payments, [
              { key: "id", header: "ID", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#94a3b8" }}>{r.id.slice(0, 8)}...</span> },
              { key: "invoiceId", header: "Invoice" },
              { key: "amount", header: "Amount", render: (r) => <span style={{ fontWeight: 600, color: "#22c55e" }}>{formatCurrency(r.amount || 0)}</span> },
              { key: "status", header: "Method", render: (r) => <span style={{ color: "#94a3b8" }}>{r.status}</span> },
              { key: "payment_date", header: "Date", render: (r) => r.payment_date ? new Date(r.payment_date).toLocaleDateString() : "-" },
            ])
          )}
        </div>
      </div>
    );
  }

  if (tab === "expenses") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Expenses</h1>
          <button onClick={() => { setFormData({ ...formData, type: "expense" }); setShowForm(true); }} style={{ padding: "10px 20px", backgroundColor: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Expense</button>
        </div>

        {showForm && (
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "24px" }}>
            <h2 style={{ margin: "0 0 16px" }}>Add Expense</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Project</label>
                <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="">Select project (optional)</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} - {p.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Category</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }}>
                  <option value="equipment">Equipment</option>
                  <option value="travel">Travel</option>
                  <option value="accommodation">Accommodation</option>
                  <option value="meals">Meals</option>
                  <option value="software">Software</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Amount *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="5000" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Date</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Notes</label>
                <input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Expense description" style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f8fafc" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} style={{ padding: "10px 20px", backgroundColor: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Expense</button>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>Loading...</div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>No expenses yet.</div>
          ) : (
            renderTable(expenses, [
              { key: "id", header: "ID", render: (r) => <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#94a3b8" }}>{r.id.slice(0, 8)}...</span> },
              { key: "projectId", header: "Project", render: (r) => r.projectId || "-" },
              { key: "status", header: "Category", render: (r) => <span style={{ color: "#94a3b8" }}>{r.status}</span> },
              { key: "amount", header: "Amount", render: (r) => <span style={{ fontWeight: 600, color: "#ef4444" }}>{formatCurrency(r.amount || 0)}</span> },
              { key: "expense_date", header: "Date", render: (r) => r.expense_date ? new Date(r.expense_date).toLocaleDateString() : "-" },
              { key: "notes", header: "Notes", render: (r) => r.notes || "-" },
            ])
          )}
        </div>
      </div>
    );
  }

  return null;
}