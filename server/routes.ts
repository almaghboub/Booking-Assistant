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
  insertDoctorSchema, insertServiceSchema, insertAppointmentSchema, insertPatientSchema,
  appointments, doctors, services, patients, users, clinics,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { Pool } from "pg";
import {
  sendBookingConfirmationRequest, sendConfirmedNotice,
  sendCancellationNotice, sendDoctorArrivedBroadcast, getWhatsAppStatus,
} from "./whatsapp";
import { registerFhirRoutes } from "./fhir";
import {
  isGoogleConfigured, getAuthUrl, exchangeCodeForTokens,
  storeDoctorTokens, disconnectDoctorCalendar, getDoctorCalendarStatus,
  syncAppointmentToCalendar, removeAppointmentFromCalendar,
} from "./googleCalendar";

const PgStore = connectPg(session);
const CLINIC_ID = "clinic-1";

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

function requireAuth(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) return res.status(401).json({ error: "Not authenticated" });
  if ((req.session as any).userRole !== "clinic_admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

function requireDoctor(req: Request, res: Response, next: Function) {
  if (!(req.session as any).userId) return res.status(401).json({ error: "Not authenticated" });
  if ((req.session as any).userRole !== "doctor") return res.status(403).json({ error: "Forbidden" });
  next();
}

async function enrichAppointments(appts: any[]) {
  const allDoctors = await db.select().from(doctors);
  const allServices = await db.select().from(services);
  return appts.map(a => ({
    ...a,
    doctorName: allDoctors.find(d => d.id === a.doctorId)?.name ?? "Unknown",
    serviceName: allServices.find(s => s.id === a.serviceId)?.name ?? "Unknown",
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

  // Register FHIR routes (includes /fhir/metadata public + authenticated routes)
  registerFhirRoutes(app);

  // ───── FILE UPLOAD ────────────────────────────────────
  app.use("/uploads", express.static(uploadDir));

  app.post("/api/upload", requireAuth, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    return res.json({ url: `/uploads/${req.file.filename}` });
  });

  // ───── AUTH ──────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    (req.session as any).userId = user.id;
    (req.session as any).userRole = user.role;
    (req.session as any).doctorId = user.doctorId;
    return res.json({ id: user.id, role: user.role, fullName: user.fullName, username: user.username });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser((req.session as any).userId);
    if (!user) return res.status(401).json({ error: "Not found" });
    return res.json({ id: user.id, role: user.role, fullName: user.fullName, username: user.username, doctorId: user.doctorId });
  });

  // ───── GOOGLE OAUTH CALLBACK ─────────────────────────
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: doctorId, error } = req.query as Record<string, string>;

    if (error || !code || !doctorId) {
      return res.redirect("/doctor/dashboard?calendarError=1");
    }

    try {
      const { access_token, refresh_token, expiry_date } = await exchangeCodeForTokens(code);
      await storeDoctorTokens(doctorId, access_token, refresh_token || "", expiry_date);
      return res.redirect("/doctor/dashboard?calendarConnected=1");
    } catch (e) {
      console.error("[Google OAuth] Callback error:", e);
      return res.redirect("/doctor/dashboard?calendarError=1");
    }
  });

  // ───── PUBLIC BOOKING ─────────────────────────────────
  app.get("/api/public/doctors", async (req, res) => {
    const { clinicId } = req.query;
    const docs = await storage.getDoctorsByClinic(String(clinicId || CLINIC_ID));
    return res.json(docs);
  });

  app.get("/api/public/services", async (req, res) => {
    const { clinicId, doctorId } = req.query;
    const cId = String(clinicId || CLINIC_ID);
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
    const available = allSlots.filter(s => !bookedTimes.has(s));

    return res.json(available);
  });

  app.post("/api/public/appointments", async (req, res) => {
    const data = req.body;
    const cId = data.clinicId || CLINIC_ID;

    let patient = await storage.getPatientByPhone(cId, data.patientPhone);
    if (!patient) {
      patient = await storage.createPatient({
        clinicId: cId,
        fullName: data.patientName,
        phone: data.patientPhone,
        notes: "",
        noShowCount: 0,
        isFlagged: false,
      });
    }

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
      status: "pending_confirmation",
    });

    // Lookup doctor name for notifications/calendar
    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, data.doctorId));
    const [svcRow] = await db.select().from(services).where(eq(services.id, data.serviceId));
    const doctorName = docRow?.name ?? "your doctor";

    // WhatsApp: notify patient of pending confirmation
    await sendBookingConfirmationRequest(data.patientPhone, data.patientName, doctorName, data.date, data.time);

    // Google Calendar: sync to doctor's calendar (pending)
    const eventId = await syncAppointmentToCalendar(data.doctorId, {
      ...appt,
      doctorName,
      serviceName: svcRow?.name ?? "",
    });
    if (eventId) {
      await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
    }

    return res.json(appt);
  });

  // ───── ADMIN: STATS & ANALYTICS ──────────────────────
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    const stats = await storage.getClinicStats(CLINIC_ID);
    return res.json(stats);
  });

  app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
    const data = await storage.getAnalytics(CLINIC_ID);
    return res.json(data);
  });

  // ───── ADMIN: SETTINGS ────────────────────────────────
  app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
    const whatsapp = getWhatsAppStatus();
    const fhirApiKey = process.env.FHIR_API_KEY || null;
    const host = process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : "http://localhost:5000";
    return res.json({
      whatsapp,
      fhir: {
        configured: !!fhirApiKey,
        apiKey: fhirApiKey,
        baseUrl: `${host}/fhir`,
      },
      google: {
        configured: isGoogleConfigured(),
      },
    });
  });

  // Send a test WhatsApp message (admin)
  app.post("/api/admin/whatsapp/test", requireAdmin, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });
    await sendBookingConfirmationRequest(phone, "Test Patient", "Dr. Test", "2026-01-01", "09:00");
    return res.json({ ok: true });
  });

  // ───── ADMIN: APPOINTMENTS ────────────────────────────
  app.get("/api/admin/appointments", requireAdmin, async (req, res) => {
    const { status, date } = req.query;
    const appts = await storage.getAppointmentsByClinic(CLINIC_ID, {
      status: status ? String(status) : undefined,
      date: date ? String(date) : undefined,
    });
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  app.get("/api/admin/appointments/today", requireAdmin, async (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const appts = await storage.getAppointmentsForDate(CLINIC_ID, null, today);
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

    if (status === "confirmed") {
      await sendConfirmedNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time);
      // Sync calendar event
      const [svcRow] = await db.select().from(services).where(eq(services.id, appt.serviceId));
      const eventId = await syncAppointmentToCalendar(appt.doctorId, {
        ...appt,
        doctorName,
        serviceName: svcRow?.name ?? "",
      });
      if (eventId) {
        await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
      }
    }

    if (status === "cancelled") {
      await sendCancellationNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time);
      // Remove calendar event
      if (appt.googleCalendarEventId) {
        await removeAppointmentFromCalendar(appt.doctorId, appt.googleCalendarEventId);
      }
    }

    if (status === "no_show" && appt.patientId) {
      const pat = await storage.getPatient(appt.patientId);
      if (pat) {
        const newCount = (pat.noShowCount || 0) + 1;
        await storage.updatePatient(appt.patientId, {
          noShowCount: newCount,
          isFlagged: newCount >= 3,
        });
      }
    }
    return res.json(appt);
  });

  // ───── ADMIN: DOCTORS ─────────────────────────────────
  app.get("/api/admin/doctors", requireAdmin, async (req, res) => {
    const docs = await storage.getDoctorsByClinic(CLINIC_ID);
    return res.json(docs);
  });

  app.post("/api/admin/doctors", requireAdmin, async (req, res) => {
    const data = insertDoctorSchema.parse({ ...req.body, clinicId: CLINIC_ID });
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

  // ───── ADMIN: SERVICES ────────────────────────────────
  app.get("/api/admin/services", requireAdmin, async (req, res) => {
    const svcs = await storage.getServicesByClinic(CLINIC_ID);
    return res.json(svcs);
  });

  app.post("/api/admin/services", requireAdmin, async (req, res) => {
    const data = insertServiceSchema.parse({ ...req.body, clinicId: CLINIC_ID });
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

  // ───── ADMIN: PATIENTS ────────────────────────────────
  app.get("/api/admin/patients", requireAdmin, async (req, res) => {
    const pats = await storage.getPatientsByClinic(CLINIC_ID);
    return res.json(pats);
  });

  app.patch("/api/admin/patients/:id", requireAdmin, async (req, res) => {
    const pat = await storage.updatePatient(req.params.id, req.body);
    if (!pat) return res.status(404).json({ error: "Not found" });
    return res.json(pat);
  });

  app.get("/api/admin/patients/:id/appointments", requireAdmin, async (req, res) => {
    const appts = await db.select().from(appointments)
      .where(and(eq(appointments.clinicId, CLINIC_ID), eq(appointments.patientId, req.params.id)))
      .orderBy(appointments.date, appointments.time);
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  // ───── DOCTOR: PROFILE ───────────────────────────────
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

  // ───── DOCTOR: CALENDAR ──────────────────────────────
  app.get("/api/doctor/calendar/status", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    const status = await getDoctorCalendarStatus(doctorId);
    return res.json({ ...status, googleConfigured: isGoogleConfigured() });
  });

  app.get("/api/doctor/calendar/connect", requireDoctor, (req, res) => {
    const doctorId = (req.session as any).doctorId;
    if (!isGoogleConfigured()) {
      return res.status(503).json({ error: "Google Calendar integration not configured" });
    }
    const url = getAuthUrl(doctorId);
    return res.redirect(url);
  });

  app.delete("/api/doctor/calendar/disconnect", requireDoctor, async (req, res) => {
    const doctorId = (req.session as any).doctorId;
    await disconnectDoctorCalendar(doctorId);
    return res.json({ ok: true });
  });

  // ───── DOCTOR: APPOINTMENTS ─────────────────────────
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
    const appts = await storage.getAppointmentsByDoctor(doctorId, {
      status: status ? String(status) : undefined,
    });
    const enriched = await enrichAppointments(appts);
    return res.json(enriched);
  });

  app.patch("/api/doctor/appointments/:id/status", requireDoctor, async (req, res) => {
    const { status } = req.body;
    const appt = await storage.updateAppointmentStatus(req.params.id, status);
    if (!appt) return res.status(404).json({ error: "Not found" });

    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, appt.doctorId));
    const doctorName = docRow?.name ?? "your doctor";

    if (status === "confirmed") {
      await sendConfirmedNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time);
      const [svcRow] = await db.select().from(services).where(eq(services.id, appt.serviceId));
      const eventId = await syncAppointmentToCalendar(appt.doctorId, {
        ...appt,
        doctorName,
        serviceName: svcRow?.name ?? "",
      });
      if (eventId) {
        await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
      }
    }

    if (status === "cancelled") {
      await sendCancellationNotice(appt.patientPhone, appt.patientName, doctorName, appt.date, appt.time);
      if (appt.googleCalendarEventId) {
        await removeAppointmentFromCalendar(appt.doctorId, appt.googleCalendarEventId);
      }
    }

    if (status === "no_show" && appt.patientId) {
      const pat = await storage.getPatient(appt.patientId);
      if (pat) {
        const newCount = (pat.noShowCount || 0) + 1;
        await storage.updatePatient(appt.patientId, {
          noShowCount: newCount,
          isFlagged: newCount >= 3,
        });
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
    const data = req.body;

    let patient = await storage.getPatientByPhone(CLINIC_ID, data.patientPhone);
    if (!patient) {
      patient = await storage.createPatient({
        clinicId: CLINIC_ID,
        fullName: data.patientName,
        phone: data.patientPhone,
        notes: "",
        noShowCount: 0,
        isFlagged: false,
      });
    }

    const appt = await storage.createAppointment({
      clinicId: CLINIC_ID,
      doctorId,
      serviceId: data.serviceId,
      patientId: patient.id,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      date: data.date,
      time: data.time,
      notes: data.notes || "",
      status: "confirmed",
    });

    // WhatsApp: confirmed immediately (phone booking by doctor)
    const [docRow] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
    const [svcRow] = await db.select().from(services).where(eq(services.id, data.serviceId));
    const doctorName = docRow?.name ?? "your doctor";
    await sendConfirmedNotice(data.patientPhone, data.patientName, doctorName, data.date, data.time);

    // Google Calendar sync
    const eventId = await syncAppointmentToCalendar(doctorId, {
      ...appt,
      doctorName,
      serviceName: svcRow?.name ?? "",
    });
    if (eventId) {
      await db.update(appointments).set({ googleCalendarEventId: eventId }).where(eq(appointments.id, appt.id));
    }

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
      sendDoctorArrivedBroadcast(a.patientPhone, a.patientName, doctorName)
    ));

    console.log(`[WhatsApp Broadcast] Doctor arrived. Notified ${confirmed.length} patients.`);
    return res.json({ notified: confirmed.length });
  });

  return httpServer;
}
