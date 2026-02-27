import { Link, useLocation } from "wouter";
import logoPath from "@assets/F1C71113-6C7B-4F07-9F7B-D8BEB9011ADA_1772231296978.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  BarChart3,
  LogOut,
  CalendarDays,
  ClipboardList,
  UserCheck,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation as useWouterLocation } from "wouter";

const adminItems = [
  { title: "لوحة التحكم", url: "/admin", icon: LayoutDashboard },
  { title: "المواعيد", url: "/admin/appointments", icon: Calendar },
  { title: "الأطباء", url: "/admin/doctors", icon: Stethoscope },
  { title: "الخدمات", url: "/admin/services", icon: ClipboardList },
  { title: "المرضى", url: "/admin/patients", icon: Users },
  { title: "التحليلات", url: "/admin/analytics", icon: BarChart3 },
  { title: "الإعدادات", url: "/admin/settings", icon: Settings },
];

const doctorItems = [
  { title: "جدول مواعيدي", url: "/doctor", icon: CalendarDays },
  { title: "مواعيدي", url: "/doctor/appointments", icon: Calendar },
  { title: "مرضاي", url: "/doctor/patients", icon: UserCheck },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location, navigate] = useWouterLocation();

  const items = user?.role === "doctor" ? doctorItems : user?.role === "clinic_admin" ? adminItems : [];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="block">
          <img src={logoPath} alt="موعد" className="h-[100px] w-auto object-contain" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-1">
            التنقل
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location === item.url || (item.url !== "/admin" && item.url !== "/doctor" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-sidebar-accent-foreground">
              {user?.fullName?.charAt(0) || user?.username?.charAt(0) || "م"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.fullName || user?.username}</p>
            <p className="text-xs text-muted-foreground">
              {user?.role === "clinic_admin" ? "مدير" : user?.role === "doctor" ? "طبيب" : ""}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLogout}
            data-testid="button-logout"
            className="shrink-0"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
