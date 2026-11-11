import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { formatDate, formatCurrency } from "../lib/utils";
import { Plus, Pencil, Trash2, Eye, FileText, DollarSign, Receipt } from "lucide-react";

interface Invoice {
  id: string;
  projectId: string;
  projectTitle: string;
  invoiceNumber: string;
  clientName: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
}

interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  date: string;
  reference: string | null;
}

interface Expense {
  id: string;
  projectId: string;
  projectTitle: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
}

export function Finance() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("invoices");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({});

  const { data: invoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<Invoice[]>("/api/finance/invoices").then((r) => r.data),
  });

  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.get<Payment[]>("/api/finance/payments").then((r) => r.data),
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get<Expense[]>("/api/finance/expenses").then((r) => r.data),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get("/api/projects").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post(`/api/finance/${activeTab}`, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [activeTab] }); setOpen(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) => api.put(`/api/finance/${activeTab}/${id}`, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [activeTab] }); setOpen(false); setEditing(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/finance/${activeTab}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [activeTab] }),
  });

  const resetForm = () => setForm({ projectId: "", amount: "", status: "", date: "", dueDate: "", category: "", description: "", method: "", reference: "" });

  const openCreate = () => { setEditing(null); resetForm(); setOpen(true); };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (editing) updateMutation.mutate({ id: editing.id, values: form }); else createMutation.mutate(form); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground mt-1">Invoices, payments, and expenses</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices"><FileText className="h-4 w-4 mr-2" />Invoices</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="h-4 w-4 mr-2" />Payments</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="h-4 w-4 mr-2" />Expenses</TabsTrigger>
        </TabsList>

        {activeTab === "invoices" && (
          <TabsContent>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Invoice" : "New Invoice"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Select label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
                    <option value="" disabled>Select project</option>
                    {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.title} ({p.clientName})</option>)}
                  </Select>
                  <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  <div className="grid grid-cols-2 gap-4">
                    <Input type="date" label="Issue Date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required />
                    <Input type="date" label="Due Date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
                  </div>
                  <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? "Update" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices?.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.invoiceNumber}</TableCell>
                        <TableCell>{inv.projectTitle}</TableCell>
                        <TableCell>{inv.clientName}</TableCell>
                        <TableCell>{formatDate(inv.issueDate)}</TableCell>
                        <TableCell>{formatDate(inv.dueDate)}</TableCell>
                        <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                        <TableCell>{formatCurrency(inv.balance)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label="View" onClick={() => {}}> <Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setEditing(inv); setForm({ projectId: inv.projectId, amount: inv.totalAmount, issueDate: inv.issueDate.slice(0, 10), dueDate: inv.dueDate.slice(0, 10), status: inv.status }); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(inv.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {activeTab === "payments" && (
          <TabsContent>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Payment" : "Record Payment"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Select label="Invoice" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} required>
                    <option value="" disabled>Select invoice</option>
                    {invoices?.map((i: any) => <option key={i.id} value={i.id}>{i.invoiceNumber} - {formatCurrency(i.balance)}</option>)}
                  </Select>
                  <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  <Select label="Method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} required>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                    <option value="online">Online</option>
                  </Select>
                  <Input type="date" label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  <Input label="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? "Update" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.invoiceNumber}</TableCell>
                        <TableCell>{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                        <TableCell>{formatDate(p.date)}</TableCell>
                        <TableCell>{p.reference || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(p.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {activeTab === "expenses" && (
          <TabsContent>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "New Expense"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Select label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="" disabled>Select project (optional)</option>
                    {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </Select>
                  <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="equipment">Equipment</option>
                    <option value="travel">Travel</option>
                    <option value="studio">Studio Rental</option>
                    <option value="marketing">Marketing</option>
                    <option value="software">Software</option>
                    <option value="supplies">Supplies</option>
                    <option value="insurance">Insurance</option>
                    <option value="other">Other</option>
                  </Select>
                  <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                  <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  <Input type="date" label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? "Update" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses?.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.projectTitle || "—"}</TableCell>
                        <TableCell className="capitalize">{e.category.replace("_", " ")}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{formatCurrency(e.amount)}</TableCell>
                        <TableCell>{formatDate(e.date)}</TableCell>
                        <TableCell><Badge variant={e.status === "approved" ? "success" : "secondary"}>{e.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setEditing(e); setForm({ projectId: e.projectId || "", category: e.category, description: e.description, amount: e.amount, date: e.date.slice(0, 10), status: e.status }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(e.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}