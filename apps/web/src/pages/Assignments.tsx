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
import { formatDateTime } from "../lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Assignment {
  id: string;
  eventId: string;
  eventTitle: string;
  employeeId: string;
  employeeName: string;
  role: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
}

export function Assignments() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState({
    eventId: "",
    employeeId: "",
    role: "photographer",
    startTime: "",
    endTime: "",
    notes: "",
    status: "scheduled",
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get<Assignment[]>("/api/assignments").then((r) => r.data),
  });

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.get("/api/events?status=scheduled,confirmed").then((r) => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees?status=active").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form) => api.post("/api/assignments", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Assignment conflict detected. Please check for overlapping assignments.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof form }) => api.put(`/api/assignments/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Assignment conflict detected. Please check for overlapping assignments.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assignments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assignments"] }),
  });

  const resetForm = () => {
    setForm({ eventId: "", employeeId: "", role: "photographer", startTime: "", endTime: "", notes: "", status: "scheduled" });
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (assignment: Assignment) => {
    setEditing(assignment);
    setForm({
      eventId: assignment.eventId,
      employeeId: assignment.employeeId,
      role: assignment.role,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      notes: assignment.notes || "",
      status: assignment.status,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, values: form });
    else createMutation.mutate(form);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground mt-1">Schedule crew members to events</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Assignment</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Assignment" : "New Assignment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Event" value={form.eventId} onChange={(e) => {
              const event = events?.find((ev: any) => ev.id === e.target.value);
              setForm({ ...form, eventId: e.target.value, startTime: event?.startTime || "", endTime: event?.endTime || "" });
            }} required>
              <option value="" disabled>Select event</option>
              {events?.map((event: any) => (
                <option key={event.id} value={event.id}>{event.title} - {formatDateTime(event.startTime)}</option>
              ))}
            </Select>
            <Select label="Team Member" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
              <option value="" disabled>Select team member</option>
              {employees?.map((employee: any) => (
                <option key={employee.id} value={employee.id}>{employee.name} ({employee.role})</option>
              ))}
            </Select>
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="photographer">Photographer</option>
              <option value="assistant">Assistant</option>
              <option value="editor">Editor</option>
              <option value="retoucher">Retoucher</option>
              <option value="videographer">Videographer</option>
              <option value="second_shooter">Second Shooter</option>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Start Time" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
              <Input label="End Time" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
            </div>
            <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments?.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="font-medium">{assignment.employeeName}</div>
                  </TableCell>
                  <TableCell>{assignment.eventTitle}</TableCell>
                  <TableCell className="capitalize">{assignment.role}</TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDateTime(assignment.startTime)}</div>
                    <div className="text-xs text-muted-foreground">→ {formatDateTime(assignment.endTime)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={assignment.status === "confirmed" ? "success" : assignment.status === "completed" ? "default" : "secondary"}>
                      {assignment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(assignment)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this assignment?")) deleteMutation.mutate(assignment.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!assignments || assignments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No assignments found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}