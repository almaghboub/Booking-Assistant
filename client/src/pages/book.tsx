import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ChevronRight, ChevronLeft, Clock, CheckCircle2, Calendar, User, Phone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import type { Doctor, Service } from "@shared/schema";

const patientSchema = z.object({
  patientName: z.string().min(2, "Name must be at least 2 characters"),
  patientPhone: z.string().min(8, "Please enter a valid phone number"),
  notes: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

const STEPS = ["Doctor", "Service", "Date & Time", "Your Details", "Confirm"];
const CLINIC_ID = "clinic-1";

function TimeSlotGrid({ slots, selected, onSelect }: {
  slots: string[];
  selected: string | null;
  onSelect: (slot: string) => void;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No available slots for this date</p>;
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
  const [step, setStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { patientName: "", patientPhone: "", notes: "" },
  });

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery<Doctor[]>({
    queryKey: ["/api/public/doctors", CLINIC_ID],
    queryFn: () => fetch(`/api/public/doctors?clinicId=${CLINIC_ID}`).then(r => r.json()),
  });

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
    onSuccess: async (res) => {
      const body = await res.json();
      setBookedAppointment(body);
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
            <h2 className="text-xl font-bold text-foreground mb-2">Appointment Requested!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your appointment has been submitted and is pending confirmation.
            </p>
            <div className="bg-muted rounded-lg p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Doctor</span>
                <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium text-foreground">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{format(new Date(selectedDate + "T00:00:00"), "MMMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium text-foreground">{selectedTime}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You will receive confirmation via WhatsApp at your provided number.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setStep(0);
                setSelectedDoctor(null);
                setSelectedService(null);
                setSelectedDate("");
                setSelectedTime(null);
                setIsSuccess(false);
                form.reset();
              }}
              data-testid="button-book-another"
            >
              Book Another Appointment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-sm">Rakaz Clinic</h1>
            <p className="text-xs text-muted-foreground">Online Appointment Booking</p>
          </div>
          <div className="ml-auto">
            <a href="/login" className="text-xs text-primary hover:underline underline-offset-2">Staff Login</a>
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
            <h2 className="text-xl font-bold text-foreground mb-1">Choose a Doctor</h2>
            <p className="text-sm text-muted-foreground mb-6">Select the doctor you'd like to see</p>
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
                    className={`p-4 rounded-lg border cursor-pointer hover-elevate transition-colors ${
                      selectedDoctor?.id === doc.id ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
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
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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
            <h2 className="text-xl font-bold text-foreground mb-1">Choose a Service</h2>
            <p className="text-sm text-muted-foreground mb-6">Select the service with <span className="font-medium text-foreground">{selectedDoctor?.name}</span></p>
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
                    className={`p-4 rounded-lg border cursor-pointer hover-elevate transition-colors ${
                      selectedService?.id === svc.id ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{svc.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{svc.duration} min
                          </span>
                          {svc.price && (
                            <span className="text-xs text-muted-foreground">${svc.price}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No services available for this doctor</p>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setStep(0)} data-testid="button-back-step1">
              <ChevronLeft className="w-4 h-4 mr-1" />Back
            </Button>
          </div>
        )}

        {/* Step 2: Choose Date & Time */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Choose Date & Time</h2>
            <p className="text-sm text-muted-foreground mb-6">Select when you'd like your appointment</p>

            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-3">Select a date</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {next7Days.slice(0, 14).map((date) => {
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
                      <span className="text-xs opacity-70">{format(d, "EEE")}</span>
                      <span className="font-semibold text-sm mt-0.5">{format(d, "d")}</span>
                      <span className="text-xs opacity-70">{format(d, "MMM")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="mb-6">
                <p className="text-sm font-medium text-foreground mb-3">Available times</p>
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
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} data-testid="button-back-step2">
                <ChevronLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <Button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
                data-testid="button-continue-step2"
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Patient Details */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Your Details</h2>
            <p className="text-sm text-muted-foreground mb-6">Enter your contact information</p>
            <form onSubmit={form.handleSubmit(() => setStep(4))} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="patientName">Full Name</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="patientName"
                    className="pl-9"
                    placeholder="Your full name"
                    data-testid="input-patient-name"
                    {...form.register("patientName")}
                  />
                </div>
                {form.formState.errors.patientName && (
                  <p className="text-xs text-destructive">{form.formState.errors.patientName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="patientPhone">Phone / WhatsApp Number</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="patientPhone"
                    className="pl-9"
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
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="Any special notes or requests"
                  data-testid="input-notes"
                  {...form.register("notes")}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setStep(2)} data-testid="button-back-step3">
                  <ChevronLeft className="w-4 h-4 mr-1" />Back
                </Button>
                <Button type="submit" data-testid="button-continue-step3">
                  Review Booking <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Confirm Appointment</h2>
            <p className="text-sm text-muted-foreground mb-6">Review your booking details before confirming</p>
            <Card className="mb-6">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />Doctor</span>
                  <span className="font-medium text-foreground">{selectedDoctor?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Specialty</span>
                  <span className="font-medium text-foreground">{selectedDoctor?.specialty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-foreground">{selectedService?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Duration</span>
                  <span className="font-medium text-foreground">{selectedService?.duration} min</span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Date & Time</span>
                  <span className="font-semibold text-foreground">
                    {format(new Date(selectedDate + "T00:00:00"), "MMM d, yyyy")} at {selectedTime}
                  </span>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Patient</span>
                    <span className="font-medium text-foreground">{form.getValues("patientName")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Phone</span>
                    <span className="font-medium text-foreground">{form.getValues("patientPhone")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                After booking, you'll receive a WhatsApp message to confirm your appointment. Reply YES to confirm or NO to cancel.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} data-testid="button-back-step4">
                <ChevronLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <Button
                onClick={form.handleSubmit(handleBook)}
                disabled={bookMutation.isPending}
                data-testid="button-confirm-booking"
              >
                {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
