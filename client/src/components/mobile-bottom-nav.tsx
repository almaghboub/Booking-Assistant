import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  Settings,
  CalendarDays,
  UserCheck,
} from "lucide-react";

export function MobileBottomNav() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [location] = useLocation();

  if (!user) return null;

  const adminTabs = [
    { href: "/admin",               icon: LayoutDashboard, label: t("admin_dashboard")    },
    { href: "/admin/appointments",  icon: Calendar,        label: t("admin_appointments")  },
    { href: "/admin/patients",      icon: Users,           label: t("admin_patients")      },
    { href: "/admin/doctors",       icon: Stethoscope,     label: t("admin_doctors")       },
    { href: "/admin/settings",      icon: Settings,        label: t("admin_settings")      },
  ];

  const doctorTabs = [
    { href: "/doctor",              icon: CalendarDays,    label: t("doctor_schedule")      },
    { href: "/doctor/appointments", icon: Calendar,        label: t("doctor_appointments")  },
    { href: "/doctor/patients",     icon: UserCheck,       label: t("doctor_patients")      },
  ];

  const tabs = user.role === "doctor" ? doctorTabs : adminTabs;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-background border-t border-border flex items-stretch"
      data-testid="mobile-bottom-nav"
    >
      {tabs.map(tab => {
        const active =
          location === tab.href ||
          (tab.href !== "/admin" && tab.href !== "/doctor" && location.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`bottom-nav-${tab.href.replace(/\//g, "-")}`}
          >
            <tab.icon className={`w-5 h-5 shrink-0 ${active ? "stroke-[2.5]" : ""}`} />
            <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
