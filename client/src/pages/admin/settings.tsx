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
  { method: "GET",  path: "/fhir/metadata",         auth: false, description: "CapabilityStatement — public, no auth" },
  { method: "GET",  path: "/fhir/Patient",           auth: true,  description: "Search patients (name, phone)" },
  { method: "GET",  path: "/fhir/Patient/:id",       auth: true,  description: "Get patient by ID" },
  { method: "POST", path: "/fhir/Patient",           auth: true,  description: "Create patient from HIS" },
  { method: "GET",  path: "/fhir/Appointment",       auth: true,  description: "Search appointments (date, doctor, status)" },
  { method: "GET",  path: "/fhir/Appointment/:id",   auth: true,  description: "Get appointment by ID" },
  { method: "POST", path: "/fhir/Appointment",       auth: true,  description: "Create appointment from HIS (auto-confirmed)" },
  { method: "PUT",  path: "/fhir/Appointment/:id",   auth: true,  description: "Update appointment status from HIS" },
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
    onSuccess: () => toast({ title: "Test message sent", description: `WhatsApp message sent to ${testPhone}` }),
    onError: () => toast({ title: "Failed to send", description: "Check your WhatsApp credentials.", variant: "destructive" }),
  });

  const handleCopyKey = async () => {
    if (!settings?.fhir.apiKey) return;
    await navigator.clipboard.writeText(settings.fhir.apiKey);
    setCopiedKey(true);
    toast({ title: "API key copied" });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = async () => {
    if (!settings?.fhir.baseUrl) return;
    await navigator.clipboard.writeText(settings.fhir.baseUrl);
    setCopiedUrl(true);
    toast({ title: "FHIR base URL copied" });
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
        <h1 className="text-2xl font-bold text-foreground">Integrations & Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure WhatsApp, FHIR, and Google Calendar integrations</p>
      </div>

      {/* ── WhatsApp Section ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp Business Cloud API</CardTitle>
                <CardDescription className="text-xs">Meta WhatsApp Cloud API — appointment notifications</CardDescription>
              </div>
            </div>
            {settings?.whatsapp.configured ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" />Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />Not configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.whatsapp.configured ? (
            <div className="rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-300">
              <p className="font-medium">WhatsApp is active</p>
              <p className="text-xs mt-1 opacity-80">Phone Number ID: {settings.whatsapp.phoneNumberId}</p>
              <p className="text-xs mt-0.5 opacity-80">Messages are sent for: booking requests, confirmations, cancellations, and doctor arrivals.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 border border-border p-3 text-sm space-y-2">
                <p className="font-medium text-foreground">How to get your credentials:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create a Meta Business account at <span className="font-mono">business.facebook.com</span></li>
                  <li>Add a WhatsApp product in the Meta Developer Console</li>
                  <li>Create a permanent API token from System Users</li>
                  <li>Copy the Phone Number ID from the WhatsApp API setup page</li>
                  <li>Set <span className="font-mono">WHATSAPP_API_TOKEN</span> and <span className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> as environment secrets in Replit</li>
                </ol>
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />Meta WhatsApp Cloud API Docs
                </a>
              </div>
            </div>
          )}

          {/* Test message */}
          <div className="pt-1 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-2">Send a test message</p>
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
                {testWhatsAppMutation.isPending ? "Sending…" : "Send Test"}
              </Button>
            </div>
            {!settings?.whatsapp.configured && (
              <p className="text-xs text-muted-foreground mt-1.5">
                The test will be logged to the console until WhatsApp credentials are configured.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── FHIR Section ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base">HL7 FHIR R4 — HIS / EMR Integration</CardTitle>
                <CardDescription className="text-xs">Standard FHIR endpoints for hospital system connectivity</CardDescription>
              </div>
            </div>
            {settings?.fhir.configured ? (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" />Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />Not configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FHIR Base URL</Label>
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

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">API Key (Bearer Token)</Label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 px-3 py-2 rounded-md bg-muted border border-border text-sm font-mono text-foreground truncate"
                data-testid="text-fhir-api-key"
              >
                {settings?.fhir.apiKey
                  ? (showKey ? settings.fhir.apiKey : "•".repeat(32) + settings.fhir.apiKey.slice(-8))
                  : "Not set — add FHIR_API_KEY to environment secrets"}
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
              Send this as <span className="font-mono">Authorization: Bearer &lt;key&gt;</span> in all FHIR requests.
            </p>
          </div>

          {/* Endpoint table */}
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-foreground">Available Endpoints</p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16">Method</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Path</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Description</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-14">Auth</th>
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

          {/* Usage example */}
          <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">Example — search today's appointments:</p>
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
{`curl "${settings?.fhir.baseUrl ?? "<FHIR_BASE_URL>"}/Appointment?date=$(date +%Y-%m-%d)" \\
  -H "Authorization: Bearer ${settings?.fhir.apiKey?.slice(0, 8) ?? "<FHIR_API_KEY>"}..."`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* ── Google Calendar Section ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Google Calendar Sync</CardTitle>
                <CardDescription className="text-xs">Per-doctor OAuth — appointments appear in each doctor's calendar</CardDescription>
              </div>
            </div>
            {settings?.google.configured ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" />App configured
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />Not configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {settings?.google.configured ? (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">Google OAuth app is set up</p>
              <p className="text-xs mt-1 opacity-80">Each doctor can connect their individual Google Calendar from their dashboard. Appointments are automatically synced and removed on cancellation.</p>
            </div>
          ) : (
            <div className="rounded-md bg-muted/50 border border-border p-3 text-sm space-y-2">
              <p className="font-medium text-foreground">How to set up Google Calendar:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to <span className="font-mono">console.cloud.google.com</span> and create a project</li>
                <li>Enable the Google Calendar API</li>
                <li>Create OAuth 2.0 credentials (Web application type)</li>
                <li>Add redirect URI: <span className="font-mono">/api/auth/google/callback</span></li>
                <li>Set <span className="font-mono">GOOGLE_CLIENT_ID</span>, <span className="font-mono">GOOGLE_CLIENT_SECRET</span>, and <span className="font-mono">GOOGLE_REDIRECT_URI</span> as environment secrets</li>
              </ol>
              <a
                href="https://developers.google.com/calendar/api/quickstart/nodejs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />Google Calendar API Quickstart
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
