import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Stethoscope, Clock, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Doctor } from "@shared/schema";

const doctorFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  specialty: z.string().min(2, "Specialty is required"),
  photo: z.string().optional(),
  workingHours: z.string().min(1, "Working hours required"),
  breakTime: z.string().optional(),
});
type DoctorForm = z.infer<typeof doctorFormSchema>;

const CLINIC_ID = "clinic-1";

function DoctorFormDialog({
  doctor,
  onClose,
}: {
  doctor?: Doctor;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<DoctorForm>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: {
      name: doctor?.name ?? "",
      specialty: doctor?.specialty ?? "",
      photo: doctor?.photo ?? "",
      workingHours: doctor?.workingHours ?? "09:00-17:00",
      breakTime: doctor?.breakTime ?? "13:00-14:00",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: DoctorForm) =>
      apiRequest("POST", "/api/admin/doctors", { ...data, clinicId: CLINIC_ID }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({ title: "Doctor added" });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: DoctorForm) =>
      apiRequest("PATCH", `/api/admin/doctors/${doctor!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({ title: "Doctor updated" });
      onClose();
    },
  });

  const onSubmit = (data: DoctorForm) => {
    if (doctor) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label>Full Name</Label>
          <Input placeholder="Dr. Ahmed Ali" {...form.register("name")} data-testid="input-doctor-name" />
          {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Specialty</Label>
          <Input placeholder="General Medicine" {...form.register("specialty")} data-testid="input-doctor-specialty" />
          {form.formState.errors.specialty && <p className="text-xs text-destructive">{form.formState.errors.specialty.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Working Hours</Label>
          <Input placeholder="09:00-17:00" {...form.register("workingHours")} data-testid="input-doctor-hours" />
        </div>
        <div className="space-y-1.5">
          <Label>Break Time</Label>
          <Input placeholder="13:00-14:00" {...form.register("breakTime")} data-testid="input-doctor-break" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Photo URL (optional)</Label>
          <Input placeholder="https://..." {...form.register("photo")} data-testid="input-doctor-photo" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-doctor">
          {isPending ? "Saving..." : doctor ? "Update Doctor" : "Add Doctor"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminDoctors() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | undefined>();
  const { toast } = useToast();

  const { data: doctors = [], isLoading } = useQuery<Doctor[]>({
    queryKey: ["/api/admin/doctors"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/doctors/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({ title: "Doctor removed" });
    },
  });

  const openAdd = () => { setEditingDoctor(undefined); setDialogOpen(true); };
  const openEdit = (doc: Doctor) => { setEditingDoctor(doc); setDialogOpen(true); };
  const closeDialog = () => setDialogOpen(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Doctors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage clinic doctors and their schedules</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} data-testid="button-add-doctor">
              <Plus className="w-4 h-4 mr-2" />Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDoctor ? "Edit Doctor" : "Add New Doctor"}</DialogTitle>
            </DialogHeader>
            <DoctorFormDialog doctor={editingDoctor} onClose={closeDialog} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : doctors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Stethoscope className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No doctors yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Add your first doctor to get started</p>
            <Button size="sm" onClick={openAdd} data-testid="button-add-first-doctor">
              <Plus className="w-4 h-4 mr-2" />Add Doctor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doc) => (
            <Card key={doc.id} data-testid={`card-doctor-${doc.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {doc.photo ? (
                      <img src={doc.photo} alt={doc.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">{doc.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground text-sm truncate">{doc.name}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-doctor-actions-${doc.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(doc)} data-testid={`button-edit-doctor-${doc.id}`}>
                            <Edit2 className="w-4 h-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(doc.id)}
                            className="text-destructive"
                            data-testid={`button-delete-doctor-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Badge variant="secondary" className="mt-1 text-xs">{doc.specialty}</Badge>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{doc.workingHours}</span>
                    </div>
                    {doc.breakTime && (
                      <p className="text-xs text-muted-foreground mt-0.5">Break: {doc.breakTime}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
