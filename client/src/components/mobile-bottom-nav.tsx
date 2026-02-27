import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  Settings,
  CalendarDays,
  UserCheck,
} from "lucide-react";

const adminTabs = [
  { title: "الرئيسية", url: "/admin", icon: LayoutDashboard },
  { title: "المواعيد", url: "/admin/appointments", icon: Calendar },
  { title: "المرضى", url: "/admin/patients", icon: Users },
  { title: "الأطباء", url: "/admin/doctors", icon: Stethoscope },
  { title: "الإعدادات", url: "/admin/settings", icon: Settings },
];

const doctorTabs = [
  { title: "جدولي", url: "/doctor", icon: CalendarDays },
  { title: "المواعيد", url: "/doctor/appointments", icon: Calendar },
  { title: "المرضى", url: "/doctor/patients", icon: UserCheck },
];

export function MobileBottomNav() {
  const { user } = useAuth();
  const [location] = useLocation();

  const tabs =
    user?.role === "clinic_admin"
      ? adminTabs
      : user?.role === "doctor"
      ? doctorTabs
      : [];

  if (tabs.length === 0) return null;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-background border-t border-border flex items-stretch">
      {tabs.map((tab) => {
        const isActive =
          location === tab.url ||
          (tab.url !== "/admin" &&
            tab.url !== "/doctor" &&
            location.startsWith(tab.url));
        return (
          <Link
            key={tab.url}
            href={tab.url}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`bottom-nav-${tab.url.replace(/\//g, "-")}`}
          >
            <tab.icon className={`w-5 h-5 shrink-0 ${isActive ? "stroke-[2.5]" : ""}`} />
            <span className="text-[10px] font-medium leading-tight">{tab.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
