import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import logoPath from "@assets/F1C71113-6C7B-4F07-9F7B-D8BEB9011ADA_1772231296978.png";
import { useEffect } from "react";

const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
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
          <img src={logoPath} alt="موعد" className="h-60 w-auto object-contain mb-2" />
          <p className="text-sm text-muted-foreground">إدارة المواعيد الذكية</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">تسجيل الدخول</CardTitle>
            <CardDescription>أدخل بيانات الاعتماد للمتابعة</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">اسم المستخدم</Label>
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
                <Label htmlFor="password">كلمة المرور</Label>
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
                  <span>اسم المستخدم أو كلمة المرور غير صحيحة</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn}
                data-testid="button-login"
              >
                {isLoggingIn ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">بيانات تجريبية:</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">المدير: <span className="font-mono text-foreground">admin / admin123</span></p>
                <p className="text-xs text-muted-foreground">طبيب: <span className="font-mono text-foreground">doctor1 / doctor123</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          تريد حجز موعد؟{" "}
          <a href="/book" className="text-primary underline-offset-2 hover:underline">
            احجز هنا
          </a>
        </p>
      </div>
    </div>
  );
}
