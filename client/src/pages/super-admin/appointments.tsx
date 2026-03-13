import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Calendar, Building2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending_confirmation: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  no_show: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  pending_payment: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

export default function SuperAdminAppointments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: appointments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/super/appointments"],
  });

  const filtered = appointments.filter(a => {
    const matchSearch = !search ||
      a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      a.clinicName?.toLowerCase().includes(search.toLowerCase()) ||
      a.doctorName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">{appointments.length} total across all clinics</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search patient, doctor, clinic..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending_confirmation">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(appt => (
            <div key={appt.id} data-testid={`row-appt-${appt.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{appt.patientName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{appt.clinicName}</span>
                    <span>·</span>
                    <span>{appt.doctorName}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{appt.date} {appt.time}</span>
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[appt.status] || ""}`}>
                {appt.status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No appointments found</div>
          )}
        </div>
      )}
    </div>
  );
}
