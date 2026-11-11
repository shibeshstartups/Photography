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
import { Plus, Pencil, Trash2, Eye, Copy, Share2, Search, Image as ImageIcon } from "lucide-react";

interface MediaItem {
  id: string;
  projectId: string;
  projectTitle: string;
  albumId: string | null;
  albumName: string | null;
  filename: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  accessCode: string | null;
  isPublic: boolean;
  createdAt: string;
}

export function Media() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    albumId: "",
    filename: "",
    type: "photo",
    size: "",
    width: "",
    height: "",
    isPublic: false,
  });

  const { data: media, isLoading } = useQuery({
    queryKey: ["media", search, filterType],
    queryFn: () => api.get<MediaItem[]>("/api/media", { params: { search, type: filterType !== "all" ? filterType : undefined } }).then((r) => r.data),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get("/api/projects").then((r) => r.data),
  });

  const { data: albums } = useQuery({
    queryKey: ["albums"],
    queryFn: () => api.get("/api/media/albums").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form) => api.post("/api/media", values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["media"] }); setOpen(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof form }) => api.put(`/api/media/${id}`, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["media"] }); setOpen(false); setEditing(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/media/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });

  const resetForm = () => setForm({ projectId: "", albumId: "", filename: "", type: "photo", size: "", width: "", height: "", isPublic: false });

  const openCreate = () => { setEditing(null); resetForm(); setOpen(true); };

  const openEdit = (item: MediaItem) => {
    setEditing(item);
    setForm({
      projectId: item.projectId,
      albumId: item.albumId || "",
      filename: item.filename,
      type: item.type,
      size: item.size.toString(),
      width: item.width?.toString() || "",
      height: item.height?.toString() || "",
      isPublic: item.isPublic,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (editing) updateMutation.mutate({ id: editing.id, values: form }); else createMutation.mutate(form); };

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert("Access code copied!");
  };

  const generateShareUrl = (code: string) => {
    return `${window.location.origin}/portal?code=${code}`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground mt-1">Manage media references and client access</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Media</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 max-w-xs">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search media..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 px-0" />
        </div>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
          <option value="all">All Types</option>
          <option value="photo">Photo</option>
          <option value="video">Video</option>
          <option value="raw">RAW</option>
          <option value="document">Document</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Album</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {media?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium truncate max-w-xs">{item.filename}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.projectTitle}</TableCell>
                  <TableCell>{item.albumName || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{item.type}</Badge>
                  </TableCell>
                  <TableCell>{item.width && item.height ? `${item.width}×${item.height}` : "—"}</TableCell>
                  <TableCell>{(item.size / 1024 / 1024).toFixed(2)} MB</TableCell>
                  <TableCell>
                    {item.accessCode && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{item.accessCode}</span>
                        <Button variant="ghost" size="icon" onClick={() => copyAccessCode(item.accessCode!)}><Copy className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(generateShareUrl(item.accessCode!))}><Share2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                    {item.isPublic && <Badge variant="success" className="text-xs">Public</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="View" onClick={() => {}}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!media || media.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No media items found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Media" : "Add Media Reference"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
              <option value="" disabled>Select project</option>
              {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
            <Select label="Album" value={form.albumId} onChange={(e) => setForm({ ...form, albumId: e.target.value })}>
              <option value="" disabled>No album</option>
              {albums?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Input label="Filename" value={form.filename} onChange={(e) => setForm({ ...form, filename: e.target.value })} required />
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="photo">Photo</option>
              <option value="video">Video</option>
              <option value="raw">RAW</option>
              <option value="document">Document</option>
            </Select>
            <div className="grid grid-cols-3 gap-4">
              <Input type="number" label="Size (bytes)" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} required />
              <Input type="number" label="Width" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} />
              <Input type="number" label="Height" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
              <label htmlFor="isPublic">Public access (for client portal)</label>
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