import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import logoPath from "@assets/8747CEA0-6F16-4305-99C7-871EBFEC5EDF_1772227362124.png";

import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import BookingPage from "@/pages/book";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminAppointments from "@/pages/admin/appointments";
import AdminDoctors from "@/pages/admin/doctors";
import AdminServices from "@/pages/admin/services";
import AdminPatients from "@/pages/admin/patients";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminSettings from "@/pages/admin/settings";
import DoctorDashboard from "@/pages/doctor/dashboard";
import DoctorAppointments from "@/pages/doctor/appointments";
import DoctorPatients from "@/pages/doctor/patients";
import NotFound from "@/pages/not-found";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "لوحة التحكم",
  "/admin/appointments": "المواعيد",
  "/admin/doctors": "الأطباء",
  "/admin/services": "الخدمات",
  "/admin/patients": "المرضى",
  "/admin/analytics": "التحليلات",
  "/admin/settings": "الإعدادات",
  "/doctor": "جدول مواعيدي",
  "/doctor/appointments": "مواعيدي",
  "/doctor/patients": "مرضاي",
};

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const pageTitle = PAGE_TITLES[location] ?? "موعد";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          {/* ── الرأس ── */}
          <header className="flex items-center justify-between px-3 border-b border-border bg-background shrink-0 h-14 gap-2">
            {/* يسار: زر الشريط الجانبي + تبديل السمة */}
            <div className="flex items-center gap-1 shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </div>

            {/* وسط: عنوان الصفحة */}
            <p className="text-sm font-semibold text-foreground truncate text-center flex-1">
              {pageTitle}
            </p>

            {/* يمين: شعار العيادة (مخفي على md+ لأن الشريط الجانبي يظهره) */}
            <div className="flex items-center gap-1.5 md:invisible shrink-0">
              <img src={logoPath} alt="Mawid logo" className="w-9 h-9 object-contain" />
              <span className="text-xs font-bold text-foreground">موعد</span>
            </div>
          </header>

          {/* ── المحتوى الرئيسي ── */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>

          {/* ── شريط التنقل السفلي (موبايل فقط) ── */}
          <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  if (user.role === "doctor") return <Redirect to="/doctor" />;
  return <ProtectedLayout><Component /></ProtectedLayout>;
}

function DoctorRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "doctor") return <Redirect to="/admin" />;
  return <ProtectedLayout><Component /></ProtectedLayout>;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user?.role === "doctor") return <Redirect to="/doctor" />;
  if (user?.role === "clinic_admin") return <Redirect to="/admin" />;
  return <HomePage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/book" component={BookingPage} />
      <Route path="/admin">
        <AdminRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/appointments">
        <AdminRoute component={AdminAppointments} />
      </Route>
      <Route path="/admin/doctors">
        <AdminRoute component={AdminDoctors} />
      </Route>
      <Route path="/admin/services">
        <AdminRoute component={AdminServices} />
      </Route>
      <Route path="/admin/patients">
        <AdminRoute component={AdminPatients} />
      </Route>
      <Route path="/admin/analytics">
        <AdminRoute component={AdminAnalytics} />
      </Route>
      <Route path="/admin/settings">
        <AdminRoute component={AdminSettings} />
      </Route>
      <Route path="/doctor">
        <DoctorRoute component={DoctorDashboard} />
      </Route>
      <Route path="/doctor/appointments">
        <DoctorRoute component={DoctorAppointments} />
      </Route>
      <Route path="/doctor/patients">
        <DoctorRoute component={DoctorPatients} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
