import { useState } from "react";
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
import { Calendar, Clock, CheckCircle, Bell, User, Phone, Share2, Copy, Check, PhoneIncoming, Plus } from "lucide-react";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Service } from "@shared/schema";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_confirmation: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  no_show: { label: "No Show", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const phoneBookingSchema = z.object({
  patientName: z.string().min(2, "Name must be at least 2 characters"),
  patientPhone: z.string().min(8, "Please enter a valid phone number"),
  serviceId: z.string().min(1, "Please select a service"),
  date: z.string().min(1, "Please select a date"),
  time: z.string().min(1, "Please select a time"),
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

  const bookingLink = user?.doctorId
    ? `${window.location.origin}/book?doctor=${user.doctorId}`
    : "";

  const today = format(new Date(), "yyyy-MM-dd");

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
    return { value: format(d, "yyyy-MM-dd"), label: format(d, "EEE, MMM d") };
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/doctor/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "Appointment updated" });
    },
  });

  const phoneBookingMutation = useMutation({
    mutationFn: (data: PhoneBookingForm) =>
      apiRequest("POST", "/api/doctor/appointments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "Booking created", description: "Phone booking has been added and confirmed." });
      form.reset();
      setBookingDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create booking", variant: "destructive" });
    },
  });

  const arrivedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/doctor/arrived", {}),
    onSuccess: () => {
      setArrivedDialogOpen(false);
      toast({ title: "Patients notified", description: "All confirmed patients have been notified that you've arrived." });
    },
  });

  const confirmedToday = todayAppts.filter(a => a.status === "confirmed").length;
  const completedToday = todayAppts.filter(a => a.status === "completed").length;

  const handleCopyLink = async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share this link with your patients." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    }
  };

  const onSubmitPhoneBooking = (data: PhoneBookingForm) => {
    phoneBookingMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
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
            Book by Phone
          </Button>
          <Button
            onClick={() => setArrivedDialogOpen(true)}
            className="bg-green-600 dark:bg-green-700 text-white border-0 gap-2"
            data-testid="button-doctor-arrived"
          >
            <Bell className="w-4 h-4" />
            Doctor Arrived
          </Button>
        </div>
      </div>

      {/* Shareable Booking Link */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Your Booking Link</p>
                <p className="text-xs text-muted-foreground">Share with patients on social media — they book directly with you</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div
                className="flex-1 sm:w-72 min-w-0 px-3 py-2 rounded-md bg-background border border-border text-xs text-muted-foreground truncate font-mono"
                data-testid="text-booking-link"
              >
                {bookingLink || "Loading…"}
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
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-foreground">{todayAppts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{confirmedToday}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedToday}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointments Tabs */}
      <Tabs defaultValue="today">
        <TabsList data-testid="tabs-schedule">
          <TabsTrigger value="today" data-testid="tab-today">Today</TabsTrigger>
          <TabsTrigger value="week" data-testid="tab-week">This Week</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">Today's Appointments</CardTitle>
              <Badge variant="secondary">{todayAppts.length} total</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
              ) : todayAppts.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No appointments today</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setBookingDialogOpen(true)}>
                    <Plus className="w-4 h-4" />Add Phone Booking
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
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Done
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
                            No Show
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
              <CardTitle className="text-base font-semibold">This Week's Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {weekAppts.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No appointments this week</p>
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
                        <p className="text-xs text-muted-foreground">{format(new Date(appt.date + "T00:00:00"), "EEE")}</p>
                        <p className="text-sm font-bold text-foreground">{format(new Date(appt.date + "T00:00:00"), "MMM d")}</p>
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

      {/* ── Phone Booking Dialog ── */}
      <Dialog open={bookingDialogOpen} onOpenChange={(open) => { setBookingDialogOpen(open); if (!open) form.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneIncoming className="w-5 h-5 text-primary" />
              Book by Phone
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitPhoneBooking)} className="space-y-4 pt-1">

            {/* Patient Name */}
            <div className="space-y-1.5">
              <Label htmlFor="phone-patient-name">Patient Name</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone-patient-name"
                  className="pl-9"
                  placeholder="Full name"
                  data-testid="input-phone-patient-name"
                  {...form.register("patientName")}
                />
              </div>
              {form.formState.errors.patientName && (
                <p className="text-xs text-destructive">{form.formState.errors.patientName.message}</p>
              )}
            </div>

            {/* Patient Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone-patient-phone">Phone / WhatsApp</Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone-patient-phone"
                  className="pl-9"
                  placeholder="+218 91 234 5678"
                  data-testid="input-phone-patient-phone"
                  {...form.register("patientPhone")}
                />
              </div>
              {form.formState.errors.patientPhone && (
                <p className="text-xs text-destructive">{form.formState.errors.patientPhone.message}</p>
              )}
            </div>

            {/* Service */}
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select
                value={form.watch("serviceId")}
                onValueChange={(val) => { form.setValue("serviceId", val); form.setValue("time", ""); }}
              >
                <SelectTrigger data-testid="select-phone-service">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {myServices.map(svc => (
                    <SelectItem key={svc.id} value={svc.id} data-testid={`option-service-${svc.id}`}>
                      {svc.name} ({svc.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.serviceId && (
                <p className="text-xs text-destructive">{form.formState.errors.serviceId.message}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Select
                value={form.watch("date")}
                onValueChange={(val) => { form.setValue("date", val); form.setValue("time", ""); }}
              >
                <SelectTrigger data-testid="select-phone-date">
                  <SelectValue placeholder="Select a date" />
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

            {/* Time */}
            <div className="space-y-1.5">
              <Label>Time Slot</Label>
              {!watchedDate || !watchedServiceId ? (
                <p className="text-xs text-muted-foreground py-1">Select a service and date first</p>
              ) : loadingSlots ? (
                <div className="h-9 bg-muted animate-pulse rounded-md" />
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No available slots for this date</p>
              ) : (
                <Select
                  value={form.watch("time")}
                  onValueChange={(val) => form.setValue("time", val)}
                >
                  <SelectTrigger data-testid="select-phone-time">
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map(slot => (
                      <SelectItem key={slot} value={slot} data-testid={`option-time-${slot}`}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.time && (
                <p className="text-xs text-destructive">{form.formState.errors.time.message}</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="phone-notes">Notes (optional)</Label>
              <Input
                id="phone-notes"
                placeholder="Reason for visit, special notes…"
                data-testid="input-phone-notes"
                {...form.register("notes")}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => { setBookingDialogOpen(false); form.reset(); }}
                data-testid="button-cancel-phone-booking"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={phoneBookingMutation.isPending}
                data-testid="button-submit-phone-booking"
              >
                <Plus className="w-4 h-4" />
                {phoneBookingMutation.isPending ? "Booking…" : "Confirm Booking"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Doctor Arrived Dialog */}
      <Dialog open={arrivedDialogOpen} onOpenChange={setArrivedDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Notify Patients</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-center text-foreground font-medium mb-2">Doctor Arrived — Send Notification</p>
            <p className="text-xs text-center text-muted-foreground mb-6">
              This will send a WhatsApp notification to all {confirmedToday} confirmed patients today:
              <br /><br />
              <em className="text-foreground">"The doctor has arrived. Please arrive 10 minutes early."</em>
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setArrivedDialogOpen(false)} data-testid="button-cancel-arrived">
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 dark:bg-green-700 text-white border-0"
                onClick={() => arrivedMutation.mutate()}
                disabled={arrivedMutation.isPending || confirmedToday === 0}
                data-testid="button-send-arrived"
              >
                {arrivedMutation.isPending ? "Sending..." : "Send Notification"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
