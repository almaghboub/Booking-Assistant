import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, Phone, MoreHorizontal, CheckCircle, XCircle, UserX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_confirmation: { label: "قيد الانتظار", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  confirmed: { label: "مؤكد", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { label: "مكتمل", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "ملغي", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  no_show: { label: "لم يحضر", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export default function AdminAppointments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const { toast } = useToast();

  const { data: appointments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/appointments", statusFilter, dateFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFilter) params.set("date", dateFilter);
      return fetch(`/api/admin/appointments?${params}`).then(r => r.json());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "تم تحديث الموعد" });
    },
  });

  const filtered = appointments.filter(a =>
    !search ||
    a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    a.patientPhone?.includes(search) ||
    a.doctorName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">المواعيد</h1>
        <p className="text-sm text-muted-foreground mt-0.5">إدارة جميع مواعيد العيادة</p>
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="البحث عن مريض أو طبيب..."
            className="pr-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-appointments"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="select-status-filter">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending_confirmation">قيد الانتظار</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
            <SelectItem value="no_show">لم يحضر</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-40"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          data-testid="input-date-filter"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>مسح التاريخ</Button>
        )}
      </div>

      {/* قائمة المواعيد */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">جميع المواعيد</CardTitle>
          <span className="text-sm text-muted-foreground">{filtered.length} نتيجة</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">لا توجد مواعيد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((appt: any) => (
                <div
                  key={appt.id}
                  data-testid={`row-appointment-${appt.id}`}
                  className="flex items-center gap-4 p-3 rounded-md border border-border bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{appt.patientName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[appt.status]?.className}`}>
                        {statusConfig[appt.status]?.label ?? appt.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {appt.date} — {appt.time}
                      </span>
                      <span className="text-xs text-muted-foreground">{appt.doctorName}</span>
                      <span className="text-xs text-muted-foreground">{appt.serviceName}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{appt.patientPhone}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-actions-${appt.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => updateMutation.mutate({ id: appt.id, status: "confirmed" })}
                        data-testid={`button-confirm-${appt.id}`}
                      >
                        <CheckCircle className="w-4 h-4 ml-2 text-blue-500" />تأكيد
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateMutation.mutate({ id: appt.id, status: "completed" })}
                        data-testid={`button-complete-${appt.id}`}
                      >
                        <CheckCircle className="w-4 h-4 ml-2 text-green-500" />تمييز كمكتمل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateMutation.mutate({ id: appt.id, status: "no_show" })}
                        data-testid={`button-noshow-${appt.id}`}
                      >
                        <UserX className="w-4 h-4 ml-2 text-gray-500" />تمييز كغياب
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateMutation.mutate({ id: appt.id, status: "cancelled" })}
                        className="text-destructive"
                        data-testid={`button-cancel-${appt.id}`}
                      >
                        <XCircle className="w-4 h-4 ml-2" />إلغاء
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
