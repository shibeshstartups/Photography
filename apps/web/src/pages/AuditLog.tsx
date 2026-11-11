import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { formatDateTime } from "../lib/utils";
import { Shield, Search } from "lucide-react";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, any> | null;
  userName: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  deviceName: string | null;
  createdAt: string;
}

export function AuditLog() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: auditEntries, isLoading } = useQuery({
    queryKey: ["audit", search, entityFilter, actionFilter],
    queryFn: () =>
      api.get<AuditEntry[]>("/api/audit", {
        params: {
          search,
          entityType: entityFilter !== "all" ? entityFilter : undefined,
          action: actionFilter !== "all" ? actionFilter : undefined,
        },
      }).then((r) => r.data),
  });

  const entities = ["project", "client", "employee", "event", "assignment", "attendance", "invoice", "payment", "expense", "equipment", "media", "notification", "user", "device", "config"];
  const actions = ["create", "update", "delete", "login", "logout", "sync", "access", "status_change", "export"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Immutable trail of all system activity</p>
        </div>
        <Badge variant="outline"><Shield className="h-3 w-3 mr-1" />Admin Only</Badge>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 max-w-xs">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search audit entries..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 px-0" />
        </div>
        <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-48">
          <option value="all">All Entities</option>
          {entities.map(e => <option key={e} value={e}>{e}</option>)}
        </Select>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-48">
          <option value="all">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditEntries?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{entry.userName || "System"}</div>
                    <div className="text-xs text-muted-foreground">{entry.userEmail || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{entry.entityType}</Badge>
                    <span className="text-xs text-muted-foreground ml-2 font-mono">{entry.entityId?.slice(0, 8)}...</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.action === "create" ? "success"
                        : entry.action === "delete" ? "destructive"
                        : entry.action === "login" || entry.action === "logout" ? "warning"
                        : "secondary"
                      }
                      className="text-xs"
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.changes && Object.keys(entry.changes).length > 0 ? (
                      <div className="max-w-md">
                        <div className="text-xs font-medium mb-1">Changed fields:</div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(entry.changes).slice(0, 4).map(([key, value]) => (
                            <span key={key} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {key}: {String(value).slice(0, 30)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!auditEntries || auditEntries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit entries found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}