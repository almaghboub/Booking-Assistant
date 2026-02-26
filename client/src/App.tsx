import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";

import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import BookingPage from "@/pages/book";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminAppointments from "@/pages/admin/appointments";
import AdminDoctors from "@/pages/admin/doctors";
import AdminServices from "@/pages/admin/services";
import AdminPatients from "@/pages/admin/patients";
import AdminAnalytics from "@/pages/admin/analytics";
import DoctorDashboard from "@/pages/doctor/dashboard";
import DoctorAppointments from "@/pages/doctor/appointments";
import DoctorPatients from "@/pages/doctor/patients";
import NotFound from "@/pages/not-found";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

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

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0 h-12">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
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
