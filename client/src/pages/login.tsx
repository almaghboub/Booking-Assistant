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
import arLogoPath from "@assets/F1C71113-6C7B-4F07-9F7B-D8BEB9011ADA_1772231296978.png";
import enLogoPath from "@assets/45A1E150-36A4-404D-9C46-272B6E73972F_1772233514083.png";
import { useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

function LanguageToggle() {
  const { t, toggleLanguage } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      title={t("flagSwitchTitle")}
      data-testid="button-language-toggle-login"
      className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors absolute top-4 start-4"
    >
      {t("flagSwitch")}
    </button>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, login, isLoggingIn, loginError } = useAuth();
  const { t, language } = useLanguage();
  const logoPath = language === "en" ? enLogoPath : arLogoPath;

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
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
      <LanguageToggle />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoPath} alt={t("logoAlt")} className="h-60 w-auto object-contain mb-2" />
          <p className="text-sm text-muted-foreground">{t("login_subtitle")}</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("login_title")}</CardTitle>
            <CardDescription>{t("login_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">{t("login_username")}</Label>
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
                <Label htmlFor="password">{t("login_password")}</Label>
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
                  <span>{t("login_error")}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn}
                data-testid="button-login"
              >
                {isLoggingIn ? t("login_submitting") : t("login_submit")}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">{t("login_demo")}</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("login_demo_admin")} <span className="font-mono text-foreground">admin / admin123</span></p>
                <p className="text-xs text-muted-foreground">{t("login_demo_doctor")} <span className="font-mono text-foreground">doctor1 / doctor123</span></p>
                <p className="text-xs text-muted-foreground">Super Admin: <span className="font-mono text-foreground">superadmin / super123</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {t("login_book_cta")}{" "}
          <a href="/book" className="text-primary underline-offset-2 hover:underline">
            {t("login_book_link")}
          </a>
        </p>
      </div>
    </div>
  );
}
