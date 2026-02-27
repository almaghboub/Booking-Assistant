import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, CheckCircle, Bell, User, Phone, Share2, Copy, Check, PhoneIncoming, Plus, CalendarDays, Link2, Unlink } from "lucide-react";
import { format, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Service } from "@shared/schema";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_confirmation: { label: "قيد الانتظار", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  confirmed: { label: "مؤكد", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { label: "مكتمل", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "ملغي", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  no_show: { label: "لم يحضر", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const phoneBookingSchema = z.object({
  patientName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  patientPhone: z.string().min(8, "يرجى إدخال رقم هاتف صحيح"),
  serviceId: z.string().min(1, "يرجى اختيار خدمة"),
  date: z.string().min(1, "يرجى اختيار تاريخ"),
  time: z.string().min(1, "يرجى اختيار وقت"),
  notes: z.string().optional(),
});

type PhoneBookingForm = z.infer<typeof phoneBookingSchema>;

const CLINIC_ID = "clinic-1";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [arrivedDialogOpen, setArrivedDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendarConnected") === "1") {
      toast({ title: "تم ربط تقويم Google!", description: "ستتزامن مواعيدك تلقائياً." });
      window.history.replaceState({}, "", "/doctor/dashboard");
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/calendar/status"] });
    }
    if (params.get("calendarError") === "1") {
      toast({ title: "فشل ربط التقويم", description: "يرجى المحاولة مرة أخرى.", variant: "destructive" });
      window.history.replaceState({}, "", "/doctor/dashboard");
    }
  }, []);

  const { data: calendarStatus } = useQuery<{ connected: boolean; calendarId: string | null; googleConfigured: boolean }>({
    queryKey: ["/api/doctor/calendar/status"],
  });

  const disconnectCalendarMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/doctor/calendar/disconnect", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/calendar/status"] });
      toast({ title: "تم قطع اتصال تقويم Google" });
    },
  });

  const bookingLink = user?.doctorId
    ? `${window.location.origin}/book?doctor=${user.doctorId}`
    : "";

  const { data: todayAppts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/doctor/appointments/today"],
  });

  const { data: weekAppts = [] } = useQuery<any[]>({
    queryKey: ["/api/doctor/appointments/week"],
  });

  const { data: myServices = [] } = useQuery<Service[]>({
    queryKey: ["/api/public/services", user?.doctorId],
    queryFn: () => fetch(`/api/public/services?clinicId=${CLINIC_ID}&doctorId=${user?.doctorId}`).then(r => r.json()),
    enabled: !!user?.doctorId,
  });

  const form = useForm<PhoneBookingForm>({
    resolver: zodResolver(phoneBookingSchema),
    defaultValues: { patientName: "", patientPhone: "", serviceId: "", date: "", time: "", notes: "" },
  });

  const watchedDate = form.watch("date");
  const watchedServiceId = form.watch("serviceId");

  const { data: availableSlots = [], isLoading: loadingSlots } = useQuery<string[]>({
    queryKey: ["/api/public/slots", user?.doctorId, watchedDate, watchedServiceId],
    queryFn: () => fetch(`/api/public/slots?doctorId=${user?.doctorId}&date=${watchedDate}&serviceId=${watchedServiceId}`).then(r => r.json()),
    enabled: !!user?.doctorId && !!watchedDate && !!watchedServiceId,
  });

  const next14Days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i + 1);
    return { value: format(d, "yyyy-MM-dd"), label: format(d, "EEE، d MMM", { locale: ar }) };
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/doctor/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "تم تحديث الموعد" });
    },
  });

  const phoneBookingMutation = useMutation({
    mutationFn: (data: PhoneBookingForm) =>
      apiRequest("POST", "/api/doctor/appointments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "تم إنشاء الحجز", description: "تم إضافة الحجز الهاتفي وتأكيده." });
      form.reset();
      setBookingDialogOpen(false);
    },
    onError: () => {
      toast({ title: "فشل إنشاء الحجز", variant: "destructive" });
    },
  });

  const arrivedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/doctor/arrived", {}),
    onSuccess: () => {
      setArrivedDialogOpen(false);
      toast({ title: "تم إشعار المرضى", description: "تم إشعار جميع المرضى المؤكدين بوصول الطبيب." });
    },
  });

  const confirmedToday = todayAppts.filter(a => a.status === "confirmed").length;
  const completedToday = todayAppts.filter(a => a.status === "completed").length;

  const handleCopyLink = async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      toast({ title: "تم نسخ الرابط!", description: "شاركه مع مرضاك." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "فشل النسخ", description: "يرجى نسخ الرابط يدوياً.", variant: "destructive" });
    }
  };

  const onSubmitPhoneBooking = (data: PhoneBookingForm) => {
    phoneBookingMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      {/* الرأس */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جدول مواعيدي</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setBookingDialogOpen(true)}
            className="gap-2"
            data-testid="button-phone-booking"
          >
            <PhoneIncoming className="w-4 h-4" />
            حجز هاتفي
          </Button>
          <Button
            onClick={() => setArrivedDialogOpen(true)}
            className="bg-green-600 dark:bg-green-700 text-white border-0 gap-2"
            data-testid="button-doctor-arrived"
          >
            <Bell className="w-4 h-4" />
            الطبيب وصل
          </Button>
        </div>
      </div>

      {/* رابط الحجز */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">رابط حجزك</p>
                <p className="text-xs text-muted-foreground">شارك مع مرضاك على وسائل التواصل — يحجزون مباشرةً معك</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div
                className="flex-1 sm:w-72 min-w-0 px-3 py-2 rounded-md bg-background border border-border text-xs text-muted-foreground truncate font-mono"
                data-testid="text-booking-link"
              >
                {bookingLink || "جارٍ التحميل..."}
              </div>
              <Button
                size="sm"
                variant={copied ? "secondary" : "default"}
                onClick={handleCopyLink}
                disabled={!bookingLink}
                className="shrink-0 gap-1.5"
                data-testid="button-copy-booking-link"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "تم النسخ!" : "نسخ"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مزامنة تقويم Google */}
      <Card className={calendarStatus?.connected ? "border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10" : "border-border"}>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${calendarStatus?.connected ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"}`}>
                <CalendarDays className={`w-4 h-4 ${calendarStatus?.connected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">تقويم Google</p>
                {calendarStatus?.connected ? (
                  <p className="text-xs text-blue-600 dark:text-blue-400">متصل — تتزامن المواعيد تلقائياً</p>
                ) : (
                  <p className="text-xs text-muted-foreground">اربط لمزامنة المواعيد مع تقويم Google</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {calendarStatus?.connected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnectCalendarMutation.mutate()}
                  disabled={disconnectCalendarMutation.isPending}
                  className="gap-1.5 text-red-600 hover:text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                  data-testid="button-disconnect-calendar"
                >
                  <Unlink className="w-3.5 h-3.5" />قطع الاتصال
                </Button>
              ) : calendarStatus?.googleConfigured ? (
                <Button
                  size="sm"
                  onClick={() => { window.location.href = "/api/doctor/calendar/connect"; }}
                  className="gap-1.5"
                  data-testid="button-connect-calendar"
                >
                  <Link2 className="w-3.5 h-3.5" />ربط تقويم Google
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground italic">OAuth غير مُعد — راجع إعدادات المدير</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* إحصاءات اليوم */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-foreground">{todayAppts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">إجمالي اليوم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{confirmedToday}</p>
            <p className="text-xs text-muted-foreground mt-0.5">مؤكد</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedToday}</p>
            <p className="text-xs text-muted-foreground mt-0.5">مكتمل</p>
          </CardContent>
        </Card>
      </div>

      {/* تبويبات المواعيد */}
      <Tabs defaultValue="today">
        <TabsList data-testid="tabs-schedule">
          <TabsTrigger value="today" data-testid="tab-today">اليوم</TabsTrigger>
          <TabsTrigger value="week" data-testid="tab-week">هذا الأسبوع</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">مواعيد اليوم</CardTitle>
              <Badge variant="secondary">{todayAppts.length} إجمالي</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
              ) : todayAppts.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد مواعيد اليوم</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setBookingDialogOpen(true)}>
                    <Plus className="w-4 h-4" />إضافة حجز هاتفي
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayAppts.map((appt: any) => (
                    <div
                      key={appt.id}
                      data-testid={`row-appt-${appt.id}`}
                      className="flex items-center gap-4 p-3 rounded-md border border-border bg-card"
                    >
                      <div className="text-center w-14 shrink-0">
                        <p className="text-sm font-bold text-foreground">{appt.time}</p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-muted-foreground">{appt.patientName?.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{appt.patientName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{appt.serviceName}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{appt.patientPhone}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[appt.status]?.className}`}>
                          {statusConfig[appt.status]?.label}
                        </span>
                        {appt.status === "confirmed" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateMutation.mutate({ id: appt.id, status: "completed" })}
                            data-testid={`button-complete-${appt.id}`}
                            disabled={updateMutation.isPending}
                            className="gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />منجز
                          </Button>
                        )}
                        {appt.status === "confirmed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateMutation.mutate({ id: appt.id, status: "no_show" })}
                            data-testid={`button-noshow-${appt.id}`}
                            disabled={updateMutation.isPending}
                          >
                            غياب
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">مواعيد هذا الأسبوع</CardTitle>
            </CardHeader>
            <CardContent>
              {weekAppts.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد مواعيد هذا الأسبوع</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {weekAppts.map((appt: any) => (
                    <div
                      key={appt.id}
                      data-testid={`row-week-appt-${appt.id}`}
                      className="flex items-center gap-4 p-3 rounded-md border border-border bg-card"
                    >
                      <div className="text-center w-20 shrink-0">
                        <p className="text-xs text-muted-foreground">{format(new Date(appt.date + "T00:00:00"), "EEE", { locale: ar })}</p>
                        <p className="text-sm font-bold text-foreground">{format(new Date(appt.date + "T00:00:00"), "d MMM", { locale: ar })}</p>
                        <p className="text-xs text-muted-foreground">{appt.time}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{appt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{appt.serviceName}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[appt.status]?.className}`}>
                        {statusConfig[appt.status]?.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── نافذة الحجز الهاتفي ── */}
      <Dialog open={bookingDialogOpen} onOpenChange={(open) => { setBookingDialogOpen(open); if (!open) form.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneIncoming className="w-5 h-5 text-primary" />
              الحجز الهاتفي
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitPhoneBooking)} className="space-y-4 pt-1">

            <div className="space-y-1.5">
              <Label htmlFor="phone-patient-name">اسم المريض</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone-patient-name"
                  className="pr-9"
                  placeholder="الاسم الكامل"
                  data-testid="input-phone-patient-name"
                  {...form.register("patientName")}
                />
              </div>
              {form.formState.errors.patientName && (
                <p className="text-xs text-destructive">{form.formState.errors.patientName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone-patient-phone">الهاتف / واتساب</Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone-patient-phone"
                  className="pr-9"
                  placeholder="+218 91 234 5678"
                  data-testid="input-phone-patient-phone"
                  {...form.register("patientPhone")}
                />
              </div>
              {form.formState.errors.patientPhone && (
                <p className="text-xs text-destructive">{form.formState.errors.patientPhone.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>الخدمة</Label>
              <Select
                value={form.watch("serviceId")}
                onValueChange={(val) => { form.setValue("serviceId", val); form.setValue("time", ""); }}
              >
                <SelectTrigger data-testid="select-phone-service">
                  <SelectValue placeholder="اختر خدمة" />
                </SelectTrigger>
                <SelectContent>
                  {myServices.map(svc => (
                    <SelectItem key={svc.id} value={svc.id} data-testid={`option-service-${svc.id}`}>
                      {svc.name} ({svc.duration} دقيقة)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.serviceId && (
                <p className="text-xs text-destructive">{form.formState.errors.serviceId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Select
                value={form.watch("date")}
                onValueChange={(val) => { form.setValue("date", val); form.setValue("time", ""); }}
              >
                <SelectTrigger data-testid="select-phone-date">
                  <SelectValue placeholder="اختر تاريخاً" />
                </SelectTrigger>
                <SelectContent>
                  {next14Days.map(d => (
                    <SelectItem key={d.value} value={d.value} data-testid={`option-date-${d.value}`}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>فترة الموعد</Label>
              {loadingSlots ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : availableSlots.length === 0 && watchedDate && watchedServiceId ? (
                <p className="text-xs text-muted-foreground py-2">لا توجد مواعيد متاحة لهذا التاريخ</p>
              ) : (
                <Select
                  value={form.watch("time")}
                  onValueChange={(val) => form.setValue("time", val)}
                  disabled={!watchedDate || !watchedServiceId}
                >
                  <SelectTrigger data-testid="select-phone-time">
                    <SelectValue placeholder="اختر وقتاً" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map(slot => (
                      <SelectItem key={slot} value={slot} data-testid={`option-slot-${slot}`}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.time && (
                <p className="text-xs text-destructive">{form.formState.errors.time.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Input placeholder="أي ملاحظات..." data-testid="input-phone-notes" {...form.register("notes")} />
            </div>

            <div className="flex justify-start gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setBookingDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={phoneBookingMutation.isPending} data-testid="button-confirm-phone-booking">
                {phoneBookingMutation.isPending ? "جارٍ الحجز..." : "تأكيد الحجز"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── نافذة إشعار وصول الطبيب ── */}
      <Dialog open={arrivedDialogOpen} onOpenChange={setArrivedDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-green-600" />
              إشعار وصول الطبيب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              سيتم إرسال رسالة واتساب لجميع المرضى المؤكدين اليوم لإعلامهم بوصولك.
            </p>
            <p className="text-sm font-medium text-foreground">
              {confirmedToday} مريض مؤكد سيتلقى الإشعار.
            </p>
            <div className="flex justify-start gap-3">
              <Button variant="ghost" onClick={() => setArrivedDialogOpen(false)}>إلغاء</Button>
              <Button
                className="bg-green-600 dark:bg-green-700 text-white border-0 gap-2"
                onClick={() => arrivedMutation.mutate()}
                disabled={arrivedMutation.isPending}
                data-testid="button-confirm-arrived"
              >
                <Bell className="w-4 h-4" />
                {arrivedMutation.isPending ? "جارٍ الإرسال..." : "إرسال إشعار الوصول"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
