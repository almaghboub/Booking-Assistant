/**
 * HL7 FHIR R4 adapter
 * Exposes FHIR-compliant endpoints so external HIS/EMR systems can
 * read and write Patients and Appointments via the standard FHIR API.
 *
 * Base URL:  /fhir
 * Auth:      Authorization: Bearer <FHIR_API_KEY>  (env var)
 *
 * Supported resources:
 *   GET  /fhir/metadata                   CapabilityStatement (public)
 *   GET  /fhir/Patient                    Search (name, phone)
 *   GET  /fhir/Patient/:id                Read
 *   POST /fhir/Patient                    Create
 *   GET  /fhir/Appointment                Search (date, doctor, status)
 *   GET  /fhir/Appointment/:id            Read
 *   POST /fhir/Appointment                Create (auto-confirmed)
 *   PUT  /fhir/Appointment/:id            Update status
 */

import type { Request, Response, NextFunction, Express } from "express";
import { storage } from "./storage";
import type { Patient, Appointment } from "@shared/schema";

const FHIR_BASE = process.env.FHIR_BASE_URL || "http://localhost:5000/fhir";
const FHIR_API_KEY = process.env.FHIR_API_KEY;
const CLINIC_ID = "clinic-1";

// ─── Auth middleware ────────────────────────────────────────────────────────

export function requireFhirKey(req: Request, res: Response, next: NextFunction) {
  if (!FHIR_API_KEY) {
    return res.status(503).json(operationOutcome("error", "FHIR integration not configured — set FHIR_API_KEY"));
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== FHIR_API_KEY) {
    return res.status(401).json(operationOutcome("error", "Invalid or missing FHIR API key"));
  }
  next();
}

// ─── FHIR helpers ───────────────────────────────────────────────────────────

function operationOutcome(severity: string, message: string) {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code: "processing", diagnostics: message }],
  };
}

function bundle(entries: any[]) {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries.map(resource => ({ resource })),
  };
}

// ─── Resource mappers ───────────────────────────────────────────────────────

export function toFhirPatient(p: Patient) {
  return {
    resourceType: "Patient",
    id: p.id,
    meta: { lastUpdated: p.createdAt },
    name: [{ use: "official", text: p.fullName }],
    telecom: [{ system: "phone", value: p.phone, use: "mobile" }],
    note: p.notes ? [{ text: p.notes }] : [],
    extension: [
      { url: "https://rakaz.clinic/fhir/ext/noShowCount", valueInteger: p.noShowCount ?? 0 },
      { url: "https://rakaz.clinic/fhir/ext/isFlagged", valueBoolean: p.isFlagged ?? false },
    ],
  };
}

export function toFhirAppointment(a: Appointment) {
  const statusMap: Record<string, string> = {
    pending_confirmation: "proposed",
    confirmed: "booked",
    completed: "fulfilled",
    cancelled: "cancelled",
    no_show: "noshow",
  };
  return {
    resourceType: "Appointment",
    id: a.id,
    meta: { lastUpdated: a.createdAt },
    status: statusMap[a.status] ?? "proposed",
    start: `${a.date}T${a.time}:00`,
    serviceType: [{ coding: [{ code: a.serviceId }] }],
    participant: [
      { actor: { reference: `Practitioner/${a.doctorId}` }, status: "accepted" },
      { actor: { reference: `Patient/${a.patientId}` }, status: "accepted" },
    ],
    extension: [
      { url: "https://rakaz.clinic/fhir/ext/patientName", valueString: a.patientName },
      { url: "https://rakaz.clinic/fhir/ext/patientPhone", valueString: a.patientPhone },
      { url: "https://rakaz.clinic/fhir/ext/notes", valueString: a.notes ?? "" },
    ],
  };
}

function fhirStatusToInternal(fhirStatus: string): string {
  const map: Record<string, string> = {
    proposed: "pending_confirmation",
    booked: "confirmed",
    fulfilled: "completed",
    cancelled: "cancelled",
    noshow: "no_show",
  };
  return map[fhirStatus] ?? "pending_confirmation";
}

// ─── Route registration ─────────────────────────────────────────────────────

