import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { formatDate, formatCurrency } from "../lib/utils";
import { Plus, Pencil, Trash2, Wrench, Package, Search } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  category: string;
  condition: string;
  status: string;
  location: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  assignedTo: string | null;
  assignedName: string | null;
}

export function Equipment() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({
    name: "",
    serialNumber: "",
    category: "camera",
    condition: "excellent",
    status: "available",
    location: "",
    purchaseDate: "",
    purchasePrice: "",
  });

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", search],
    queryFn: () => api.get<Equipment[]>("/api/equipment", { params: { search } }).then((r) => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees?status=active").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form) => api.post("/api/equipment", values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); setOpen(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof form }) => api.put(`/api/equipment/${id}`, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); setOpen(false); setEditing(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/equipment/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment"] }),
  });

  const resetForm = () => setForm({ name: "", serialNumber: "", category: "camera", condition: "excellent", status: "available", location: "", purchaseDate: "", purchasePrice: "" });

  const openCreate = () => { setEditing(null); resetForm(); setOpen(true); };

  const openEdit = (item: Equipment) => {
    setEditing(item);
    setForm({
      name: item.name,
      serialNumber: item.serialNumber || "",
      category: item.category,
      condition: item.condition,
      status: item.status,
      location: item.location || "",
      purchaseDate: item.purchaseDate?.slice(0, 10) || "",
      purchasePrice: item.purchasePrice?.toString() || "",
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (editing) updateMutation.mutate({ id: editing.id, values: form }); else createMutation.mutate(form); };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipment</h1>
          <p className="text-muted-foreground mt-1">Track gear inventory and maintenance</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Equipment</Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 max-w-xs">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search equipment..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 px-0" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {item.location && <div className="text-xs text-muted-foreground">{item.location}</div>}
                  </TableCell>
                  <TableCell>{item.serialNumber || "—"}</TableCell>
                  <TableCell className="capitalize">{item.category.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.condition}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "available" ? "success" : item.status === "in_use" ? "default" : item.status === "maintenance" ? "warning" : "secondary"}>
                      {item.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.assignedName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{formatCurrency(item.purchasePrice)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Maintenance" className="text-destructive hover:text-destructive">
                        <Wrench className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(item.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!equipment || equipment.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No equipment found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Serial Number" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="camera">Camera</option>
              <option value="lens">Lens</option>
              <option value="lighting">Lighting</option>
              <option value="audio">Audio</option>
              <option value="accessory">Accessory</option>
              <option value="computer">Computer</option>
              <option value="storage">Storage</option>
              <option value="other">Other</option>
            </Select>
            <Select label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="needs_repair">Needs Repair</option>
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </Select>
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" label="Purchase Date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              <Input type="number" step="0.01" label="Purchase Price" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}