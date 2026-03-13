import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, DollarSign, TrendingUp, Activity } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function SuperAdminDashboard() {
  const { language } = useLanguage();
  const isRtl = language === "ar";

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/super/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  const planColors: Record<string, string> = {
    enterprise: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    basic: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <div className={`p-6 space-y-6 ${isRtl ? "rtl" : ""}`} dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">System-wide overview across all clinics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Clinics</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-clinics">{stats?.totalClinics ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Appointments</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-appointments">{stats?.totalAppointments ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-patients">{stats?.totalPatients ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-revenue">{stats?.totalRevenue ?? "0.00"} LYD</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Today Across All Clinics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">{stats?.todayAppointments ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">appointments scheduled today</p>
        </CardContent>
      </Card>

      {/* Clinic Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Clinic Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stats?.clinicStats ?? []).map((clinic: any) => (
              <div key={clinic.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{clinic.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-testid={`clinic-name-${clinic.id}`}>{clinic.name}</p>
                    <p className="text-xs text-muted-foreground">{clinic.appointmentCount} appts · {clinic.patientCount} patients</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[clinic.subscriptionPlan] || planColors.basic}`}>
                    {clinic.subscriptionPlan}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[clinic.subscriptionStatus] || ""}`}>
                    {clinic.subscriptionStatus}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{clinic.revenue} LYD</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
