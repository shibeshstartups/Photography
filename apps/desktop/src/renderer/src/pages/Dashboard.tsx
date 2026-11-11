import React, { useState, useEffect } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: { value: number; label: string };
}

function StatCard({ title, value, icon, color, trend }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          backgroundColor: color + "20",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </div>
        <div style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
          {value}
        </div>
        {trend && (
          <div style={{ fontSize: "12px", color: trend.value >= 0 ? "#34d399" : "#f87171", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>{trend.value >= 0 ? "↑" : "↓"}</span>
            <span>{Math.abs(trend.value)}%</span>
            <span style={{ color: "#64748b" }}>{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [overview, trend, events, activity] = await Promise.all([
        window.electronAPI.dashboard.overview(),
        window.electronAPI.dashboard.revenueTrend(),
        window.electronAPI.dashboard.upcomingEvents(5),
        window.electronAPI.dashboard.recentActivity(10),
      ]);
      setStats(overview);
      setRevenueTrend(trend);
      setUpcomingEvents(events);
      setRecentActivity(activity);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>Dashboard</h1>
        <button
          onClick={loadDashboard}
          style={{
            padding: "10px 20px",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        <StatCard title="Total Projects" value={stats?.totalProjects || 0} icon="📁" color="#3b82f6" />
        <StatCard title="Active Projects" value={stats?.activeProjects || 0} icon="🟢" color="#34d399" />
        <StatCard title="Clients" value={stats?.totalClients || 0} icon="👥" color="#8b5cf6" />
        <StatCard title="Crew Members" value={stats?.totalEmployees || 0} icon="👤" color="#f59e0b" />
        <StatCard title="Upcoming Events" value={stats?.upcomingEvents || 0} icon="📅" color="#ec4899" />
        <StatCard title="Pending Assignments" value={stats?.pendingAssignments || 0} icon="⏳" color="#f97316" />
        <StatCard title="Total Revenue" value={`₹${((stats?.totalRevenue || 0) / 100).toLocaleString()}`} icon="💰" color="#34d399" trend={{ value: 12, label: "vs last month" }} />
        <StatCard title="Net Profit" value={`₹${((stats?.netProfit || 0) / 100).toLocaleString()}`} icon="📈" color="#8b5cf6" trend={{ value: 8, label: "vs last month" }} />
      </div>

      {/* Charts & Lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Revenue Trend */}
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: "0 0 16px" }}>Revenue Trend (12 Months)</h2>
          <div style={{ height: "200px", display: "flex", alignItems: "flex-end", gap: "8px", paddingBottom: "16px" }}>
            {revenueTrend.map((month, i) => (
              <div key={month.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(4, (month.revenue / Math.max(...revenueTrend.map(m => m.revenue), 1)) * 160)}px`,
                    backgroundColor: "#3b82f6",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s ease",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#64748b" }}>{month.month.split("-")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: "0 0 16px" }}>Upcoming Events</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {upcomingEvents.length === 0 ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: "24px" }}>No upcoming events</div>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} style={{ padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{event.event_type}</div>
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>{event.project_title} ({event.project_id})</div>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: "#3b82f620",
                        color: "#3b82f6",
                        fontWeight: 500,
                      }}
                    >
                      {event.event_date}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {event.start_time} - {event.end_time} • {event.venue || "TBD"} • {event.client_name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: "0 0 16px" }}>Recent Activity</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {recentActivity.length === 0 ? (
            <div style={{ color: "#64748b", textAlign: "center", padding: "24px" }}>No recent activity</div>
          ) : (
            recentActivity.map((activity, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "#3b82f620",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                >
                  {activity.type === "project" && "📁"}
                  {activity.type === "payment" && "💰"}
                  {activity.type === "assignment" && "📋"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "#f8fafc" }}>
                    {activity.type === "project" && `New project: ${activity.name}`}
                    {activity.type === "payment" && `${activity.type} received: ${activity.name}`}
                    {activity.type === "assignment" && `New assignment: ${activity.name}`}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {new Date(activity.created_at).toLocaleString()}
                  </div>
                </div>
                {activity.amount && (
                  <div style={{ fontWeight: 600, color: "#34d399", fontSize: "14px" }}>
                    ₹{(activity.amount / 100).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}