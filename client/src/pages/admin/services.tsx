import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, ClipboardList, Clock, Edit2, Trash2, MoreHorizontal, DollarSign, CreditCard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Service, Doctor } from "@shared/schema";

const serviceFormSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  duration: z.coerce.number().min(5).max(480),
  price: z.string().optional(),
  bufferTime: z.coerce.number().min(0).default(0),
  doctorId: z.string().optional(),
  requiresPayment: z.boolean().default(false),
});
type ServiceForm = z.infer<typeof serviceFormSchema>;

const CLINIC_ID = "clinic-1";

function ServiceFormDialog({ service, doctors, onClose }: { service?: Service; doctors: Doctor[]; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: service?.name ?? "",
      duration: service?.duration ?? 30,
      price: service?.price ? String(service.price) : "",
      bufferTime: service?.bufferTime ?? 0,
      doctorId: service?.doctorId ?? "all",
      requiresPayment: service?.requiresPayment ?? false,
    },
  });

  const requiresPayment = form.watch("requiresPayment");

  const createMutation = useMutation({
    mutationFn: (data: ServiceForm) =>
      apiRequest("POST", "/api/admin/services", {
        ...data,
        clinicId: CLINIC_ID,
        doctorId: data.doctorId === "all" ? null : data.doctorId,
        price: data.price || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({ title: "تمت إضافة الخدمة" });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ServiceForm) =>
      apiRequest("PATCH", `/api/admin/services/${service!.id}`, {
        ...data,
        doctorId: data.doctorId === "all" ? null : data.doctorId,
        price: data.price || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({ title: "تم تحديث الخدمة" });
      onClose();
    },
  });

  const onSubmit = (data: ServiceForm) => {
    if (service) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label>اسم الخدمة</Label>
        <Input placeholder="كشف عام" {...form.register("name")} data-testid="input-service-name" />
        {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>المدة (دقيقة)</Label>
          <Input type="number" min="5" placeholder="30" {...form.register("duration")} data-testid="input-service-duration" />
        </div>
        <div className="space-y-1.5">
          <Label>وقت الانتظار (دقيقة)</Label>
          <Input type="number" min="0" placeholder="0" {...form.register("bufferTime")} data-testid="input-service-buffer" />
        </div>
        <div className="space-y-1.5">
          <Label>السعر (اختياري)</Label>
          <Input placeholder="50.00" {...form.register("price")} data-testid="input-service-price" />
        </div>
        <div className="space-y-1.5">
          <Label>الطبيب المسؤول</Label>
          <Select
            defaultValue={service?.doctorId ?? "all"}
            onValueChange={v => form.setValue("doctorId", v)}
          >
            <SelectTrigger data-testid="select-service-doctor">
              <SelectValue placeholder="جميع الأطباء" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأطباء</SelectItem>
              {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">يتطلب دفع مسبق</Label>
          <p className="text-xs text-muted-foreground">سيُطلب من المريض دفع وديعة عند الحجز</p>
        </div>
        <Switch
          checked={requiresPayment}
          onCheckedChange={v => form.setValue("requiresPayment", v)}
          data-testid="switch-requires-payment"
        />
      </div>

      <div className="flex justify-start gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-service">
          {isPending ? "جارٍ الحفظ..." : service ? "تحديث الخدمة" : "إضافة الخدمة"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminServices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>();
  const { toast } = useToast();

  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/admin/services"] });
  const { data: doctors = [] } = useQuery<Doctor[]>({ queryKey: ["/api/admin/doctors"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/services/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({ title: "تم حذف الخدمة" });
    },
  });

  const openAdd = () => { setEditingService(undefined); setDialogOpen(true); };
  const openEdit = (svc: Service) => { setEditingService(svc); setDialogOpen(true); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الخدمات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة الخدمات المقدمة في العيادة</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} data-testid="button-add-service" className="gap-2">
              <Plus className="w-4 h-4" />إضافة خدمة
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingService ? "تعديل الخدمة" : "إضافة خدمة جديدة"}</DialogTitle>
            </DialogHeader>
            <ServiceFormDialog service={editingService} doctors={doctors} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">لا توجد خدمات بعد</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">أضف أول خدمة للبدء</p>
            <Button size="sm" onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" />إضافة خدمة</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <Card key={svc.id} data-testid={`card-service-${svc.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-service-actions-${svc.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(svc)}>
                        <Edit2 className="w-4 h-4 ml-2" />تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(svc.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 ml-2" />حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="font-semibold text-foreground mt-3">{svc.name}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{svc.duration} دقيقة
                  </span>
                  {svc.bufferTime && svc.bufferTime > 0 ? (
                    <span className="text-xs text-muted-foreground">+{svc.bufferTime} دق انتظار</span>
                  ) : null}
                  {svc.price && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />{svc.price}
                    </span>
                  )}
                </div>
                {svc.doctorId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    مخصص لـ: {doctors.find(d => d.id === svc.doctorId)?.name ?? "غير معروف"}
                  </p>
                )}
                {svc.requiresPayment && (
                  <Badge variant="secondary" className="mt-2 gap-1 text-xs" data-testid={`badge-payment-${svc.id}`}>
                    <CreditCard className="w-3 h-3" />يتطلب دفع مسبق
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
