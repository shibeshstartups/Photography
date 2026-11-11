import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { formatDate, formatDateTime } from "../lib/utils";
import { Plus, Pencil, Trash2, Clock, MapPin, Calendar as CalendarIcon } from "lucide-react";

interface Event {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  type: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  status: string;
  segments: any[];
}

export function Events() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    type: "shoot",
    description: "",
    startTime: "",
    endTime: "",
    location: "",
    status: "scheduled",
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.get<Event[]>("/api/events").then((r) => r.data),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get("/api/projects?status=active").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form) => api.post("/api/events", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      setForm({ projectId: "", title: "", type: "shoot", description: "", startTime: "", endTime: "", location: "", status: "scheduled" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof form }) => api.put(`/api/events/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ projectId: "", title: "", type: "shoot", description: "", startTime: "", endTime: "", location: "", status: "scheduled" });
    setOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditing(event);
    setForm({
      projectId: event.projectId,
      title: event.title,
      type: event.type,
      description: event.description || "",
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location || "",
      status: event.status,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, values: form });
    else createMutation.mutate(form);
  };

  const sortedEvents = events?.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">Schedule and manage photo shoots</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Event</Button>
      </div>

      <DialogWrapper open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
            <option value="" disabled>Select project</option>
            {projects?.map((project: any) => (
              <option key={project.id} value={project.id}>{project.title}</option>
            ))}
          </Select>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="shoot">Shoot</option>
            <option value="consultation">Consultation</option>
            <option value="setup">Setup</option>
            <option value="delivery">Delivery</option>
            <option value="meeting">Meeting</option>
          </Select>
          <Input label="Start Time" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
          <Input label="End Time" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogWrapper>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedEvents?.map((event) => (
          <Card key={event.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{event.projectTitle}</p>
                </div>
                <Badge variant={event.status === "completed" ? "success" : event.status === "confirmed" ? "default" : "secondary"}>
                  {event.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatDateTime(event.startTime)}</span>
                {event.endTime && <span className="text-muted-foreground">→ {formatDateTime(event.endTime)}</span>}
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{event.type}</span>
              </div>
              <div className="flex justify-end gap-1 pt-2 border-t">
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(event)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this event?")) deleteMutation.mutate(event.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!events || events.length === 0) && (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg">
            No events scheduled yet
          </div>
        )}
      </div>
    </div>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";

function DialogWrapper({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}