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
import { formatDate, formatDateTime } from "../lib/utils";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number;
  status: string;
  eventId: string | null;
  eventTitle: string | null;
  notes: string | null;
}

export function Attendance() {
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    date: "",
    checkIn: "",
    checkOut: "",
    eventId: "",
    notes: "",
  });

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance", dateFilter],
    queryFn: () => api.get<AttendanceRecord[]>("/api/attendance", { params: { date: dateFilter } }).then((r) => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees?status=active").then((r) => r.data),
  });

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.get("/api/events?status=confirmed").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form) => api.post("/api/attendance", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof form }) => api.put(`/api/attendance/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setOpen(false);
      setEditing(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/attendance/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const resetForm = () => {
    setForm({ employeeId: "", date: dateFilter, checkIn: "", checkOut: "", eventId: "", notes: "" });
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (record: AttendanceRecord) => {
    setEditing(record);
    setForm({
      employeeId: record.employeeId,
      date: record.date,
      checkIn: record.checkIn || "",
      checkOut: record.checkOut || "",
      eventId: record.eventId || "",
      notes: record.notes || "",
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
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">Track crew check-in/out</p>
        </div>
        <div className="flex items-center gap-4">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-48" />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Log Attendance</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Attendance" : "Log Attendance"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Employee" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
              <option value="" disabled>Select employee</option>
              {employees?.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </Select>
            <Input type="date" label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <div className="grid grid-cols-2 gap-4">
              <Input type="time" label="Check In" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              <Input type="time" label="Check Out" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
            </div>
            <Select label="Event (optional)" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}>
              <option value="" disabled>No event</option>
              {events?.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </Select>
            <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Update" : "Save"}
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
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.employeeName}</TableCell>
                  <TableCell>{formatDate(record.date)}</TableCell>
                  <TableCell>{record.checkIn ? formatDateTime(record.checkIn) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{record.checkOut ? formatDateTime(record.checkOut) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{record.hoursWorked.toFixed(2)} hrs</TableCell>
                  <TableCell>{record.eventTitle || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === "present" ? "success" : record.status === "absent" ? "destructive" : "secondary"}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(record)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this record?")) deleteMutation.mutate(record.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!attendance || attendance.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No attendance records for this date</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}