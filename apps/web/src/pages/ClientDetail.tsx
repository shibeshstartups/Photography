import { useState } from "react";
import { useParams, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { formatDate } from "../lib/utils";
import { Trash2, Eye } from "lucide-react";
import { Plus, Pencil } from "lucide-react";

interface ClientDetail {
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
  contacts: any[];
  createdAt: string;
}

export function ClientDetail() {
  const { id } = useParams();
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => api.get(`/api/clients/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground mt-1">Client Details</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Back to clients"><Eye className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium text-primary">{client.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{client.phone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Company</p>
              <p className="font-medium">{client.company || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">
                <Badge variant={client.status === "active" ? "success" : client.status === "inactive" ? "destructive" : "secondary"}>
                  {client.status.replace(/_/g, " ")}
                </Badge>
              </p>
            </div>
          </div>

          {client.address && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Address</p>
              <p className="text-sm mt-1 break-all">{[client.address, [client.city, client.state].filter(Boolean).join(" "), client.postalCode, client.country].filter(Boolean).join(", ")}</p>
            </div>
          )}

          {client.notes && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Notes</p>
              <p className="text-sm mt-1 break-all">{client.notes}</p>
            </div>
          )}

          {client.contacts?.length && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Contacts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {client.contacts.map((contact: any, idx: number) => (
                  <div key={idx} className="p-2 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {contact.isPrimary && <Badge variant="success" className="text-xs">Primary</Badge>}
                      <span>{contact.name}</span>
                      <span className="text-xs text-muted-foreground ms-2">{contact.email || contact.phone || ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-foreground">Project History</h2>
        {client.totalProjects > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {/* Summary of projects would be listed here */}
            {Array.from({ length: Math.min(client.totalProjects, 5) }).map((_, i) => (
              <div key={i} className="p-3 border rounded-lg bg-muted/50 text-sm">
                <div className="font-medium">Project #{i + 1}</div>
                <div className="text-xs text-muted-foreground">{client.totalSpent > 0 ? `$${client.totalSpent.toLocaleString()}` : "—"}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-4">No projects associated with this client</p>
        )}
      </div>
    </div>
  );
}