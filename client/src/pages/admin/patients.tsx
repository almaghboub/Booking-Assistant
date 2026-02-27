import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, Phone, AlertTriangle, Calendar, Edit2, MoreHorizontal, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Patient } from "@shared/schema";

const editSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  notes: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function PatientEditDialog({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { fullName: patient.fullName, phone: patient.phone, notes: patient.notes ?? "" },
  });
  const mutation = useMutation({
    mutationFn: (data: EditForm) => apiRequest("PATCH", `/api/admin/patients/${patient.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/patients"] });
      toast({ title: "تم تحديث بيانات المريض" });
      onClose();
    },
  });
  return (
    <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label>الاسم الكامل</Label>
        <Input {...form.register("fullName")} data-testid="input-edit-patient-name" />
      </div>
      <div className="space-y-1.5">
        <Label>الهاتف</Label>
        <Input {...form.register("phone")} data-testid="input-edit-patient-phone" />
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea {...form.register("notes")} data-testid="input-edit-patient-notes" />
      </div>
      <div className="flex justify-start gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={mutation.isPending} data-testid="button-save-patient">
          {mutation.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </Button>
      </div>
    </form>
  );
}

function PatientDetails({
  patient,
  history,
  historyLoading,
}: {
  patient: Patient;
  history: any[];
  historyLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-muted-foreground">{patient.fullName.charAt(0)}</span>
        </div>
        <div>
          <p className="font-semibold text-foreground">{patient.fullName}</p>
          <p className="text-sm text-muted-foreground">{patient.phone}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded-md p-3 text-center">
          <p className="text-xl font-bold text-foreground">{patient.noShowCount ?? 0}</p>
          <p className="text-xs text-muted-foreground">الغيابات</p>
        </div>
        <div className={`rounded-md p-3 text-center ${patient.isFlagged ? "bg-red-100 dark:bg-red-900/20" : "bg-green-100 dark:bg-green-900/20"}`}>
          <p className="text-xs font-semibold mt-1" style={{ color: patient.isFlagged ? "rgb(185,28,28)" : "rgb(21,128,61)" }}>
            {patient.isFlagged ? "محدد" : "جيد"}
          </p>
          <p className="text-xs text-muted-foreground">الحالة</p>
        </div>
      </div>
      {patient.notes && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">ملاحظات</p>
          <p className="text-sm text-foreground">{patient.notes}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">سجل الزيارات</p>
        {historyLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد مواعيد بعد</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((appt: any) => (
              <div key={appt.id} className="flex items-center gap-2 text-xs">
                <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-foreground">{appt.date} {appt.time}</span>
                <span className="text-muted-foreground truncate">{appt.serviceName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPatients() {
  const [search, setSearch] = useState("");
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const isMobile = useIsMobile();

  const { data: patients = [], isLoading } = useQuery<Patient[]>({ queryKey: ["/api/admin/patients"] });
  const { data: patientHistory = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/patients", selectedPatient?.id, "history"],
    queryFn: () => fetch(`/api/admin/patients/${selectedPatient!.id}/appointments`).then(r => r.json()),
    enabled: !!selectedPatient,
  });

  const filtered = patients.filter(p =>
    !search ||
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">المرضى</h1>
        <p className="text-sm text-muted-foreground mt-0.5">سجلات المرضى — عرض التاريخ وإدارة السجلات</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="البحث بالاسم أو الهاتف..."
          className="pr-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search-patients"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* قائمة المرضى */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">جميع المرضى</CardTitle>
              <span className="text-sm text-muted-foreground">{filtered.length} مريض</span>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">لا يوجد مرضى</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(patient => (
                    <div
                      key={patient.id}
                      data-testid={`row-patient-${patient.id}`}
                      onClick={() => setSelectedPatient(patient)}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedPatient?.id === patient.id ? "border-primary bg-primary/5" : "border-border bg-card hover-elevate"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-muted-foreground">{patient.fullName.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{patient.fullName}</p>
                          {patient.isFlagged && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" />محدد
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{patient.phone}
                          </span>
                          {(patient.noShowCount ?? 0) > 0 && (
                            <span className="text-xs text-muted-foreground">{patient.noShowCount} غياب</span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={e => e.stopPropagation()} data-testid={`button-patient-actions-${patient.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditingPatient(patient); }}>
                            <Edit2 className="w-4 h-4 ml-2" />تعديل
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

        {/* تفاصيل المريض — Desktop فقط */}
        <div className="hidden lg:block">
          {selectedPatient ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">تفاصيل المريض</CardTitle>
              </CardHeader>
              <CardContent>
                <PatientDetails patient={selectedPatient} history={patientHistory} historyLoading={historyLoading} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">اختر مريضاً لعرض تفاصيله</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sheet تفاصيل المريض — Mobile فقط */}
      <Sheet open={isMobile && !!selectedPatient} onOpenChange={open => { if (!open) setSelectedPatient(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto" data-testid="sheet-patient-details">
          <SheetHeader className="pb-4">
            <SheetTitle>تفاصيل المريض</SheetTitle>
          </SheetHeader>
          {selectedPatient && (
            <PatientDetails patient={selectedPatient} history={patientHistory} historyLoading={historyLoading} />
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog تعديل المريض */}
      <Dialog open={!!editingPatient} onOpenChange={() => setEditingPatient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل المريض</DialogTitle></DialogHeader>
          {editingPatient && <PatientEditDialog patient={editingPatient} onClose={() => setEditingPatient(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