export function registerFhirRoutes(app: Express) {
  // Capability statement — public, no auth
  app.get("/fhir/metadata", (_req, res) => {
    res.json({
      resourceType: "CapabilityStatement",
      status: "active",
      kind: "instance",
      fhirVersion: "4.0.1",
      format: ["json"],
      software: { name: "Rakaz Clinic FHIR Adapter", version: "1.0" },
      rest: [{
        mode: "server",
        security: { description: "Bearer token required (Authorization: Bearer <FHIR_API_KEY>)" },
        resource: [
          { type: "Patient",     interaction: [{ code: "read" }, { code: "search-type" }, { code: "create" }] },
          { type: "Appointment", interaction: [{ code: "read" }, { code: "search-type" }, { code: "create" }, { code: "update" }] },
        ],
      }],
    });
  });

  // ── Patient ─────────────────────────────────────────────────────────────

  app.get("/fhir/Patient", requireFhirKey, async (req, res) => {
    const patients = await storage.getPatientsByClinic(CLINIC_ID);
    const { name, phone } = req.query as Record<string, string>;
    const filtered = patients.filter(p =>
      (!name  || p.fullName.toLowerCase().includes(name.toLowerCase())) &&
      (!phone || p.phone.includes(phone))
    );
    res.json(bundle(filtered.map(toFhirPatient)));
  });

  app.get("/fhir/Patient/:id", requireFhirKey, async (req, res) => {
    const p = await storage.getPatient(req.params.id);
    if (!p) return res.status(404).json(operationOutcome("error", "Patient not found"));
    res.json(toFhirPatient(p));
  });

  app.post("/fhir/Patient", requireFhirKey, async (req, res) => {
    const body = req.body;
    const fullName = body.name?.[0]?.text || "";
    const phone    = body.telecom?.find((t: any) => t.system === "phone")?.value || "";
    if (!fullName || !phone) {
      return res.status(400).json(operationOutcome("error", "Patient requires name and phone"));
    }
    const existing = await storage.getPatientByPhone(CLINIC_ID, phone);
    if (existing) return res.status(409).json(toFhirPatient(existing));
    const patient = await storage.createPatient({ clinicId: CLINIC_ID, fullName, phone, notes: "", noShowCount: 0, isFlagged: false });
    res.status(201).json(toFhirPatient(patient));
  });

  // ── Appointment ─────────────────────────────────────────────────────────

  app.get("/fhir/Appointment", requireFhirKey, async (req, res) => {
    const { date, doctor, status } = req.query as Record<string, string>;
    const appts = await storage.getAppointmentsByClinic(CLINIC_ID, {
      date: date || undefined,
      status: status ? fhirStatusToInternal(status) : undefined,
    });
    const filtered = doctor ? appts.filter(a => a.doctorId === doctor) : appts;
    res.json(bundle(filtered.map(toFhirAppointment)));
  });

  app.get("/fhir/Appointment/:id", requireFhirKey, async (req, res) => {
    const a = await storage.getAppointment(req.params.id);
    if (!a) return res.status(404).json(operationOutcome("error", "Appointment not found"));
    res.json(toFhirAppointment(a));
  });

  app.post("/fhir/Appointment", requireFhirKey, async (req, res) => {
    const body = req.body;
    const start = body.start as string; // "2026-03-01T09:00:00"
    if (!start) return res.status(400).json(operationOutcome("error", "Appointment requires start date"));

    const [date, timePart] = start.split("T");
    const time = timePart ? timePart.substring(0, 5) : "09:00";
    const doctorRef = body.participant?.find((p: any) => p.actor?.reference?.startsWith("Practitioner/"));
    const patientRef = body.participant?.find((p: any) => p.actor?.reference?.startsWith("Patient/"));
    const doctorId = doctorRef?.actor?.reference?.split("/")?.[1] || "";
    const patientId = patientRef?.actor?.reference?.split("/")?.[1] || "";
    const serviceId = body.serviceType?.[0]?.coding?.[0]?.code || "";
    const ext = (url: string) => body.extension?.find((e: any) => e.url === url);
    const patientName = ext("https://rakaz.clinic/fhir/ext/patientName")?.valueString || "HIS Patient";
    const patientPhone = ext("https://rakaz.clinic/fhir/ext/patientPhone")?.valueString || "";

    if (!doctorId || !serviceId || !patientPhone) {
      return res.status(400).json(operationOutcome("error", "Appointment requires doctor, service, and patient phone"));
    }

    let patient = patientId ? await storage.getPatient(patientId) : null;
    if (!patient) {
      patient = await storage.getPatientByPhone(CLINIC_ID, patientPhone);
    }
    if (!patient) {
      patient = await storage.createPatient({ clinicId: CLINIC_ID, fullName: patientName, phone: patientPhone, notes: "", noShowCount: 0, isFlagged: false });
    }

    const appt = await storage.createAppointment({
      clinicId: CLINIC_ID, doctorId, serviceId,
      patientId: patient.id, patientName, patientPhone,
      date, time, notes: ext("https://rakaz.clinic/fhir/ext/notes")?.valueString || "",
      status: fhirStatusToInternal(body.status || "booked"),
    });
    res.status(201).json(toFhirAppointment(appt));
  });

  app.put("/fhir/Appointment/:id", requireFhirKey, async (req, res) => {
    const fhirStatus = req.body.status;
    if (!fhirStatus) return res.status(400).json(operationOutcome("error", "status is required"));
    const appt = await storage.updateAppointmentStatus(req.params.id, fhirStatusToInternal(fhirStatus));
    if (!appt) return res.status(404).json(operationOutcome("error", "Appointment not found"));
    res.json(toFhirAppointment(appt));
  });
}
