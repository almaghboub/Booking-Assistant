import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, ShieldCheck, Copy, Eye, EyeOff, Check,
  CheckCircle, XCircle, Send, ExternalLink, RefreshCw, Zap,
} from "lucide-react";

interface SettingsData {
  whatsapp: { configured: boolean; phoneNumberId: string | null };
  fhir: { configured: boolean; apiKey: string | null; baseUrl: string };
  google: { configured: boolean };
}

const FHIR_ENDPOINTS = [
  { method: "GET",  path: "/fhir/metadata",         auth: false, description: "CapabilityStatement — عام، بدون مصادقة" },
  { method: "GET",  path: "/fhir/Patient",           auth: true,  description: "البحث عن مرضى (الاسم، الهاتف)" },
  { method: "GET",  path: "/fhir/Patient/:id",       auth: true,  description: "جلب مريض بالمعرف" },
  { method: "POST", path: "/fhir/Patient",           auth: true,  description: "إنشاء مريض من نظام HIS" },
  { method: "GET",  path: "/fhir/Appointment",       auth: true,  description: "البحث عن مواعيد (التاريخ، الطبيب، الحالة)" },
  { method: "GET",  path: "/fhir/Appointment/:id",   auth: true,  description: "جلب موعد بالمعرف" },
  { method: "POST", path: "/fhir/Appointment",       auth: true,  description: "إنشاء موعد من HIS (مؤكد تلقائياً)" },
  { method: "PUT",  path: "/fhir/Appointment/:id",   auth: true,  description: "تحديث حالة الموعد من HIS" },
];

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  POST:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  PUT:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function AdminSettings() {
  const { toast } = useToast();
  const [testPhone, setTestPhone] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ["/api/admin/settings"],
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/whatsapp/test", { phone: testPhone }),
    onSuccess: () => toast({ title: "تم إرسال رسالة الاختبار", description: `تم الإرسال إلى ${testPhone}` }),
    onError: () => toast({ title: "فشل الإرسال", description: "تحقق من بيانات اعتماد واتساب.", variant: "destructive" }),
  });

  const handleCopyKey = async () => {
    if (!settings?.fhir.apiKey) return;
    await navigator.clipboard.writeText(settings.fhir.apiKey);
    setCopiedKey(true);
    toast({ title: "تم نسخ مفتاح API" });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = async () => {
    if (!settings?.fhir.baseUrl) return;
    await navigator.clipboard.writeText(settings.fhir.baseUrl);
    setCopiedUrl(true);
    toast({ title: "تم نسخ رابط FHIR" });
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">التكاملات والإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-0.5">إعداد تكاملات واتساب وFHIR وتقويم Google</p>
      </div>

      {/* ── قسم واتساب ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">واجهة برمجة واتساب للأعمال</CardTitle>
                <CardDescription className="text-xs">Meta WhatsApp Cloud API — إشعارات المواعيد</CardDescription>
              </div>
            </div>
            {settings?.whatsapp.configured ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" />متصل
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />غير مُهيأ
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.whatsapp.configured ? (
            <div className="rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-300">
              <p className="font-medium">واتساب نشط</p>
              <p className="text-xs mt-1 opacity-80">معرف رقم الهاتف: {settings.whatsapp.phoneNumberId}</p>
              <p className="text-xs mt-0.5 opacity-80">يتم إرسال الرسائل عند: طلبات الحجز، التأكيدات، الإلغاءات، ووصول الطبيب.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 border border-border p-3 text-sm space-y-2">
                <p className="font-medium text-foreground">كيفية الحصول على بيانات الاعتماد:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>أنشئ حساباً تجارياً على Meta في <span className="font-mono">business.facebook.com</span></li>
                  <li>أضف منتج WhatsApp في Meta Developer Console</li>
                  <li>أنشئ رمز API دائماً من System Users</li>
                  <li>انسخ Phone Number ID من صفحة إعداد WhatsApp API</li>
                  <li>أضف <span className="font-mono">WHATSAPP_API_TOKEN</span> و<span className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> كمتغيرات بيئة في Replit</li>
                </ol>
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />توثيق Meta WhatsApp Cloud API
                </a>
              </div>
            </div>
          )}

          {/* رسالة اختبار */}
          <div className="pt-1 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-2">إرسال رسالة اختبار</p>
            <div className="flex gap-2">
              <Input
                placeholder="+218 91 234 5678"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                className="flex-1"
                data-testid="input-test-phone"
              />
              <Button
                onClick={() => testWhatsAppMutation.mutate()}
                disabled={!testPhone || testWhatsAppMutation.isPending}
                className="gap-2"
                data-testid="button-send-test-whatsapp"
              >
                <Send className="w-4 h-4" />
                {testWhatsAppMutation.isPending ? "جارٍ الإرسال..." : "إرسال اختبار"}
              </Button>
            </div>
            {!settings?.whatsapp.configured && (
              <p className="text-xs text-muted-foreground mt-1.5">
                سيتم تسجيل الاختبار في وحدة التحكم حتى يتم إعداد بيانات اعتماد واتساب.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── قسم FHIR ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base">HL7 FHIR R4 — تكامل HIS/EMR</CardTitle>
                <CardDescription className="text-xs">نقاط نهاية FHIR قياسية للتكامل مع أنظمة المستشفى</CardDescription>
              </div>
            </div>
            {settings?.fhir.configured ? (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" />نشط
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />غير مُهيأ
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* رابط FHIR الأساسي */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">رابط FHIR الأساسي</Label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 px-3 py-2 rounded-md bg-muted border border-border text-sm font-mono text-foreground truncate"
                data-testid="text-fhir-base-url"
              >
                {settings?.fhir.baseUrl || "—"}
              </div>
              <Button size="icon" variant="outline" onClick={handleCopyUrl} data-testid="button-copy-fhir-url">
                {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* مفتاح API */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">مفتاح API (Bearer Token)</Label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 px-3 py-2 rounded-md bg-muted border border-border text-sm font-mono text-foreground truncate"
                data-testid="text-fhir-api-key"
              >
                {settings?.fhir.apiKey
                  ? (showKey ? settings.fhir.apiKey : "•".repeat(32) + settings.fhir.apiKey.slice(-8))
                  : "غير مُعيَّن — أضف FHIR_API_KEY إلى متغيرات البيئة"}
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setShowKey(!showKey)}
                data-testid="button-toggle-fhir-key"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyKey}
                disabled={!settings?.fhir.apiKey}
                data-testid="button-copy-fhir-key"
              >
                {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              أرسله كـ <span className="font-mono">Authorization: Bearer &lt;key&gt;</span> في جميع طلبات FHIR.
            </p>
          </div>

          {/* جدول نقاط النهاية */}
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-foreground">نقاط النهاية المتاحة</p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">الطريقة</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">المسار</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">الوصف</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-14">مصادقة</th>
                  </tr>
                </thead>
                <tbody>
                  {FHIR_ENDPOINTS.map((ep, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[ep.method]}`}>
                          {ep.method}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">{ep.path}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{ep.description}</td>
                      <td className="px-3 py-2 text-center">
                        {ep.auth
                          ? <ShieldCheck className="w-3.5 h-3.5 text-purple-500 inline" />
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* مثال استخدام */}
          <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">مثال — البحث عن مواعيد اليوم:</p>
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
{`curl "${settings?.fhir.baseUrl ?? "<FHIR_BASE_URL>"}/Appointment?date=$(date +%Y-%m-%d)" \\
  -H "Authorization: Bearer ${settings?.fhir.apiKey?.slice(0, 8) ?? "<FHIR_API_KEY>"}..."`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* ── قسم تقويم Google ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">مزامنة تقويم Google</CardTitle>
                <CardDescription className="text-xs">OAuth لكل طبيب — تظهر المواعيد تلقائياً في تقويم كل طبيب</CardDescription>
              </div>
            </div>
            {settings?.google.configured ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" />مُهيأ
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />غير مُهيأ
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {settings?.google.configured ? (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">تطبيق Google OAuth مُعد</p>
              <p className="text-xs mt-1 opacity-80">يمكن لكل طبيب ربط تقويمه الشخصي من لوحة التحكم الخاصة به. تتزامن المواعيد تلقائياً وتُحذف عند الإلغاء.</p>
            </div>
          ) : (
            <div className="rounded-md bg-muted/50 border border-border p-3 text-sm space-y-2">
              <p className="font-medium text-foreground">كيفية إعداد تقويم Google:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>انتقل إلى <span className="font-mono">console.cloud.google.com</span> وأنشئ مشروعاً</li>
                <li>فعّل Google Calendar API</li>
                <li>أنشئ بيانات اعتماد OAuth 2.0 (نوع Web application)</li>
                <li>أضف redirect URI: <span className="font-mono">/api/auth/google/callback</span></li>
                <li>أضف <span className="font-mono">GOOGLE_CLIENT_ID</span> و<span className="font-mono">GOOGLE_CLIENT_SECRET</span> و<span className="font-mono">GOOGLE_REDIRECT_URI</span> كمتغيرات بيئة</li>
              </ol>
              <a
                href="https://developers.google.com/calendar/api/quickstart/nodejs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />دليل تشغيل Google Calendar API
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
