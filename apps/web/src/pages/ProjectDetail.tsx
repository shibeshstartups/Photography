import { useState } from "react";
import { useParams, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { formatDate } from "../lib/utils";
import { Trash2, Eye } from "lucide-react";
import { Plus, Pencil } from "lucide-react";

interface ProjectDetail {
  id: string;
  projectNumber: string;
  title: string;
  description: string | null;
  clientId: string;
  clientName: string;
  type: string;
  status: string;
  startDate: string;
  dueDate: string | null;
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  segments?: any[];
}

export function ProjectDetail() {
  const { id } = useParams();
  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.get(`/api/projects/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {project.title} {'#' + project.projectNumber}
          </h1>
          <p className="text-muted-foreground mt-1">
            {project.clientName} • {project.status}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Back to projects"><Eye className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Project Number</p>
              <p className="font-medium">{project.projectNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{project.type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">
                <Badge variant={project.status === "completed" ? "success" : project.status === "active" ? "default" : "secondary"}>
                  {project.status.replace(/_/g, " ")}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Client</p>
              <p className="font-medium">{project.clientName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Amount</p>
              <p className="font-medium">{formatCurrency(project.totalAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Status</p>
              <p className="font-medium">
                <Badge variant={project.paymentStatus === "paid" ? "success" : "secondary"}>
                  {project.paymentStatus}
                </Badge>
              </p>
            </div>
          </div>

          {project.description && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">{project.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-foreground">Related Events</h2>
        {project.segments?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {project.segments.map((seg: any) => (
              <div key={seg.id} className="p-3 border rounded-lg bg-muted/50">
                <div className="text-sm capitalize">{seg.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {seg.startTime} - {seg.endTime || "—"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-4">No events associated with this project</p>
        )}
      </div>
    </div>
  );
}