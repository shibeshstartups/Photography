import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../lib/utils";
import { Bell, Check, CheckAll, Trash2, Eye, Mail } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean;
  createdAt: string;
}

export function Notifications() {
  const queryClient = useQueryClient();
  const [filterRead, setFilterRead] = useState("all");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", filterRead],
    queryFn: () => api.get<Notification[]>("/api/notifications", { params: { unread: filterRead === "unread" } }).then((r) => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const filtered = notifications?.filter(n => filterRead === "all" || (filterRead === "unread" && !n.read) || (filterRead === "read" && n.read));

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Your alerts and updates</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={unreadCount > 0 ? "default" : "secondary"}>{unreadCount} unread</Badge>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()}>
              <CheckAll className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {["all", "unread", "read"].map((filter) => (
          <Button
            key={filter}
            variant={filterRead === filter ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterRead(filter)}
            className={filter === "unread" && filterRead === "unread" ? "bg-destructive text-destructive-foreground" : undefined}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered?.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border-b flex items-start gap-3 transition-colors ${
                !notification.read ? "bg-muted/30" : ""
              } hover:bg-accent/50`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
                {notification.read && <div className="w-2 h-2 rounded-full bg-transparent border" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className={`font-medium ${!notification.read ? "" : "text-muted-foreground"}`}>
                      {notification.title}
                    </h4>
                    <p className={`text-sm mt-1 ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    {notification.data && Object.keys(notification.data).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {JSON.stringify(notification.data)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{notification.type}</Badge>
                    <span>{formatDateTime(notification.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!notification.read && (
                  <Button variant="ghost" size="icon" onClick={() => markReadMutation.mutate(notification.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {(!filtered || filtered.length === 0) && (
            <div className="text-center text-muted-foreground py-12">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>{filterRead === "unread" ? "No unread notifications" : "No notifications"}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}