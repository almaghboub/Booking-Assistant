import express from "express";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage, db } from "./storage";
import {
  insertDoctorSchema, insertServiceSchema, insertAppointmentSchema, insertPatientSchema, insertClinicSchema,
  appointments, doctors, services, patients, users, clinics, payments, messageLogs,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { Pool } from "pg";
import {
  sendBookingConfirmationRequest, sendConfirmedNotice,
  sendCancellationNotice, sendDoctorArrivedBroadcast, getWhatsAppStatus,
  verifyWebhookChallenge, verifyWebhookSignature, processWhatsAppWebhook,
} from "./whatsapp";
import { sendSmsConfirmationRequest } from "./sms";
import { registerFhirRoutes } from "./fhir";
import { registerMoamalatRoutes } from "./moamalat";
import {
  isGoogleConfigured, getAuthUrl, exchangeCodeForTokens,
  storeDoctorTokens, disconnectDoctorCalendar, getDoctorCalendarStatus,
  syncAppointmentToCalendar, removeAppointmentFromCalendar,
} from "./googleCalendar";

const PgStore = connectPg(session);

const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const multerStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const uid = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uid + path.extname(file.originalname));
  },
});
const upload = multer({ storage: multerStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── Auth Middleware ──────────────────────────────────────
function requireAuth(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) return res.status(401).json({ error: "Not authenticated" });
  const role = (req.session as any).userRole;
  if (role !== "clinic_admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

function requireDoctor(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) return res.status(401).json({ error: "Not authenticated" });
  if ((req.session as any).userRole !== "doctor") return res.status(403).json({ error: "Forbidden" });
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) return res.status(401).json({ error: "Not authenticated" });
  if ((req.session as any).userRole !== "super_admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

// Helper: get clinicId from session (for clinic_admin)
function getSessionClinicId(req: Request): string {
  return (req.session as any).clinicId || "clinic-1";
}

// ── Helpers ──────────────────────────────────────────────
async function enrichAppointments(appts: any[]) {
  const allDoctors = await db.select().from(doctors);
  const allServices = await db.select().from(services);
  const allClinics = await db.select().from(clinics);
  return appts.map(a => ({
    ...a,
    doctorName: allDoctors.find(d => d.id === a.doctorId)?.name ?? "Unknown",
    serviceName: allServices.find(s => s.id === a.serviceId)?.name ?? "Unknown",
    clinicName: allClinics.find(c => c.id === a.clinicId)?.name ?? "Unknown",
  }));
}

function generateTimeSlots(workingHours: string, breakTime: string | null, duration: number, bufferTime: number): string[] {
  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const [startStr, endStr] = workingHours.split("-");
  const start = parseTime(startStr);
  const end = parseTime(endStr);

  let breakStart = -1, breakEnd = -1;
  if (breakTime) {
    const [bs, be] = breakTime.split("-");
    breakStart = parseTime(bs);
    breakEnd = parseTime(be);
  }

  const slots: string[] = [];
  const slotDuration = duration + bufferTime;
  for (let t = start; t + duration <= end; t += slotDuration) {
    if (breakStart >= 0 && t < breakEnd && t + duration > breakStart) continue;
    slots.push(formatTime(t));
  }
  return slots;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  app.use(session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "rakaz-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  registerFhirRoutes(app);
  registerMoamalatRoutes(app);

  // ── File Upload ──────────────────────────────────────────
  app.use("/uploads", express.static(uploadDir));

  app.post("/api/upload", requireAuth, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    return res.json({ url: `/uploads/${req.file.filename}` });
  });

  // ── WhatsApp Webhook (public – no auth) ──────────────────
  // GET: Meta verification challenge
  app.get("/api/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;
    const result = verifyWebhookChallenge(mode, token, challenge);
    if (result) return res.status(200).send(result);
    return res.status(403).json({ error: "Forbidden" });
  });

  // POST: Incoming messages from Meta
  app.post("/api/webhook/whatsapp", express.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["x-hub-signature-256"] as string;
    const rawBody = req.body.toString();

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(403).json({ error: "Invalid signature" });
    }

    const body = JSON.parse(rawBody);
    res.status(200).json({ status: "ok" }); // Respond immediately to Meta

    // Process asynchronously
    setImmediate(() => processWhatsAppWebhook(body));
  });

  // ── Auth ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    (req.session as any).userId = user.id;
    (req.session as any).userRole = user.role;
    (req.session as any).doctorId = user.doctorId;
    (req.session as any).clinicId = user.clinicId;
    return res.json({ id: user.id, role: user.role, fullName: user.fullName, username: user.username, doctorId: user.doctorId, clinicId: user.clinicId });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser((req.session as any).userId);
    if (!user) return res.status(401).json({ error: "Not found" });
    return res.json({ id: user.id, role: user.role, fullName: user.fullName, username: user.username, doctorId: user.doctorId, clinicId: user.clinicId });
  });

  // ── Google OAuth Callback ────────────────────────────────
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: doctorId, error } = req.query as Record<string, string>;
    if (error || !code || !doctorId) return res.redirect("/doctor/dashboard?calendarError=1");
    try {
      const { access_token, refresh_token, expiry_date } = await exchangeCodeForTokens(code);
      await storeDoctorTokens(doctorId, access_token, refresh_token || "", expiry_date);
      return res.redirect("/doctor/dashboard?calendarConnected=1");
    } catch (e) {
      console.error("[Google OAuth] Callback error:", e);
      return res.redirect("/doctor/dashboard?calendarError=1");
    }
  });

  // ── Public Booking ───────────────────────────────────────
  app.get("/api/public/clinics", async (_req, res) => {
    const all = await storage.getAllClinics();
    return res.json(all.map(c => ({ id: c.id, name: c.name, address: c.address, phone: c.phone })));
  });

  app.get("/api/public/doctors", async (req, res) => {
    const { clinicId } = req.query;
    const docs = await storage.getDoctorsByClinic(String(clinicId || "clinic-1"));
    return res.json(docs);
  });

  app.get("/api/public/services", async (req, res) => {
    const { clinicId, doctorId } = req.query;
    const cId = String(clinicId || "clinic-1");
    const svcs = doctorId
      ? await storage.getServicesByDoctor(cId, String(doctorId))
      : await storage.getServicesByClinic(cId);
    return res.json(svcs);
  });

  app.get("/api/public/slots", async (req, res) => {
    const { doctorId, date, serviceId } = req.query;
    if (!doctorId || !date || !serviceId) return res.json([]);

    const doctor = await storage.getDoctor(String(doctorId));
    if (!doctor) return res.json([]);
    const svc = await storage.getService(String(serviceId));
    if (!svc) return res.json([]);

    const allSlots = generateTimeSlots(
      doctor.workingHours || "09:00-17:00",
      doctor.breakTime || null,
      Number(svc.duration),
      Number(svc.bufferTime || 0)
    );

    const existingAppts = await storage.getAppointmentsForDate(null, String(doctorId), String(date));
    const bookedTimes = new Set(existingAppts.filter(a => a.status !== "cancelled").map(a => a.time));
    return res.json(allSlots.filter(s => !bookedTimes.has(s)));
  });

  app.post("/api/public/appointments", async (req, res) => {
    const data = req.body;
    const cId = data.clinicId || "clinic-1";

    let patient = await storage.getPatientByPhone(cId, data.patientPhone);
    if (!patient) {
      patient = await storage.createPatient({
        clinicId: cId, fullName: data.patientName, phone: data.patientPhone,
        notes: "", noShowCount: 0, isFlagged: false,
      });
    }

    // Check if service requires payment
    const svc = await storage.getService(data.serviceId);
    const clinic = await storage.getClinic(cId);
    const requiresPayment = svc?.requiresPayment && clinic?.paymentEnabled;
    const paymentAmount = requiresPayment && svc?.price
      ? (Number(svc.price) * (clinic?.depositPercentage || 100) / 100).toFixed(2)
      : null;

    const appt = await storage.createAppointment({
      clinicId: cId,
      doctorId: data.doctorId,
      serviceId: data.serviceId,
      patientId: patient.id,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      date: data.date,
      time: data.time,
      notes: data.notes || "",
      status: requiresPayment ? "pending_payment" : "pending_confirmation",
      paymentStatus: requiresPayment ? "pending" : "not_required",
      paymentAmount: paymentAmount,
    });

    // If payment required, create payment record and return payment info
    if (requiresPayment && paymentAmount) {
      await storage.createPayment({
        appointmentId: appt.id,
        clinicId: cId,
        amount: paymentAmount,
        paymentType: clinic?.depositPercentage !== 100 ? "deposit" : "full",
        status: "pending",
        gateway: "stripe",
      });

      return res.json({ ...appt, requiresPayment: true, paymentAmount });
    }

    // No payment: send WhatsApp + calendar
    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, data.doctorId));
    const doctorName = docRow?.name ?? "your doctor";

    await sendBookingConfirmationRequest(
      data.patientPhone, data.patientName, doctorName, data.date, data.time,
      { clinicId: cId, appointmentId: appt.id }
    );

    // Google Calendar sync
    const [svcRow] = await db.select().from(services).where(eq(services.id, data.serviceId));
    const eventId = await syncAppointmentToCalendar(data.doctorId, {
      ...appt, doctorName, serviceName: svcRow?.name ?? "",
    });
    if (eventId) {
      await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
    }

    return res.json(appt);
  });

  // Payment confirmation after Stripe payment / manual confirmation
  app.post("/api/public/appointments/:id/payment-confirm", async (req, res) => {
    const { id } = req.params;
    const { transactionId, gateway } = req.body;

    const appt = await storage.getAppointment(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    // Update appointment and payment record
    await storage.updateAppointment(id, {
      paymentStatus: "paid",
      status: "pending_confirmation",
    });

    const pay = await storage.getPaymentByAppointment(id);
    if (pay) {
      await storage.updatePayment(pay.id, {
        status: "paid",
        transactionId: transactionId || null,
        gateway: gateway || "stripe",
        paidAt: new Date(),
      });
    }

    // Now send WhatsApp confirmation request
    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, appt.doctorId));
    const doctorName = docRow?.name ?? "your doctor";
    await sendBookingConfirmationRequest(
      appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time,
      { clinicId: appt.clinicId, appointmentId: id }
    );

    return res.json({ ok: true });
  });

  // ── SUPER ADMIN ─────────────────────────────────────────
  app.get("/api/super/stats", requireSuperAdmin, async (_req, res) => {
    const stats = await storage.getSuperAdminStats();
    return res.json(stats);
  });

  app.get("/api/super/clinics", requireSuperAdmin, async (_req, res) => {
    const all = await storage.getAllClinics();
    return res.json(all);
  });

  app.post("/api/super/clinics", requireSuperAdmin, async (req, res) => {
    const data = insertClinicSchema.parse(req.body);
    const clinic = await storage.createClinic(data);
    return res.json(clinic);
  });

  app.patch("/api/super/clinics/:id", requireSuperAdmin, async (req, res) => {
    const clinic = await storage.updateClinic(req.params.id, req.body);
    if (!clinic) return res.status(404).json({ error: "Not found" });
    return res.json(clinic);
  });

  app.delete("/api/super/clinics/:id", requireSuperAdmin, async (req, res) => {
    await storage.deleteClinic(req.params.id);
    return res.json({ ok: true });
  });

  app.get("/api/super/appointments", requireSuperAdmin, async (req, res) => {
    const { status, date } = req.query;
    const appts = await storage.getAllAppointments({
      status: status ? String(status) : undefined,
      date: date ? String(date) : undefined,
    });
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  app.get("/api/super/message-logs", requireSuperAdmin, async (_req, res) => {
    const logs = await storage.getAllMessageLogs();
    return res.json(logs);
  });

  // Create admin user for a clinic (super admin)
  app.post("/api/super/clinics/:id/admin", requireSuperAdmin, async (req, res) => {
    const { username, password, fullName } = req.body;
    const user = await storage.createUser({
      username, password, fullName: fullName || username,
      role: "clinic_admin", clinicId: req.params.id, doctorId: null,
    });
    return res.json({ id: user.id, username: user.username, fullName: user.fullName });
  });

  // ── ADMIN: Stats & Analytics ─────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const stats = await storage.getClinicStats(clinicId);
    return res.json(stats);
  });

  app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const data = await storage.getAnalytics(clinicId);
    return res.json(data);
  });

  // ── ADMIN: Settings ─────────────────────────────────────
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const clinic = await storage.getClinic(clinicId);
    const whatsapp = getWhatsAppStatus();
    const fhirApiKey = process.env.FHIR_API_KEY || null;
    const host = process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : "http://localhost:5000";
    return res.json({
      clinic,
      whatsapp,
      fhir: { configured: !!fhirApiKey, apiKey: fhirApiKey, baseUrl: `${host}/fhir` },
      google: { configured: isGoogleConfigured() },
      sms: { configured: !!(process.env.SMS_API_KEY || clinic?.smsEnabled) },
      webhookUrl: `${host}/api/webhook/whatsapp`,
    });
  });

  app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const clinic = await storage.updateClinic(clinicId, req.body);
    return res.json(clinic);
  });

  app.post("/api/admin/whatsapp/test", requireAdmin, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });
    await sendBookingConfirmationRequest(phone, "Test Patient", "Dr. Test", "2026-01-01", "09:00");
    return res.json({ ok: true });
  });

  // ── ADMIN: Message Logs ──────────────────────────────────
  app.get("/api/admin/message-logs", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const logs = await storage.getMessageLogs(clinicId);
    return res.json(logs);
  });

  // ── ADMIN: Payments ──────────────────────────────────────
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const pays = await storage.getPaymentsByClinic(clinicId);
    return res.json(pays);
  });

  app.patch("/api/admin/payments/:id/mark-paid", requireAdmin, async (req, res) => {
    const pay = await storage.updatePayment(req.params.id, {
      status: "paid",
      gateway: "manual",
      paidAt: new Date(),
      transactionId: req.body.transactionId || `MANUAL-${Date.now()}`,
    });
    if (!pay) return res.status(404).json({ error: "Not found" });
    // Update appointment payment status
    await storage.updateAppointment(pay.appointmentId, {
      paymentStatus: "paid",
      status: "pending_confirmation",
    });
    return res.json(pay);
  });

  // ── ADMIN: Appointments ──────────────────────────────────
  app.get("/api/admin/appointments", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const { status, date } = req.query;
    const appts = await storage.getAppointmentsByClinic(clinicId, {
      status: status ? String(status) : undefined,
      date: date ? String(date) : undefined,
    });
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  app.get("/api/admin/appointments/today", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const today = new Date().toISOString().split("T")[0];
    const appts = await storage.getAppointmentsForDate(clinicId, null, today);
    const sorted = appts.sort((a, b) => a.time.localeCompare(b.time));
    const enriched = await enrichAppointments(sorted);
    return res.json(enriched);
  });

  app.patch("/api/admin/appointments/:id/status", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const appt = await storage.updateAppointmentStatus(id, status);
    if (!appt) return res.status(404).json({ error: "Not found" });

    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, appt.doctorId));
    const doctorName = docRow?.name ?? "your doctor";
    const opts = { clinicId: appt.clinicId, appointmentId: appt.id };

    if (status === "confirmed") {
      await sendConfirmedNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time, opts);
      const [svcRow] = await db.select().from(services).where(eq(services.id, appt.serviceId));
      const eventId = await syncAppointmentToCalendar(appt.doctorId, { ...appt, doctorName, serviceName: svcRow?.name ?? "" });
      if (eventId) await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
    }

    if (status === "cancelled") {
      await sendCancellationNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time, opts);
      if (appt.googleCalendarEventId) await removeAppointmentFromCalendar(appt.doctorId, appt.googleCalendarEventId);
    }

    if (status === "no_show" && appt.patientId) {
      const pat = await storage.getPatient(appt.patientId);
      if (pat) {
        const newCount = (pat.noShowCount || 0) + 1;
        await storage.updatePatient(appt.patientId, { noShowCount: newCount, isFlagged: newCount >= 3 });
      }
    }
    return res.json(appt);
  });

  // ── ADMIN: Doctors ────────────────────────────────────────
  app.get("/api/admin/doctors", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const docs = await storage.getDoctorsByClinic(clinicId);
    return res.json(docs);
  });

  app.post("/api/admin/doctors", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const data = insertDoctorSchema.parse({ ...req.body, clinicId });
    const doc = await storage.createDoctor(data);
    return res.json(doc);
  });

  app.patch("/api/admin/doctors/:id", requireAdmin, async (req, res) => {
    const doc = await storage.updateDoctor(req.params.id, req.body);
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  });

  app.delete("/api/admin/doctors/:id", requireAdmin, async (req, res) => {
    await storage.deleteDoctor(req.params.id);
    return res.json({ ok: true });
  });

  // ── ADMIN: Services ───────────────────────────────────────
  app.get("/api/admin/services", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const svcs = await storage.getServicesByClinic(clinicId);
    return res.json(svcs);
  });

  app.post("/api/admin/services", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const data = insertServiceSchema.parse({ ...req.body, clinicId });
    const svc = await storage.createService(data);
    return res.json(svc);
  });

  app.patch("/api/admin/services/:id", requireAdmin, async (req, res) => {
    const svc = await storage.updateService(req.params.id, req.body);
    if (!svc) return res.status(404).json({ error: "Not found" });
    return res.json(svc);
  });

  app.delete("/api/admin/services/:id", requireAdmin, async (req, res) => {
    await storage.deleteService(req.params.id);
    return res.json({ ok: true });
  });

  // ── ADMIN: Patients ───────────────────────────────────────
  app.get("/api/admin/patients", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const pats = await storage.getPatientsByClinic(clinicId);
    return res.json(pats);
  });

  app.patch("/api/admin/patients/:id", requireAdmin, async (req, res) => {
    const pat = await storage.updatePatient(req.params.id, req.body);
    if (!pat) return res.status(404).json({ error: "Not found" });
    return res.json(pat);
  });

  app.get("/api/admin/patients/:id/appointments", requireAdmin, async (req, res) => {
    const clinicId = getSessionClinicId(req);
    const appts = await db.select().from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), eq(appointments.patientId, req.params.id)))
      .orderBy(appointments.date, appointments.time);
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  // ── DOCTOR: Profile ──────────────────────────────────────
  app.get("/api/doctor/profile", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const doc = await storage.getDoctor(doctorId);
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  });

  app.patch("/api/doctor/profile", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const { photo, backgroundPhoto } = req.body;
    const doc = await storage.updateDoctor(doctorId, { photo, backgroundPhoto });
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  });

  // ── DOCTOR: Calendar ─────────────────────────────────────
  app.get("/api/doctor/calendar/status", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const status = await getDoctorCalendarStatus(doctorId);
    return res.json({ ...status, googleConfigured: isGoogleConfigured() });
  });

  app.get("/api/doctor/calendar/connect", requireDoctor, (req, res) => {
    const doctorId = (req.session as any).doctorId;
    if (!isGoogleConfigured()) return res.status(503).json({ error: "Google Calendar integration not configured" });
    return res.redirect(getAuthUrl(doctorId));
  });

  app.delete("/api/doctor/calendar/disconnect", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    await disconnectDoctorCalendar(doctorId);
    return res.json({ ok: true });
  });

  // ── DOCTOR: Appointments ──────────────────────────────────
  app.get("/api/doctor/appointments/today", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const today = new Date().toISOString().split("T")[0];
    const appts = await storage.getAppointmentsByDoctor(doctorId, { date: today });
    const sorted = appts.sort((a, b) => a.time.localeCompare(b.time));
    const enriched = await enrichAppointments(sorted);
    return res.json(enriched);
  });

  app.get("/api/doctor/appointments/week", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const today = new Date();
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      weekDates.push(d.toISOString().split("T")[0]);
    }
    const allAppts = await storage.getAppointmentsByDoctor(doctorId);
    const weekAppts = allAppts.filter(a => weekDates.includes(a.date));
    const sorted = weekAppts.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const enriched = await enrichAppointments(sorted);
    return res.json(enriched);
  });

  app.get("/api/doctor/appointments", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const { status } = req.query;
    const appts = await storage.getAppointmentsByDoctor(doctorId, { status: status ? String(status) : undefined });
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  app.patch("/api/doctor/appointments/:id/status", requireDoctor, async (req, res) => {
    const { status } = req.body;
    const appt = await storage.updateAppointmentStatus(req.params.id, status);
    if (!appt) return res.status(404).json({ error: "Not found" });

    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, appt.doctorId));
    const doctorName = docRow?.name ?? "your doctor";
    const opts = { clinicId: appt.clinicId, appointmentId: appt.id };

    if (status === "confirmed") {
      await sendConfirmedNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time, opts);
      const [svcRow] = await db.select().from(services).where(eq(services.id, appt.serviceId));
      const eventId = await syncAppointmentToCalendar(appt.doctorId, { ...appt, doctorName, serviceName: svcRow?.name ?? "" });
      if (eventId) await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
    }

    if (status === "cancelled") {
      await sendCancellationNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time, opts);
      if (appt.googleCalendarEventId) await removeAppointmentFromCalendar(appt.doctorId, appt.googleCalendarEventId);
    }

    if (status === "no_show" && appt.patientId) {
      const pat = await storage.getPatient(appt.patientId);
      if (pat) {
        const newCount = (pat.noShowCount || 0) + 1;
        await storage.updatePatient(appt.patientId, { noShowCount: newCount, isFlagged: newCount >= 3 });
      }
    }
    return res.json(appt);
  });

  app.get("/api/doctor/patients", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const appts = await storage.getAppointmentsByDoctor(doctorId);
    const patientIds = [...new Set(appts.map(a => a.patientId).filter(Boolean))] as string[];
    const pats = await Promise.all(patientIds.map(id => storage.getPatient(id)));
    return res.json(pats.filter(Boolean));
  });

  app.post("/api/doctor/appointments", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const clinicId = (req.session as any).clinicId || "clinic-1";
    const data = req.body;

    let patient = await storage.getPatientByPhone(clinicId, data.patientPhone);
    if (!patient) {
      patient = await storage.createPatient({
        clinicId, fullName: data.patientName, phone: data.patientPhone,
        notes: "", noShowCount: 0, isFlagged: false,
      });
    }

    const appt = await storage.createAppointment({
      clinicId, doctorId, serviceId: data.serviceId, patientId: patient.id,
      patientName: data.patientName, patientPhone: data.patientPhone,
      date: data.date, time: data.time, notes: data.notes || "", status: "confirmed",
    });

    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
    const [svcRow] = await db.select().from(services).where(eq(services.id, data.serviceId));
    const doctorName = docRow?.name ?? "your doctor";
    await sendConfirmedNotice(data.patientPhone, data.patientName, doctorName, data.date, data.time,
      { clinicId, appointmentId: appt.id });

    const eventId = await syncAppointmentToCalendar(doctorId, { ...appt, doctorName, serviceName: svcRow?.name ?? "" });
    if (eventId) await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));

    return res.json(appt);
  });

  app.post("/api/doctor/arrived", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const today = new Date().toISOString().split("T")[0];
    const appts = await storage.getAppointmentsByDoctor(doctorId, { date: today });
    const confirmed = appts.filter(a => a.status === "confirmed");

    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
    const doctorName = docRow?.name ?? "your doctor";

    await Promise.all(confirmed.map(a =>
      sendDoctorArrivedBroadcast(a.patientPhone, a.patientName, doctorName,
        { clinicId: a.clinicId, appointmentId: a.id })
    ));

    console.log(`[WhatsApp Broadcast] Doctor arrived. Notified ${confirmed.length} patients.`);
    return res.json({ notified: confirmed.length });
  });

  return httpServer;
}
