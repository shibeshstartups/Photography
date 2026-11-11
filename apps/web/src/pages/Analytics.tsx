import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { formatCurrency, formatDate } from "../lib/utils";
import { TrendingUp, Users, DollarSign, Camera, Calendar, Package } from "lucide-react";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  teamMembers: number;
  upcomingEvents: number;
  mediaCount: number;
  equipmentIssues: number;
  recentProjects: any[];
  topClients: any[];
  revenueByMonth: any[];
  teamPerformance: any[];
  equipmentUtilization: any[];
  projectTypeBreakdown: any[];
}

export function Analytics() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.get<DashboardStats>("/api/dashboard/analytics").then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  const metrics = [
    { title: "Revenue (All Time)", value: formatCurrency(stats?.totalRevenue), icon: DollarSign, color: "text-green-600" },
    { title: "Pending Revenue", value: formatCurrency(stats?.pendingRevenue), icon: TrendingUp, color: "text-blue-600" },
    { title: "Overdue", value: formatCurrency(stats?.overdueRevenue), icon: DollarSign, color: "text-red-600" },
    { title: "Team Members", value: stats?.teamMembers || 0, icon: Users, color: "text-orange-600" },
    { title: "Media Assets", value: stats?.mediaCount || 0, icon: Camera, color: "text-purple-600" },
    { title: "Equipment Issues", value: stats?.equipmentIssues || 0, icon: Package, color: "text-yellow-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Business performance insights</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <metric.icon className={`h-5 w-5 ${metric.color} mb-3`} />
              <div className="text-xl font-bold">{metric.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{metric.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Month</CardTitle>
            <CardDescription>Monthly revenue trend</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.revenueByMonth?.length ? (
              <div className="space-y-3">
                {stats.revenueByMonth.slice(0, 12).reverse().map((m: any) => (
                  <div key={m.month} className="flex items-center gap-4">
                    <span className="text-sm w-20 shrink-0">{m.month}</span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary rounded" style={{ width: `${Math.min((m.revenue / Math.max(...stats.revenueByMonth.map((x: any) => x.revenue))) * 100, 100)}%` }} />
                    </div>
                    <span className="text-sm font-medium shrink-0 w-24 text-right">{formatCurrency(m.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No revenue data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Clients</CardTitle>
            <CardDescription>Highest spending clients</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.topClients?.length ? (
              <div className="space-y-3">
                {stats.topClients.map((client: any, idx: number) => (
                  <div key={client.id} className="flex items-center gap-4">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.totalProjects} projects</p>
                    </div>
                    <span className="font-medium text-sm">{formatCurrency(client.totalSpent)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No client data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}