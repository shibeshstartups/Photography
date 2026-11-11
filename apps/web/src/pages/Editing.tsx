import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { formatDate } from "../lib/utils";
import { Plus, Pencil, Trash2, Eye, RefreshCw } from "lucide-react";

const QC_STAGES = [
  { value: "CULLING", label: "Culling" },
  { value: "BASIC_EDIT", label: "Basic Edit" },
  { value: "COLOR_GRADE", label: "Color Grade" },
  { value: "RETOUCHING", label: "Retouching" },
  { value: "FINAL_REVIEW", label: "Final Review" },
  { value: "EXPORT", label: "Export" },
  { value: "DELIVERED", label: "Delivered" },
];

interface EditingTask {
  id: string;
  projectId: string;
  projectTitle: string;
  stage: string;
  assignedTo: string | null;
  assignedName: string | null;
  priority: string;
  totalFiles: number;
  completedFiles: number;
  notes: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function Editing() {
  const queryClient = useQueryClient();
  const [filterStage, setFilterStage] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTask | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    stage: "CULLING",
    assignedTo: "",
    priority: "normal",
    totalFiles: "",
    completedFiles: "0",
    notes: "",
    dueDate: "",
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["editing", filterStage],
    queryFn: () => api.get<EditingTask[]>("/api/editing", { params: { stage: filterStage !== "all" ? filterStage : undefined } }).then((r) => r.data),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get("/api/projects?status=active,in_progress").then((r) => r.data),
  });

  const { data: editors } = useQuery({
    queryKey: ["editors"],
    queryFn: () => api.get("/api/employees?role=editor,retoucher").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form) => api.post("/api/editing", values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["editing"] }); setOpen(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof form }) => api.put(`/api/editing/${id}`, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["editing"] }); setOpen(false); setEditing(null); resetForm(); },
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.post(`/api/editing/${id}/advance`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editing"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/editing/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editing"] }),
  });

  const resetForm = () => {
    setForm({ projectId: "", stage: "CULLING", assignedTo: "", priority: "normal", totalFiles: "", completedFiles: "0", notes: "", dueDate: "" });
  };

  const openCreate = () => { setEditing(null); resetForm(); setOpen(true); };

  const openEdit = (task: EditingTask) => {
    setEditing(task);
    setForm({
      projectId: task.projectId,
      stage: task.stage,
      assignedTo: task.assignedTo || "",
      priority: task.priority,
      totalFiles: task.totalFiles.toString(),
      completedFiles: task.completedFiles.toString(),
      notes: task.notes || "",
      dueDate: task.dueDate?.slice(0, 10) || "",
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, values: form });
    else createMutation.mutate(form);
  };

  const getNextStage = (currentStage: string) => {
    const idx = QC_STAGES.findIndex(s => s.value === currentStage);
    return idx < QC_STAGES.length - 1 ? QC_STAGES[idx + 1].value : null;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Post-Production</h1>
          <p className="text-muted-foreground mt-1">Manage editing workflow and QC stages</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Task</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="w-48">
          <option value="all">All Stages</option>
          {QC_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "New Editing Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
              <option value="" disabled>Select project</option>
              {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
            <Select label="QC Stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {QC_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select label="Assigned Editor" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              <option value="" disabled>Unassigned</option>
              {editors?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" label="Total Files" value={form.totalFiles} onChange={(e) => setForm({ ...form, totalFiles: e.target.value })} required />
              <Input type="number" label="Completed Files" value={form.completedFiles} onChange={(e) => setForm({ ...form, completedFiles: e.target.value })} />
            </div>
            <Input type="date" label="Due Date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks?.map((task) => {
          const progress = task.totalFiles > 0 ? Math.round((task.completedFiles / task.totalFiles) * 100) : 0;
          const nextStage = getNextStage(task.stage);
          return (
            <Card key={task.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{task.projectTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{QC_STAGES.find(s => s.value === task.stage)?.label || task.stage}</p>
                  </div>
                  <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "warning" : "secondary"}>
                    {task.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{task.completedFiles} / {task.totalFiles} ({progress}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {task.assignedName && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="font-medium">{task.assignedName}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Due: {formatDate(task.dueDate)}</span>
                  </div>
                )}
                <div className="flex gap-1 pt-2 border-t">
                  <Button variant="ghost" size="icon" aria-label="View" className="flex-1">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(task)} className="flex-1">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {nextStage && (
                    <Button variant="default" size="icon" aria-label="Advance Stage" onClick={() => advanceMutation.mutate({ id: task.id, stage: nextStage })} className="flex-1" disabled={progress < 100 && task.stage !== "CULLING"}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive flex-1" onClick={() => { if (confirm("Delete this task?")) deleteMutation.mutate(task.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(!tasks || tasks.length === 0) && (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg">
            No editing tasks found
          </div>
        )}
      </div>
    </div>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";