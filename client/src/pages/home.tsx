import { Link } from "wouter";
import arLogoPath from "@assets/F1C71113-6C7B-4F07-9F7B-D8BEB9011ADA_1772231296978.png";
import enLogoPath from "@assets/45A1E150-36A4-404D-9C46-272B6E73972F_1772233514083.png";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  Clock,
  Shield,
  ArrowLeft,
  ArrowRight,
  Phone,
  MapPin,
  CheckCircle2,
  LogIn,
  Star,
} from "lucide-react";
import type { Doctor } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";
import { ThemeToggle } from "@/components/theme-toggle";

const CLINIC_ID = "clinic-1";

function LanguageToggle() {
  const { t, toggleLanguage } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      title={t("flagSwitchTitle")}
      data-testid="button-language-toggle-home"
      className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
    >
      {t("flagSwitch")}
    </button>
  );
}

export default function HomePage() {
  const { t, language } = useLanguage();
  const logoPath = language === "en" ? enLogoPath : arLogoPath;
  const isRtl = language === "ar";
  const ArrowForward = isRtl ? ArrowLeft : ArrowRight;
  const ArrowBack = isRtl ? ArrowRight : ArrowLeft;

  const featureIcons = [CalendarCheck, Clock, Shield];
  const features: Array<{ title: string; description: string }> = t("features");
  const howSteps: Array<{ step: string; title: string; desc: string }> = t("how_steps");
  const heroFeatures: string[] = t("hero_features");

  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/public/doctors", CLINIC_ID],
    queryFn: () => fetch(`/api/public/doctors?clinicId=${CLINIC_ID}`).then(r => r.json()),
  });

  return (
    <div className="min-h-screen bg-background">

      {/* ── الشريط العلوي ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[140px] flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center">
            <img src={logoPath} alt={t("logoAlt")} className="h-[120px] w-auto object-contain shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#doctors" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav_doctors")}
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav_how")}
            </a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("nav_contact")}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <Link href="/login">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 font-semibold"
                data-testid="button-doctor-login-nav"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("nav_login")}</span>
                <span className="sm:hidden">{t("nav_login_short")}</span>
              </Button>
            </Link>
            <Link href="/book">
              <Button
                size="sm"
                className="gap-1.5 font-semibold"
                data-testid="button-book-now-nav"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                {t("nav_book")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── قسم البطل ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <Badge variant="secondary" className="mb-5 text-xs font-semibold uppercase tracking-wider px-3 py-1">
            {t("hero_badge")}
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight mb-5">
            {t("hero_title_1")}
            <br />
            <span className="text-primary">{t("hero_title_2")}</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            {t("hero_subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/book">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto text-base px-8"
                data-testid="button-book-now-hero"
              >
                <CalendarCheck className="w-5 h-5" />
                {t("hero_book")}
                <ArrowForward className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-auto text-base"
                data-testid="button-doctor-login-hero"
              >
                <LogIn className="w-4 h-4" />
                {t("hero_login")}
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 mt-10 text-sm text-muted-foreground">
            {heroFeatures.map(item => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── شريط الحجز ── */}
      <section className="bg-primary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className={`text-center sm:${isRtl ? "text-right" : "text-left"}`}>
            <p className="text-primary-foreground font-semibold text-lg">{t("banner_title")}</p>
            <p className="text-primary-foreground/80 text-sm mt-0.5">{t("banner_subtitle")}</p>
          </div>
          <Link href="/book">
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 font-bold shrink-0 whitespace-nowrap"
              data-testid="button-book-now-banner"
            >
              <CalendarCheck className="w-5 h-5" />
              {t("banner_cta")}
            </Button>
          </Link>
        </div>
      </section>

      {/* ── أطباؤنا ── */}
      <section id="doctors" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground mb-2">{t("doctors_title")}</h2>
          <p className="text-muted-foreground">{t("doctors_subtitle")}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doc) => (
            <Link key={doc.id} href={`/book?doctor=${doc.id}`}>
              <div
                data-testid={`card-doctor-home-${doc.id}`}
                className="group p-5 rounded-lg border border-border bg-card hover-elevate cursor-pointer transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-border group-hover:ring-primary transition-all">
                    {doc.photo ? (
                      <img src={doc.photo} alt={doc.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-muted-foreground">{doc.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground">{doc.name}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">{doc.specialty}</Badge>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" /> {doc.workingHours}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                    {t("doctors_book_now")} <ArrowBack className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── كيف يعمل ── */}
      <section id="how-it-works" className="bg-muted/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">{t("how_title")}</h2>
            <p className="text-muted-foreground">{t("how_subtitle")}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {howSteps.map(item => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/book">
              <Button size="lg" className="gap-2 text-base" data-testid="button-book-now-how">
                <CalendarCheck className="w-5 h-5" />
                {t("how_start")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── المميزات ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                {(() => { const Icon = featureIcons[i]; return <Icon className="w-5 h-5 text-primary" />; })()}
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── التذييل ── */}
      <footer id="contact" className="bg-card border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-4">
                <img src={logoPath} alt={t("logoAlt")} className="h-[100px] w-auto object-contain" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("footer_tagline")}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">{t("footer_links")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/book" className="hover:text-foreground transition-colors">{t("footer_link_book")}</Link></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">{t("footer_link_login")}</Link></li>
                <li><a href="#doctors" className="hover:text-foreground transition-colors">{t("footer_link_doctors")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">{t("footer_contact")}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0 text-primary" />218-91-123-4567+</p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0 text-primary" />{t("footer_address")}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center">
            <p className="text-xs text-muted-foreground">{t("footer_copy")}</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
