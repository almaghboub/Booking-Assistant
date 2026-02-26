import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, TrendingUp, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  no_show: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
  pending_confirmation: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: todayAppts = [], isLoading: apptLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/appointments/today"],
  });

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Today's Appointments</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats?.todayCount ?? 0}</p>
                  </div>
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-4.5 h-4.5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Patients</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats?.patientCount ?? 0}</p>
                  </div>
                  <div className="w-9 h-9 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Users className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Confirmed Today</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats?.confirmedToday ?? 0}</p>
                  </div>
                  <div className="w-9 h-9 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">This Month</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stats?.monthCount ?? 0}</p>
                  </div>
                  <div className="w-9 h-9 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">Today's Schedule</CardTitle>
          <Badge variant="secondary" data-testid="text-today-count">{todayAppts.length} appointments</Badge>
        </CardHeader>
        <CardContent>
          {apptLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Clock className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No appointments today</p>
              <p className="text-xs text-muted-foreground mt-1">Appointments for today will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayAppts.map((appt: any) => (
                <div
                  key={appt.id}
                  data-testid={`row-appointment-${appt.id}`}
                  className="flex items-center gap-4 p-3 rounded-md bg-muted/50"
                >
                  <div className="text-center w-14 shrink-0">
                    <p className="text-sm font-bold text-foreground">{appt.time}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{appt.patientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{appt.serviceName} — {appt.doctorName}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[appt.status]}`}>
                    {statusLabels[appt.status] ?? appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
