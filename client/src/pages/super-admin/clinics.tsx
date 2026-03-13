import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Phone, MapPin, Edit2, Trash2, UserPlus } from "lucide-react";
import type { Clinic } from "@shared/schema";

export default function SuperAdminClinics() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editClinic, setEditClinic] = useState<Clinic | null>(null);
  const [adminOpen, setAdminOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", whatsappNumber: "", subscriptionPlan: "basic", subscriptionStatus: "active" });
  const [adminForm, setAdminForm] = useState({ username: "", password: "", fullName: "" });

  const { data: clinics = [], isLoading } = useQuery<Clinic[]>({
    queryKey: ["/api/super/clinics"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/super/clinics", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super/stats"] });
      setAddOpen(false);
      setForm({ name: "", address: "", phone: "", whatsappNumber: "", subscriptionPlan: "basic", subscriptionStatus: "active" });
      toast({ title: "Clinic created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/super/clinics/${editClinic?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/clinics"] });
      setEditClinic(null);
      toast({ title: "Clinic updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/super/clinics/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super/stats"] });
      toast({ title: "Clinic deleted" });
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: ({ clinicId, data }: { clinicId: string; data: any }) =>
      apiRequest("POST", `/api/super/clinics/${clinicId}/admin`, data),
    onSuccess: () => {
      setAdminOpen(null);
      setAdminForm({ username: "", password: "", fullName: "" });
      toast({ title: "Admin user created successfully" });
    },
  });

  const planColors: Record<string, string> = {
    enterprise: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    basic: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  const ClinicForm = ({ onSubmit, isPending, initial }: any) => {
    const [local, setLocal] = useState(initial || form);
    return (
      <div className="space-y-3">
        <div><Label>Clinic Name *</Label><Input value={local.name} onChange={e => setLocal({ ...local, name: e.target.value })} data-testid="input-clinic-name" /></div>
        <div><Label>Address</Label><Input value={local.address} onChange={e => setLocal({ ...local, address: e.target.value })} data-testid="input-clinic-address" /></div>
        <div><Label>Phone</Label><Input value={local.phone} onChange={e => setLocal({ ...local, phone: e.target.value })} data-testid="input-clinic-phone" /></div>
        <div><Label>WhatsApp Number</Label><Input value={local.whatsappNumber} onChange={e => setLocal({ ...local, whatsappNumber: e.target.value })} /></div>
        <div>
          <Label>Subscription Plan</Label>
          <Select value={local.subscriptionPlan} onValueChange={v => setLocal({ ...local, subscriptionPlan: v })}>
            <SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={local.subscriptionStatus} onValueChange={v => setLocal({ ...local, subscriptionStatus: v })}>
            <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" disabled={isPending || !local.name} onClick={() => onSubmit(local)} data-testid="button-save-clinic">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clinics Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{clinics.length} clinics registered</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-clinic"><Plus className="w-4 h-4 mr-2" />Add Clinic</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Clinic</DialogTitle></DialogHeader>
            <ClinicForm onSubmit={(d: any) => createMutation.mutate(d)} isPending={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {clinics.map(clinic => (
            <Card key={clinic.id} data-testid={`card-clinic-${clinic.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{clinic.name}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[clinic.subscriptionPlan || "basic"]}`}>
                          {clinic.subscriptionPlan || "basic"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[clinic.subscriptionStatus || "active"]}`}>
                          {clinic.subscriptionStatus || "active"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditClinic(clinic)} data-testid={`button-edit-clinic-${clinic.id}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                      if (confirm(`Delete ${clinic.name}?`)) deleteMutation.mutate(clinic.id);
                    }} data-testid={`button-delete-clinic-${clinic.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {clinic.address && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{clinic.address}</span>
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3 shrink-0" /><span>{clinic.phone}</span>
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={() => setAdminOpen(clinic.id)} data-testid={`button-add-admin-${clinic.id}`}>
                  <UserPlus className="w-3 h-3 mr-1" />Create Admin User
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editClinic} onOpenChange={v => !v && setEditClinic(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Clinic</DialogTitle></DialogHeader>
          {editClinic && (
            <ClinicForm
              initial={{ name: editClinic.name, address: editClinic.address || "", phone: editClinic.phone || "", whatsappNumber: editClinic.whatsappNumber || "", subscriptionPlan: editClinic.subscriptionPlan || "basic", subscriptionStatus: editClinic.subscriptionStatus || "active" }}
              onSubmit={(d: any) => updateMutation.mutate(d)}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Admin Dialog */}
      <Dialog open={!!adminOpen} onOpenChange={v => !v && setAdminOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Admin User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Username *</Label><Input value={adminForm.username} onChange={e => setAdminForm({ ...adminForm, username: e.target.value })} data-testid="input-admin-username" /></div>
            <div><Label>Password *</Label><Input type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} data-testid="input-admin-password" /></div>
            <div><Label>Full Name</Label><Input value={adminForm.fullName} onChange={e => setAdminForm({ ...adminForm, fullName: e.target.value })} data-testid="input-admin-fullname" /></div>
            <Button className="w-full" disabled={createAdminMutation.isPending || !adminForm.username || !adminForm.password}
              onClick={() => adminOpen && createAdminMutation.mutate({ clinicId: adminOpen, data: adminForm })}
              data-testid="button-create-admin">
              {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
