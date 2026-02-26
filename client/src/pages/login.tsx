import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stethoscope, AlertCircle } from "lucide-react";
import { useEffect } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, login, isLoggingIn, loginError } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.role === "doctor") navigate("/doctor");
      else navigate("/admin");
    }
  }, [user]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await login(data);
      const body = await res.json();
      if (body.role === "doctor") navigate("/doctor");
      else navigate("/admin");
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Stethoscope className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Rakaz Clinic</h1>
          <p className="text-sm text-muted-foreground mt-1">Smart Appointment Management</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="admin"
                  data-testid="input-username"
                  {...form.register("username")}
                />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  data-testid="input-password"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              {loginError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Invalid username or password</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn}
                data-testid="button-login"
              >
                {isLoggingIn ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Demo credentials:</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Admin: <span className="font-mono text-foreground">admin / admin123</span></p>
                <p className="text-xs text-muted-foreground">Doctor: <span className="font-mono text-foreground">doctor1 / doctor123</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Want to book an appointment?{" "}
          <a href="/book" className="text-primary underline-offset-2 hover:underline">
            Book here
          </a>
        </p>
      </div>
    </div>
  );
}
