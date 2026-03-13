import { Switch, Route, Redirect, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageProvider, useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import arLogoPath from "@assets/F1C71113-6C7B-4F07-9F7B-D8BEB9011ADA_1772231296978.png";
import enLogoPath from "@assets/45A1E150-36A4-404D-9C46-272B6E73972F_1772233514083.png";

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
import SuperAdminDashboard from "@/pages/super-admin/dashboard";
import SuperAdminClinics from "@/pages/super-admin/clinics";
import SuperAdminAppointments from "@/pages/super-admin/appointments";
import NotFound from "@/pages/not-found";

function LanguageToggle() {
  const { t, toggleLanguage } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      title={t("flagSwitchTitle")}
      data-testid="button-language-toggle"
      className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
    >
      {t("flagSwitch")}
    </button>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { t, language } = useLanguage();
  const [location, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  const PAGE_TITLES: Record<string, string> = {
    "/admin":                   t("admin_dashboard"),
    "/admin/appointments":      t("admin_appointments"),
    "/admin/doctors":           t("admin_doctors"),
    "/admin/services":          t("admin_services"),
    "/admin/patients":          t("admin_patients"),
    "/admin/analytics":         t("admin_analytics"),
    "/admin/settings":          t("admin_settings"),
    "/doctor":                  t("doctor_schedule"),
    "/doctor/appointments":     t("doctor_appointments"),
    "/doctor/patients":         t("doctor_patients"),
    "/super":                   "Super Admin",
    "/super/clinics":           "Clinics Management",
    "/super/appointments":      "All Appointments",
  };

  const pageTitle = PAGE_TITLES[location] ?? "موعد";
  const logoPath = language === "en" ? enLogoPath : arLogoPath;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-3 border-b border-border bg-background shrink-0 h-[100px] gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
              <LanguageToggle />
            </div>
            <p className="text-sm font-semibold text-foreground truncate text-center flex-1">{pageTitle}</p>
            <div className="md:invisible shrink-0">
              <Link href="/">
                <img src={logoPath} alt={t("logoAlt")} className="h-20 w-auto object-contain cursor-pointer" />
              </Link>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
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
  if (user.role === "super_admin") return <Redirect to="/super" />;
  return <ProtectedLayout><Component /></ProtectedLayout>;
}

function DoctorRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "doctor") return <Redirect to="/admin" />;
  return <ProtectedLayout><Component /></ProtectedLayout>;
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "super_admin") return <Redirect to="/" />;
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
  if (user?.role === "super_admin") return <Redirect to="/super" />;
  return <HomePage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/book" component={BookingPage} />

      {/* Admin routes */}
      <Route path="/admin"><AdminRoute component={AdminDashboard} /></Route>
      <Route path="/admin/appointments"><AdminRoute component={AdminAppointments} /></Route>
      <Route path="/admin/doctors"><AdminRoute component={AdminDoctors} /></Route>
      <Route path="/admin/services"><AdminRoute component={AdminServices} /></Route>
      <Route path="/admin/patients"><AdminRoute component={AdminPatients} /></Route>
      <Route path="/admin/analytics"><AdminRoute component={AdminAnalytics} /></Route>
      <Route path="/admin/settings"><AdminRoute component={AdminSettings} /></Route>

      {/* Doctor routes */}
      <Route path="/doctor"><DoctorRoute component={DoctorDashboard} /></Route>
      <Route path="/doctor/appointments"><DoctorRoute component={DoctorAppointments} /></Route>
      <Route path="/doctor/patients"><DoctorRoute component={DoctorPatients} /></Route>

      {/* Super Admin routes */}
      <Route path="/super"><SuperAdminRoute component={SuperAdminDashboard} /></Route>
      <Route path="/super/clinics"><SuperAdminRoute component={SuperAdminClinics} /></Route>
      <Route path="/super/appointments"><SuperAdminRoute component={SuperAdminAppointments} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
