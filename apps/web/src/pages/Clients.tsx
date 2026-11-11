import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/Dialog";
import { formatDate } from "../lib/utils";
import { Plus, Pencil, Trash2, Mail, Phone, MapPin, Search } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  status: string;
  notes: string | null;
  totalProjects: number;
  totalSpent: number;
  createdAt: string;
  contacts: Contact[];
}

const emptyForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  notes: "",
};

export function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contacts, setContacts] = useState<Partial<Contact>[]>([]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => api.get<Client[]>("/api/clients", { params: { search } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post("/api/clients", { ...values, contacts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setForm(emptyForm);
      setContacts([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      api.put(`/api/clients/${id}`, { ...values, contacts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setContacts([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/clients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setContacts([]);
    setOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name,
      company: client.company || "",
      email: client.email,
      phone: client.phone || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      postalCode: client.postalCode || "",
      country: client.country || "",
      notes: client.notes || "",
    });
    setContacts(client.contacts?.map((c) => ({ ...c })) || []);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage clients and contacts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Client" : "New Client"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                <Input type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <Input label="Postal Code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Additional Contacts</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setContacts([...contacts, {}])}>
                    <Plus className="h-3 w-3 mr-1" /> Add Contact
                  </Button>
                </div>
                {contacts.map((contact, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                    <Input
                      placeholder="Name"
                      value={contact.name || ""}
                      onChange={(e) => {
                        const newContacts = [...contacts];
                        newContacts[idx] = { ...contact, name: e.target.value };
                        setContacts(newContacts);
                      }}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={contact.email || ""}
                      onChange={(e) => {
                        const newContacts = [...contacts];
                        newContacts[idx] = { ...contact, email: e.target.value };
                        setContacts(newContacts);
                      }}
                    />
                    <Input
                      placeholder="Phone"
                      value={contact.phone || ""}
                      onChange={(e) => {
                        const newContacts = [...contacts];
                        newContacts[idx] = { ...contact, phone: e.target.value };
                        setContacts(newContacts);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={contact.isPrimary || false}
                        onChange={(e) => {
                          const newContacts = [...contacts];
                          newContacts[idx] = { ...contact, isPrimary: e.target.checked };
                          setContacts(newContacts);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-xs">Primary</span>
                      <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 max-w-xs">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 px-0" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients?.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="font-medium">{client.name}</div>
                    {client.company && <div className="text-xs text-muted-foreground">{client.company}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{[client.city, client.state].filter(Boolean).join(", ") || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{client.totalProjects || 0}</TableCell>
                  <TableCell>${(client.totalSpent || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(client)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this client?")) deleteMutation.mutate(client.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!clients || clients.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No clients found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}