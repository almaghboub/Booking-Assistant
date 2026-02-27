/**
 * Google Calendar integration
 * Uses OAuth 2.0 per-doctor tokens stored in the database.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI  (defaults to http://localhost:5000/api/auth/google/callback)
 *
 * Flow:
 *   1. Doctor clicks "Connect Google Calendar" in dashboard
 *   2. Browser redirects to /api/doctor/calendar/connect
 *   3. Server redirects to Google OAuth consent screen
 *   4. Google redirects back to /api/auth/google/callback with ?code=...
 *   5. Server exchanges code for tokens, stores in doctors table
 *   6. Subsequent appointment creates/updates sync to calendar
 *   7. Cancelled appointments delete the calendar event
 */

import { storage, db } from "./storage";
import { doctors } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Appointment } from "@shared/schema";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback";
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function isGoogleConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

// ─── OAuth URL ──────────────────────────────────────────────────────────────

export function getAuthUrl(doctorId: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: doctorId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── Token exchange ─────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string): Promise<{ access_token: string; refresh_token?: string; expiry_date: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as any;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// ─── Token refresh ──────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as any;
  return { access_token: data.access_token, expiry_date: Date.now() + (data.expires_in || 3600) * 1000 };
}

// ─── Get valid access token for a doctor ────────────────────────────────────

async function getAccessToken(doctorId: string): Promise<string | null> {
  const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
  if (!doc?.googleRefreshToken) return null;

  const expiry = doc.googleTokenExpiry ? new Date(doc.googleTokenExpiry).getTime() : 0;
  if (doc.googleAccessToken && Date.now() < expiry - 60_000) {
    return doc.googleAccessToken;
  }

  // Refresh
  try {
    const { access_token, expiry_date } = await refreshAccessToken(doc.googleRefreshToken);
    await db.update(doctors).set({
      googleAccessToken: access_token,
      googleTokenExpiry: new Date(expiry_date),
    }).where(eq(doctors.id, doctorId));
    return access_token;
  } catch (e) {
    console.error(`[Google Calendar] Failed to refresh token for doctor ${doctorId}:`, e);
    return null;
  }
}

// ─── Store tokens after OAuth callback ─────────────────────────────────────

export async function storeDoctorTokens(
  doctorId: string,
  accessToken: string,
  refreshToken: string,
  expiryDate: number,
  calendarId = "primary"
): Promise<void> {
  await db.update(doctors).set({
    googleAccessToken: accessToken,
    googleRefreshToken: refreshToken,
    googleTokenExpiry: new Date(expiryDate),
    googleCalendarId: calendarId,
  }).where(eq(doctors.id, doctorId));
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

export async function disconnectDoctorCalendar(doctorId: string): Promise<void> {
  await db.update(doctors).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
    googleCalendarId: null,
  }).where(eq(doctors.id, doctorId));
}

// ─── Get calendar status for a doctor ───────────────────────────────────────

export async function getDoctorCalendarStatus(doctorId: string): Promise<{ connected: boolean; calendarId: string | null }> {
  const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
  return {
    connected: !!(doc?.googleRefreshToken),
    calendarId: doc?.googleCalendarId || null,
  };
}

// ─── Sync appointment to Google Calendar ────────────────────────────────────

export async function syncAppointmentToCalendar(
  doctorId: string,
  appointment: Appointment & { doctorName?: string; serviceName?: string }
): Promise<string | null> {
  if (!isGoogleConfigured()) return null;
  const token = await getAccessToken(doctorId);
  if (!token) return null;

  const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
  const calendarId = doc?.googleCalendarId || "primary";

  const startDateTime = `${appointment.date}T${appointment.time}:00`;
  const [h, m] = appointment.time.split(":").map(Number);
  const endMinutes = h * 60 + m + 30;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  const endDateTime = `${appointment.date}T${endTime}:00`;

  const event = {
    summary: `Appointment: ${appointment.patientName}`,
    description: `Patient: ${appointment.patientName}\nPhone: ${appointment.patientPhone}${appointment.serviceName ? `\nService: ${appointment.serviceName}` : ""}${appointment.notes ? `\nNotes: ${appointment.notes}` : ""}`,
    start: { dateTime: startDateTime, timeZone: "Africa/Tripoli" },
    end:   { dateTime: endDateTime,   timeZone: "Africa/Tripoli" },
    colorId: "2",
  };

  try {
    // If there's an existing event, update it; otherwise create
    const existingEventId = appointment.googleCalendarEventId;
    let method = "POST";
    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    if (existingEventId) {
      method = "PUT";
      url = `${url}/${existingEventId}`;
    }

    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      console.error(`[Google Calendar] Failed to sync event:`, await res.text());
      return null;
    }
    const data = await res.json() as any;
    return data.id as string;
  } catch (e) {
    console.error("[Google Calendar] Error syncing appointment:", e);
    return null;
  }
}

// ─── Remove event from calendar (on cancellation) ───────────────────────────

export async function removeAppointmentFromCalendar(
  doctorId: string,
  eventId: string
): Promise<void> {
  if (!isGoogleConfigured()) return;
  const token = await getAccessToken(doctorId);
  if (!token) return;

  const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
  const calendarId = doc?.googleCalendarId || "primary";

  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`[Google Calendar] Removed event ${eventId}`);
  } catch (e) {
    console.error("[Google Calendar] Error removing event:", e);
  }
}
