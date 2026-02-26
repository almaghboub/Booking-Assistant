import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Users, UserX, Clock } from "lucide-react";

const COLORS = ["hsl(210 85% 42%)", "hsl(195 75% 38%)", "hsl(225 70% 45%)", "hsl(180 65% 40%)", "hsl(240 60% 48%)"];

export default function AdminAnalytics() {
  const { data: analytics, isLoading } = useQuery<any>({ queryKey: ["/api/admin/analytics"] });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Appointment insights and trends</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const statusData = analytics?.statusBreakdown ?? [];
  const dailyData = analytics?.dailyVolume ?? [];
  const serviceData = analytics?.topServices ?? [];
  const peakHours = analytics?.peakHours ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Appointment insights and trends</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Appointments</p>
                <p className="text-2xl font-bold text-foreground mt-1">{analytics?.totalAppointments ?? 0}</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold text-foreground mt-1">{analytics?.totalPatients ?? 0}</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">No-Show Rate</p>
                <p className="text-2xl font-bold text-foreground mt-1">{analytics?.noShowRate ?? "0"}%</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Avg Daily Appts</p>
                <p className="text-2xl font-bold text-foreground mt-1">{analytics?.avgDaily ?? "0"}</p>
              </div>
              <div className="w-8 h-8 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Volume */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Daily Appointments (Last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(210 85% 42%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Appointment Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data yet</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                      {statusData.map((_: any, index: number) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((item: any, i: number) => (
                    <div key={item.status} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{item.status?.replace(/_/g, " ")}</span>
                      <span className="font-medium text-foreground ml-auto">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Most Booked Services</CardTitle>
          </CardHeader>
          <CardContent>
            {serviceData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={serviceData} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(195 75% 38%)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Peak Hours</CardTitle>
          </CardHeader>
          <CardContent>
            {peakHours.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={peakHours} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(210 85% 42%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
