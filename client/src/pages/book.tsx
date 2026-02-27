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
import { Stethoscope, ChevronLeft, ChevronRight, Clock, CheckCircle2, Calendar, User, Phone, ArrowRight } from "lucide-react";
import logoPath from "@assets/8747CEA0-6F16-4305-99C7-871EBFEC5EDF_1772227362124.png";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import type { Doctor, Service } from "@shared/schema";

const patientSchema = z.object({
  patientName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  patientPhone: z.string().min(8, "يرجى إدخال رقم هاتف صحيح"),
  notes: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

const STEPS = ["الطبيب", "الخدمة", "التاريخ والوقت", "بياناتك", "التأكيد"];
const CLINIC_ID = "clinic-1";

function TimeSlotGrid({ slots, selected, onSelect }: {
  slots: string[];
  selected: string | null;
  onSelect: (slot: string) => void;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">لا توجد مواعيد متاحة لهذا التاريخ</p>;
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

  const [step, setStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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
    onSuccess: async () => {
      setIsSuccess(true);
    },
  });

  const next7Days = Array.from({ length: 14 }, (_, i) => {
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
            <h2 className="text-xl font-bold text-foreground mb-2">تم طلب الموعد!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              موعدك قيد الانتظار. ستصلك رسالة واتساب قريباً للتأكيد.
            </p>
            <div className="bg-muted rounded-lg p-4 text-right space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
                <span className="text-muted-foreground">الطبيب</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{selectedService?.name}</span>
                <span className="text-muted-foreground">الخدمة</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{format(new Date(selectedDate + "T00:00:00"), "d MMMM yyyy", { locale: ar })}</span>
                <span className="text-muted-foreground">التاريخ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{selectedTime}</span>
                <span className="text-muted-foreground">الوقت</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              أجب بـ <strong>نعم</strong> للتأكيد أو <strong>لا</strong> للإلغاء عند وصول رسالة واتساب.
            </p>
            <div className="flex gap-3">
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full">العودة للرئيسية</Button>
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
                حجز آخر
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* الرأس */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Button size="icon" variant="ghost" className="shrink-0">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <img src={logoPath} alt="Mawid logo" className="w-10 h-10 object-contain shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">Mawid</p>
              {selectedDoctor && step > 0 ? (
                <p className="text-xs text-muted-foreground">حجز مع {selectedDoctor.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">حجز موعد عبر الإنترنت</p>
              )}
            </div>
          </div>
          <Link href="/login">
            <span className="text-xs text-primary hover:underline underline-offset-2">دخول الموظفين</span>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* مؤشر الخطوات */}
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

        {/* الخطوة 0: اختر الطبيب */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">اختر طبيباً</h2>
            <p className="text-sm text-muted-foreground mb-6">حدد الطبيب الذي تريد زيارته</p>
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
                      <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* الخطوة 1: اختر الخدمة */}
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
                <Badge variant="secondary" className="mr-auto text-xs">محدد</Badge>
              </div>
            )}
            <h2 className="text-xl font-bold text-foreground mb-1">اختر خدمة</h2>
            <p className="text-sm text-muted-foreground mb-6">
              حدد الخدمة مع <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
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
                            <Clock className="w-3 h-3" />{svc.duration} دقيقة
                          </span>
                          {svc.price && (
                            <span className="text-xs text-muted-foreground">{svc.price} د.ل</span>
                          )}
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">لا توجد خدمات متاحة لهذا الطبيب</p>
                )}
              </div>
            )}
            {!preselectedDoctorId && (
              <Button variant="ghost" size="sm" className="mt-4 gap-1" onClick={() => setStep(0)} data-testid="button-back-step1">
                رجوع <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* الخطوة 2: اختر التاريخ والوقت */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">اختر التاريخ والوقت</h2>
            <p className="text-sm text-muted-foreground mb-6">حدد موعد زيارتك</p>

            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-3">اختر تاريخاً</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {next7Days.map((date) => {
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
                      <span className="text-xs opacity-70">{format(d, "EEE", { locale: ar })}</span>
                      <span className="font-semibold text-sm mt-0.5">{format(d, "d")}</span>
                      <span className="text-xs opacity-70">{format(d, "MMM", { locale: ar })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="mb-6">
                <p className="text-sm font-medium text-foreground mb-3">الأوقات المتاحة</p>
                {loadingSlots ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />)}
                  </div>
                ) : (
                  <TimeSlotGrid slots={slots} selected={selectedTime} onSelect={setSelectedTime} />
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} data-testid="button-back-step2" className="gap-1">
                رجوع <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
                data-testid="button-continue-step2"
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> متابعة
              </Button>
            </div>
          </div>
        )}

        {/* الخطوة 3: البيانات الشخصية */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">بياناتك</h2>
            <p className="text-sm text-muted-foreground mb-6">أدخل معلومات التواصل</p>
            <form onSubmit={form.handleSubmit(() => setStep(4))} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="patientName">الاسم الكامل</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="patientName" className="pr-9" placeholder="اسمك الكامل" data-testid="input-patient-name" {...form.register("patientName")} />
                </div>
                {form.formState.errors.patientName && (
                  <p className="text-xs text-destructive">{form.formState.errors.patientName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="patientPhone">رقم الهاتف / واتساب</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="patientPhone" className="pr-9" placeholder="+218 91 234 5678" data-testid="input-patient-phone" {...form.register("patientPhone")} />
                </div>
                {form.formState.errors.patientPhone && (
                  <p className="text-xs text-destructive">{form.formState.errors.patientPhone.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                <Input id="notes" placeholder="أي ملاحظات أو طلبات خاصة" data-testid="input-notes" {...form.register("notes")} />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setStep(2)} data-testid="button-back-step3" className="gap-1">
                  رجوع <ChevronRight className="w-4 h-4" />
                </Button>
                <Button type="submit" data-testid="button-continue-step3" className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> مراجعة الحجز
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* الخطوة 4: التأكيد */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">تأكيد الموعد</h2>
            <p className="text-sm text-muted-foreground mb-6">راجع تفاصيل حجزك قبل التأكيد</p>
            <Card className="mb-6">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
                  <span className="text-muted-foreground flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />الطبيب</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedDoctor?.specialty}</span>
                  <span className="text-muted-foreground">التخصص</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedService?.name}</span>
                  <span className="text-muted-foreground">الخدمة</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{selectedService?.duration} دقيقة</span>
                  <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />المدة</span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">
                    {format(new Date(selectedDate + "T00:00:00"), "d MMM yyyy", { locale: ar })} — {selectedTime}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />التاريخ والوقت</span>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{form.getValues("patientName")}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" />المريض</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{form.getValues("patientPhone")}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />الهاتف</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                ستصلك رسالة واتساب لتأكيد موعدك. أجب بـ <strong>نعم</strong> للتأكيد أو <strong>لا</strong> للإلغاء.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} data-testid="button-back-step4" className="gap-1">
                رجوع <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => form.handleSubmit(handleBook)()}
                disabled={bookMutation.isPending}
                data-testid="button-confirm-booking"
                className="gap-1"
              >
                {bookMutation.isPending ? "جارٍ الحجز..." : "تأكيد الحجز"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
