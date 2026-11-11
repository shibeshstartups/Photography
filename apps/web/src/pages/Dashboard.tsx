import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Users, Calendar, FileText, CreditCard, Camera, Package, Clock, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalRevenue: number;
  teamMembers: number;
  upcomingEvents: number;
  pendingInvoices: number;
  mediaCount: number;
  equipmentIssues: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  client: string;
  status: string;
}

interface RecentProject {
  id: string;
  title: string;
  client: string;
  status: string;
  deadline: string;
}

export function Dashboard() {
  const { user } = useAuth();

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.get<DashboardStats>("/api/dashboard/stats").then(r => r.data),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch upcoming events
  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["dashboard", "upcomingEvents"],
    queryFn: () => api.get<UpcomingEvent[]>("/api/events/upcoming").then(r => r.data),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch recent projects
  const { data: recentProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["dashboard", "recentProjects"],
    queryFn: () => api.get<RecentProject[]>("/api/projects?limit=5&status=active").then(r => r.data),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = statsLoading || eventsLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const statsCards = [
    { title: "Total Projects", value: stats?.totalProjects || 0, icon: FileText, color: "text-blue-600" },
    { title: "Active Projects", value: stats?.activeProjects || 0, icon: TrendingUp, color: "text-green-600" },
    { title: "Revenue", value: `$${stats?.totalRevenue?.toLocaleString() || 0}`, icon: CreditCard, color: "text-purple-600" },
    { title: "Team Members", value: stats?.teamMembers || 0, icon: Users, color: "text-orange-600" },
    { title: "Upcoming Events", value: stats?.upcomingEvents || 0, icon: Calendar, color: "text-red-600" },
    { title: "Pending Invoices", value: stats?.pendingInvoices || 0, icon: AlertCircle, color: "text-yellow-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Events
            </CardTitle>
            <CardDescription>Next 10 scheduled events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingEvents?.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.date).toLocaleDateString()} • {event.client}
                  </p>
                </div>
                <Badge variant={event.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                  {event.status}
                </Badge>
              </div>
            ))}
            {(!upcomingEvents || upcomingEvents.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Projects
            </CardTitle>
            <CardDescription>Latest active projects and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProjects?.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm truncate">{project.title}</p>
                    <p className="text-xs text-muted-foreground">Client: {project.client}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={project.status === "completed" ? "default" : project.status === "in-progress" ? "default" : "secondary"}>
                      {project.status.replace("-", " ")}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Due: {new Date(project.deadline).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!recentProjects || recentProjects.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No recent projects</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-accent transition-colors">
              <Camera className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">New Photo Shoot</span>
            </button>
            <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-accent transition-colors">
              <CreditCard className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Create Invoice</span>
            </button>
            <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-accent transition-colors">
              <Users className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Assign Team</span>
            </button>
            <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-accent transition-colors">
              <Package className="h-8 w-8 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Log Equipment</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}