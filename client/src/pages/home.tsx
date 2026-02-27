import { Link } from "wouter";
import logoPath from "@assets/8747CEA0-6F16-4305-99C7-871EBFEC5EDF_1772227362124.png";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  Clock,
  Shield,
  ArrowLeft,
  Phone,
  MapPin,
  CheckCircle2,
  LogIn,
  Star,
} from "lucide-react";
import type { Doctor } from "@shared/schema";

const CLINIC_ID = "clinic-1";

const features = [
  {
    icon: CalendarCheck,
    title: "حجز سهل عبر الإنترنت",
    description: "احجز موعدك في أي وقت ومن أي مكان. لا حاجة للاتصال الهاتفي.",
  },
  {
    icon: Clock,
    title: "الإتاحة الآنية",
    description: "اطّلع على المواعيد المتاحة مباشرةً واختر الوقت المناسب لك.",
  },
  {
    icon: Shield,
    title: "تأكيد فوري",
    description: "احصل على تأكيد فوري عبر واتساب فور إتمام حجزك.",
  },
];

export default function HomePage() {
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/public/doctors", CLINIC_ID],
    queryFn: () => fetch(`/api/public/doctors?clinicId=${CLINIC_ID}`).then(r => r.json()),
  });

  return (
    <div className="min-h-screen bg-background">

      {/* ── الشريط العلوي ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={logoPath} alt="Mawid logo" className="w-12 h-12 object-contain shrink-0" />
            <span className="font-bold text-foreground text-lg">موعد</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#doctors" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              أطباؤنا
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              كيف يعمل
            </a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              التواصل
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 font-semibold"
                data-testid="button-doctor-login-nav"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">دخول الموظفين</span>
                <span className="sm:hidden">دخول</span>
              </Button>
            </Link>
            <Link href="/book">
              <Button
                size="sm"
                className="gap-1.5 font-semibold"
                data-testid="button-book-now-nav"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                احجز الآن
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
            حجز ذكي للعيادات
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight mb-5">
            احجز موعدك
            <br />
            <span className="text-primary">فوراً عبر الإنترنت</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            تجاوز طوابير الانتظار. اختر طبيبك، وحدد وقتاً مناسباً،
            واحصل على تأكيد فوري عبر واتساب.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/book">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto text-base px-8"
                data-testid="button-book-now-hero"
              >
                <CalendarCheck className="w-5 h-5" />
                احجز موعداً
                <ArrowLeft className="w-4 h-4" />
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
                دخول الأطباء والموظفين
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 mt-10 text-sm text-muted-foreground">
            {["حجز مجاني", "تأكيد فوري", "إعادة جدولة سهلة", "تنبيهات واتساب"].map(item => (
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
          <div className="text-center sm:text-right">
            <p className="text-primary-foreground font-semibold text-lg">مستعد لحجز زيارتك؟</p>
            <p className="text-primary-foreground/80 text-sm mt-0.5">مواعيد متاحة اليوم — اختر طبيبك ووقتك في أقل من دقيقتين.</p>
          </div>
          <Link href="/book">
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 font-bold shrink-0 whitespace-nowrap"
              data-testid="button-book-now-banner"
            >
              <CalendarCheck className="w-5 h-5" />
              احجز الآن
            </Button>
          </Link>
        </div>
      </section>

      {/* ── أطباؤنا ── */}
      <section id="doctors" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground mb-2">أطباؤنا</h2>
          <p className="text-muted-foreground">اضغط على الطبيب لحجز موعد مباشرة معه</p>
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
                    احجز الآن <ArrowLeft className="w-3.5 h-3.5" />
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
            <h2 className="text-3xl font-bold text-foreground mb-2">كيف يعمل</h2>
            <p className="text-muted-foreground">احجز موعدك في 3 خطوات بسيطة</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: "١", title: "اختر الطبيب والخدمة", desc: "تصفّح أطباءنا وحدد الخدمة التي تحتاجها." },
              { step: "٢", title: "اختر التاريخ والوقت", desc: "اطّلع على المواعيد المتاحة واختر الفترة التي تناسب جدولك." },
              { step: "٣", title: "تأكيد عبر واتساب", desc: "أدخل بياناتك وأكّد حجزك بضغطة واحدة." },
            ].map(item => (
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
                ابدأ الحجز
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── المميزات ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(f => (
            <div key={f.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-primary" />
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
              <div className="flex items-center gap-2.5 mb-4">
                <img src={logoPath} alt="Mawid logo" className="w-10 h-10 object-contain shrink-0" />
                <span className="font-bold text-foreground">موعد</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                أتمتة ذكية للعيادات لتجربة مريض أفضل.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">روابط سريعة</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/book" className="hover:text-foreground transition-colors">حجز موعد</Link></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">دخول الأطباء</Link></li>
                <li><a href="#doctors" className="hover:text-foreground transition-colors">أطباؤنا</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">التواصل</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0 text-primary" />218-91-123-4567+</p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0 text-primary" />شارع الرعاية الصحية 123، طرابلس</p>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center">
            <p className="text-xs text-muted-foreground">© 2026 موعد. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
