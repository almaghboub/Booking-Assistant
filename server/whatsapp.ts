/**
 * WhatsApp Business Cloud API (Meta)
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Required environment variables:
 *   WHATSAPP_API_TOKEN       - Permanent token from Meta Business Manager
 *   WHATSAPP_PHONE_NUMBER_ID - Phone Number ID from Meta Business Manager
 *   WHATSAPP_VERIFY_TOKEN    - Webhook verification token (set in Meta dashboard)
 *   WHATSAPP_APP_SECRET      - App secret for webhook signature verification
 */

import { db } from "./storage";
import { appointments, doctors, messageLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "rakaz-webhook-token";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const BASE_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

export function isConfigured(): boolean {
  return !!(API_TOKEN && PHONE_NUMBER_ID);
}

/** Strip non-digit characters and ensure no leading + for comparison */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `218${digits.slice(1)}` : digits;
}

async function sendMessage(to: string, body: string): Promise<boolean> {
  const phone = normalizePhone(to);

  if (!isConfigured()) {
    console.log(`[WhatsApp STUB → ${phone}] ${body}`);
    return true;
  }

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body },
  };

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[WhatsApp] Failed to send to ${phone}: ${err}`);
      return false;
    }
    console.log(`[WhatsApp] Message sent to ${phone}`);
    return true;
  } catch (e) {
    console.error(`[WhatsApp] Network error sending to ${phone}:`, e);
    return false;
  }
}

async function logMessage(
  clinicId: string,
  phone: string,
  messageType: string,
  status: string,
  appointmentId?: string
): Promise<void> {
  await db.insert(messageLogs).values({
    appointmentId: appointmentId || null,
    clinicId,
    channel: "whatsapp",
    messageType,
    recipientPhone: phone,
    status,
  });
}

/** Sent when a new online booking is created */
export async function sendBookingConfirmationRequest(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  options?: { clinicId?: string; appointmentId?: string }
): Promise<void> {
  const body =
    `Hello ${patientName}, your appointment request with ${doctorName} on ${date} at ${time} has been received.\n\n` +
    `Reply *YES* to confirm or *NO* to cancel.\n\nThank you – Rakaz Clinic`;
  const ok = await sendMessage(phone, body);
  if (options?.clinicId) {
    await logMessage(options.clinicId, phone, "confirmation", ok ? "sent" : "failed", options.appointmentId);
  }
}

/** Sent when an appointment is confirmed */
export async function sendConfirmedNotice(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  options?: { clinicId?: string; appointmentId?: string }
): Promise<void> {
  const body =
    `✅ Hello ${patientName}, your appointment with ${doctorName} on ${date} at ${time} is *confirmed*.\n\nPlease arrive 10 minutes early. – Rakaz Clinic`;
  const ok = await sendMessage(phone, body);
  if (options?.clinicId) {
    await logMessage(options.clinicId, phone, "confirmation", ok ? "sent" : "failed", options.appointmentId);
  }
}

/** Sent when an appointment is cancelled */
export async function sendCancellationNotice(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  options?: { clinicId?: string; appointmentId?: string }
): Promise<void> {
  const body =
    `Hello ${patientName}, your appointment with ${doctorName} on ${date} at ${time} has been *cancelled*.\n\nTo rebook, visit our website or call the clinic. – Rakaz Clinic`;
  const ok = await sendMessage(phone, body);
  if (options?.clinicId) {
    await logMessage(options.clinicId, phone, "cancellation", ok ? "sent" : "failed", options.appointmentId);
  }
}

/** Reminder notification */
export async function sendWhatsAppReminder(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  hoursAhead: number,
  appointmentId?: string,
  clinicId?: string
): Promise<void> {
  const body =
    `⏰ Reminder: Hello ${patientName}, your appointment with ${doctorName} is in *${hoursAhead} hours* on ${date} at ${time}.\n\nPlease arrive 10 minutes early. – Rakaz Clinic`;
  const ok = await sendMessage(phone, body);
  if (clinicId) {
    await logMessage(clinicId, phone, `reminder_${hoursAhead}h`, ok ? "sent" : "failed", appointmentId);
  }
}

/** Broadcast sent to all confirmed patients when the doctor arrives */
export async function sendDoctorArrivedBroadcast(
  phone: string,
  patientName: string,
  doctorName: string,
  options?: { clinicId?: string; appointmentId?: string }
): Promise<void> {
  const body =
    `🏥 Hello ${patientName}, ${doctorName} has arrived at the clinic. Please head over now and arrive within 10 minutes. – Rakaz Clinic`;
  const ok = await sendMessage(phone, body);
  if (options?.clinicId) {
    await logMessage(options.clinicId, phone, "arrival", ok ? "sent" : "failed", options.appointmentId);
  }
}

/** Returns whether the WhatsApp integration is configured */
export function getWhatsAppStatus(): { configured: boolean; phoneNumberId: string | null } {
  return {
    configured: isConfigured(),
    phoneNumberId: PHONE_NUMBER_ID || null,
  };
}

/** Verify webhook GET challenge from Meta */
export function verifyWebhookChallenge(
  mode: string,
  token: string,
  challenge: string,
  clinicVerifyToken?: string
): string | null {
  const expected = clinicVerifyToken || VERIFY_TOKEN;
  if (mode === "subscribe" && token === expected) return challenge;
  return null;
}

/** Verify webhook POST signature from Meta */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!APP_SECRET) return true; // Skip verification if not configured
  const expected = `sha256=${crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex")}`;
  return signature === expected;
}

/** Process incoming WhatsApp webhook message payload */
export async function processWhatsAppWebhook(body: any): Promise<void> {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      if (msg.type !== "text") continue;

      const fromPhone = msg.from; // e.g. "218911234567"
      const text = msg.text?.body?.trim().toUpperCase();

      if (!text || (text !== "YES" && text !== "NO")) continue;

      console.log(`[WhatsApp Webhook] Reply from ${fromPhone}: ${text}`);

      // Find a pending_confirmation appointment by phone number
      // Try matching with various phone formats
      const allPending = await db.select().from(appointments)
        .where(eq(appointments.status, "pending_confirmation"));

      const match = allPending.find(a => {
        const normalized = normalizePhone(a.patientPhone);
        return normalized === fromPhone || normalized === fromPhone.replace(/^218/, "0");
      });

      if (!match) {
        console.log(`[WhatsApp Webhook] No pending appointment found for ${fromPhone}`);
        continue;
      }

      const [doc] = await db.select().from(doctors).where(eq(doctors.id, match.doctorId));
      const doctorName = doc?.name ?? "your doctor";

      if (text === "YES") {
        // Confirm appointment
        await db.update(appointments)
          .set({ status: "confirmed", confirmationTime: new Date() })
          .where(eq(appointments.id, match.id));

        await sendConfirmedNotice(
          match.patientPhone, match.patientName, doctorName, match.date, match.time,
          { clinicId: match.clinicId, appointmentId: match.id }
        );
        console.log(`[WhatsApp Webhook] Appointment ${match.id} confirmed via WhatsApp reply`);
      } else if (text === "NO") {
        // Cancel appointment
        await db.update(appointments)
          .set({ status: "cancelled" })
          .where(eq(appointments.id, match.id));

        await sendCancellationNotice(
          match.patientPhone, match.patientName, doctorName, match.date, match.time,
          { clinicId: match.clinicId, appointmentId: match.id }
        );
        console.log(`[WhatsApp Webhook] Appointment ${match.id} cancelled via WhatsApp reply`);
      }
    }
  } catch (e) {
    console.error("[WhatsApp Webhook] Error processing:", e);
  }
}
