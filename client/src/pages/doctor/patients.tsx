import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Phone, AlertTriangle } from "lucide-react";
import type { Patient } from "@shared/schema";

export default function DoctorPatients() {
  const [search, setSearch] = useState("");

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/doctor/patients"],
  });

  const filtered = patients.filter(p =>
    !search ||
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرضاي</h1>
        <p className="text-sm text-muted-foreground mt-0.5">المرضى الذين زاروك أو لديهم مواعيد قادمة</p>
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
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">المرضى</CardTitle>
          <span className="text-sm text-muted-foreground">{filtered.length} مريض</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">لا يوجد مرضى</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => (
                <div key={p.id} data-testid={`row-patient-${p.id}`} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-muted-foreground">{p.fullName.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{p.fullName}</p>
                      {p.isFlagged && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>
                      {(p.noShowCount ?? 0) > 0 && <span className="text-xs text-muted-foreground">{p.noShowCount} غياب</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
