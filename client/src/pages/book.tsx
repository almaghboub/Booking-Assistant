import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ChevronLeft, ChevronRight, Clock, CheckCircle2, Calendar, User, Phone, ArrowRight, ArrowLeft, CreditCard, Lock } from "lucide-react";
import arLogoPath from "@assets/F1C71113-6C7B-4F07-9F7B-D8BEB9011ADA_1772231296978.png";
import enLogoPath from "@assets/45A1E150-36A4-404D-9C46-272B6E73972F_1772233514083.png";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import type { Doctor, Service } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";

const patientSchema = z.object({
  patientName: z.string().min(2, "Name must be at least 2 characters"),
  patientPhone: z.string().min(8, "Please enter a valid phone number"),
  notes: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

const CLINIC_ID = "clinic-1";

function LanguageToggle() {
  const { t, toggleLanguage } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      title={t("flagSwitchTitle")}
      data-testid="button-language-toggle-book"
      className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
    >
      {t("flagSwitch")}
    </button>
  );
}

function TimeSlotGrid({ slots, selected, onSelect, noSlotsMsg }: {
  slots: string[];
  selected: string | null;
  onSelect: (slot: string) => void;
  noSlotsMsg: string;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{noSlotsMsg}</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot}
          onClick={() => onSelect(slot)}
          data-testid={`button-slot-${slot}`}
          className={`px-3 py-2 text-sm rounded-md border text-center transition-colors ${
            selected === slot
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover-elevate"
          }`}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}

export default function BookingPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedDoctorId = params.get("doctor");
  const { t, language } = useLanguage();
  const logoPath = language === "en" ? enLogoPath : arLogoPath;
  const dateLocale = language === "en" ? enUS : ar;
  const isRtl = language === "ar";
  const BackChevron = isRtl ? ChevronRight : ChevronLeft;
  const ForwardChevron = isRtl ? ChevronLeft : ChevronRight;
  const HomeArrow = isRtl ? ArrowRight : ArrowLeft;

  const STEPS: string[] = t("book_steps");

  const [step, setStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<string | null>(null);
  const [payingNow, setPayingNow] = useState(false);

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { patientName: "", patientPhone: "", notes: "" },
  });

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery<Doctor[]>({
    queryKey: ["/api/public/doctors", CLINIC_ID],
    queryFn: () => fetch(`/api/public/doctors?clinicId=${CLINIC_ID}`).then(r => r.json()),
  });

  useEffect(() => {
    if (preselectedDoctorId && doctors.length > 0 && !selectedDoctor) {
      const doc = doctors.find(d => d.id === preselectedDoctorId);
      if (doc) {
        setSelectedDoctor(doc);
        setStep(1);
      }
    }
  }, [preselectedDoctorId, doctors]);

  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/public/services", selectedDoctor?.id],
    queryFn: () => fetch(`/api/public/services?clinicId=${CLINIC_ID}&doctorId=${selectedDoctor?.id}`).then(r => r.json()),
    enabled: !!selectedDoctor,
  });

  const { data: slots = [], isLoading: loadingSlots } = useQuery<string[]>({
    queryKey: ["/api/public/slots", selectedDoctor?.id, selectedDate, selectedService?.id],
    queryFn: () => fetch(`/api/public/slots?doctorId=${selectedDoctor?.id}&date=${selectedDate}&serviceId=${selectedService?.id}`).then(r => r.json()),
    enabled: !!selectedDoctor && !!selectedDate && !!selectedService,
  });

  const bookMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/public/appointments", data),
    onSuccess: async (result: any) => {
      if (result?.requiresPayment && result?.id) {
        setPendingAppointmentId(result.id);
        setPendingPaymentAmount(result.paymentAmount);
        setStep(5);
      } else {
        setIsSuccess(true);
      }
    },
  });

  const handleSimulatedPayment = async () => {
    if (!pendingAppointmentId) return;
    setPayingNow(true);
    try {
      await apiRequest("POST", `/api/public/appointments/${pendingAppointmentId}/payment-confirm`, {
        transactionId: `SIM-${Date.now()}`,
        gateway: "simulated",
      });
      setIsSuccess(true);
    } catch {
      // still show success for demo
      setIsSuccess(true);
    } finally {
      setPayingNow(false);
    }
  };

  const next14Days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i + 1);
    return format(d, "yyyy-MM-dd");
  });

  const handleBook = async (data: PatientForm) => {
    bookMutation.mutate({
      clinicId: CLINIC_ID,
      doctorId: selectedDoctor!.id,
      serviceId: selectedService!.id,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      date: selectedDate,
      time: selectedTime!,
      notes: data.notes || "",
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t("book_success_title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("book_success_sub")}</p>
            <div className={`bg-muted rounded-lg p-4 ${isRtl ? "text-right" : "text-left"} space-y-2 mb-6`}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
                <span className="text-muted-foreground">{t("book_success_doctor")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{selectedService?.name}</span>
                <span className="text-muted-foreground">{t("book_success_service")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{format(new Date(selectedDate + "T00:00:00"), "d MMMM yyyy", { locale: dateLocale })}</span>
                <span className="text-muted-foreground">{t("book_success_date")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{selectedTime}</span>
                <span className="text-muted-foreground">{t("book_success_time")}</span>
              </div>
            </div>
            <p
              className="text-xs text-muted-foreground mb-4"
              dangerouslySetInnerHTML={{ __html: t("book_success_wa_note") }}
            />
            <div className="flex gap-3">
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full">{t("book_go_home")}</Button>
              </Link>
              <Button
                className="flex-1"
                onClick={() => {
                  setStep(preselectedDoctorId ? 1 : 0);
                  setSelectedService(null);
                  setSelectedDate("");
                  setSelectedTime(null);
                  setIsSuccess(false);
                  form.reset();
                }}
                data-testid="button-book-another"
              >
                {t("book_another")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Button size="icon" variant="ghost" className="shrink-0">
                <HomeArrow className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/">
              <img src={logoPath} alt={t("logoAlt")} className="h-[90px] w-auto object-contain shrink-0 cursor-pointer" />
            </Link>
            <div>
              {selectedDoctor && step > 0 ? (
                <p className="text-xs text-muted-foreground">{t("book_booking_with")} {selectedDoctor.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("book_back_label")}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/login">
              <span className="text-xs text-primary hover:underline underline-offset-2">{t("book_staff_login")}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                  i < step ? "bg-primary border-primary text-primary-foreground" :
                  i === step ? "border-primary text-primary bg-primary/10" :
                  "border-border text-muted-foreground"
                }`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-foreground" : ""}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Choose Doctor */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">{t("book_step0_title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("book_step0_sub")}</p>
            {loadingDoctors ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => { setSelectedDoctor(doc); setStep(1); }}
                    data-testid={`card-doctor-${doc.id}`}
                    className="p-4 rounded-lg border border-border bg-card cursor-pointer hover-elevate transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {doc.photo ? (
                          <img src={doc.photo} alt={doc.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-semibold text-muted-foreground">{doc.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">{doc.specialty}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{doc.workingHours}
                        </p>
                      </div>
                      <ForwardChevron className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Choose Service */}
        {step === 1 && (
          <div>
            {preselectedDoctorId && selectedDoctor && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary text-sm">{selectedDoctor.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedDoctor.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedDoctor.specialty}</p>
                </div>
                <Badge variant="secondary" className="mr-auto text-xs">{t("book_step1_selected")}</Badge>
              </div>
            )}
            <h2 className="text-xl font-bold text-foreground mb-1">{t("book_step1_title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t("book_step1_sub")} <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
            </p>
            {loadingServices ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    onClick={() => { setSelectedService(svc); setStep(2); }}
                    data-testid={`card-service-${svc.id}`}
                    className="p-4 rounded-lg border border-border bg-card cursor-pointer hover-elevate transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{svc.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{svc.duration} {t("book_min")}
                          </span>
                          {svc.price && (
                            <span className="text-xs text-muted-foreground">{svc.price} {t("book_currency")}</span>
                          )}
                        </div>
                      </div>
                      <ForwardChevron className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">{t("book_step1_none")}</p>
                )}
              </div>
            )}
            {!preselectedDoctorId && (
              <Button variant="ghost" size="sm" className="mt-4 gap-1" onClick={() => setStep(0)} data-testid="button-back-step1">
                {t("book_back")} <BackChevron className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Choose Date & Time */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">{t("book_step2_title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("book_step2_sub")}</p>

            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-3">{t("book_pick_date")}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {next14Days.map((date) => {
                  const d = new Date(date + "T00:00:00");
                  return (
                    <button
                      key={date}
                      onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                      data-testid={`button-date-${date}`}
                      className={`flex flex-col items-center px-2 py-2.5 rounded-md border text-center text-xs transition-colors ${
                        selectedDate === date
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground hover-elevate"
                      }`}
                    >
                      <span className="text-xs opacity-70">{format(d, "EEE", { locale: dateLocale })}</span>
                      <span className="font-semibold text-sm mt-0.5">{format(d, "d")}</span>
                      <span className="text-xs opacity-70">{format(d, "MMM", { locale: dateLocale })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="mb-6">
                <p className="text-sm font-medium text-foreground mb-3">{t("book_available_slots")}</p>
                {loadingSlots ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />)}
                  </div>
                ) : (
                  <TimeSlotGrid
                    slots={slots}
                    selected={selectedTime}
                    onSelect={setSelectedTime}
                    noSlotsMsg={t("book_no_slots")}
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} data-testid="button-back-step2" className="gap-1">
                {t("book_back")} <BackChevron className="w-4 h-4" />
              </Button>
              <Button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
                data-testid="button-continue-step2"
                className="gap-1"
              >
                <ForwardChevron className="w-4 h-4" /> {t("book_continue")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Your Details */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">{t("book_step3_title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("book_step3_sub")}</p>
            <form onSubmit={form.handleSubmit(() => setStep(4))} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="patientName">{t("book_full_name")}</Label>
                <div className="relative">
                  <User className={`w-4 h-4 absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                  <Input
                    id="patientName"
                    className={isRtl ? "pr-9" : "pl-9"}
                    placeholder={t("book_name_placeholder")}
                    data-testid="input-patient-name"
                    {...form.register("patientName")}
                  />
                </div>
                {form.formState.errors.patientName && (
                  <p className="text-xs text-destructive">{form.formState.errors.patientName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="patientPhone">{t("book_phone")}</Label>
                <div className="relative">
                  <Phone className={`w-4 h-4 absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                  <Input
                    id="patientPhone"
                    className={isRtl ? "pr-9" : "pl-9"}
                    placeholder="+218 91 234 5678"
                    data-testid="input-patient-phone"
                    {...form.register("patientPhone")}
                  />
                </div>
                {form.formState.errors.patientPhone && (
                  <p className="text-xs text-destructive">{form.formState.errors.patientPhone.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">{t("book_notes")}</Label>
                <Input
                  id="notes"
                  placeholder={t("book_notes_placeholder")}
                  data-testid="input-notes"
                  {...form.register("notes")}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setStep(2)} data-testid="button-back-step3" className="gap-1">
                  {t("book_back")} <BackChevron className="w-4 h-4" />
                </Button>
                <Button type="submit" data-testid="button-continue-step3" className="gap-1">
                  <ForwardChevron className="w-4 h-4" /> {t("book_review")}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">{t("book_step4_title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("book_step4_sub")}</p>
            <Card className="mb-6">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
                  <span className="text-muted-foreground flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />{t("book_doctor")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedDoctor?.specialty}</span>
                  <span className="text-muted-foreground">{t("book_specialty")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedService?.name}</span>
                  <span className="text-muted-foreground">{t("book_service")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedService?.duration} {t("book_min")}</span>
                  <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{t("book_duration")}</span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">
                    {format(new Date(selectedDate + "T00:00:00"), "d MMM yyyy", { locale: dateLocale })} — {selectedTime}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{t("book_datetime")}</span>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{form.getValues("patientName")}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{t("book_patient")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{form.getValues("patientPhone")}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{t("book_phone_label")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 mb-6">
              <p
                className="text-xs text-blue-700 dark:text-blue-300"
                dangerouslySetInnerHTML={{ __html: t("book_whatsapp_note") }}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} data-testid="button-back-step4" className="gap-1">
                {t("book_back")} <BackChevron className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => form.handleSubmit(handleBook)()}
                disabled={bookMutation.isPending}
                data-testid="button-confirm-booking"
                className="gap-1"
              >
                {bookMutation.isPending ? t("book_confirming") : t("book_confirm")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Payment */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Payment Required</h2>
            <p className="text-sm text-muted-foreground mb-6">Complete your deposit to confirm the booking.</p>

            <Card className="mb-6">
              <CardContent className="pt-5 pb-5 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-foreground">{selectedService?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Doctor</span>
                  <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium text-foreground">{selectedDate} · {selectedTime}</span>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-foreground">Amount Due</span>
                    <span className="text-xl font-bold text-primary">{pendingPaymentAmount} LYD</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Deposit payment to secure your appointment.</p>
                </div>
              </CardContent>
            </Card>

            {/* Simulated payment form */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Card number: 4242 4242 4242 4242" disabled data-testid="input-card-number" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="MM / YY" disabled data-testid="input-card-expiry" />
                <Input placeholder="CVC" disabled data-testid="input-card-cvc" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>Payment demo — no real charges made. Click below to confirm.</span>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleSimulatedPayment}
              disabled={payingNow}
              data-testid="button-pay-now"
            >
              <CreditCard className="w-4 h-4" />
              {payingNow ? "Processing..." : `Pay ${pendingPaymentAmount} LYD & Confirm Booking`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
