/**
 * SMS Service
 * Supports Twilio, Vonage, or custom HTTP SMS gateways.
 * Configure via environment variables or per-clinic settings.
 *
 * Required env vars (global fallback):
 *   SMS_PROVIDER       - twilio | vonage | custom
 *   SMS_API_KEY        - API key / Account SID
 *   SMS_API_SECRET     - Auth token / API secret (Twilio)
 *   SMS_SENDER_ID      - From number or sender ID
 *   SMS_CUSTOM_URL     - For custom provider: full POST URL
 */

import { db } from "./storage";
import { clinics, messageLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

interface SmsConfig {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  senderId: string;
  customUrl?: string;
}

function getGlobalConfig(): SmsConfig | null {
  const provider = process.env.SMS_PROVIDER || "twilio";
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID;
  if (!apiKey || !senderId) return null;
  return {
    provider,
    apiKey,
    apiSecret: process.env.SMS_API_SECRET,
    senderId,
    customUrl: process.env.SMS_CUSTOM_URL,
  };
}

async function getClinicSmsConfig(clinicId: string): Promise<SmsConfig | null> {
  const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId));
  if (!clinic || !clinic.smsEnabled || !clinic.smsApiKey || !clinic.smsSenderId) {
    return getGlobalConfig();
  }
  return {
    provider: clinic.smsProvider || "twilio",
    apiKey: clinic.smsApiKey,
    senderId: clinic.smsSenderId,
  };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Libya: convert 09x to 2189x
  if (digits.startsWith("0") && digits.length === 10) return `218${digits.slice(1)}`;
  return digits;
}

async function sendViaTwilio(config: SmsConfig, to: string, body: string): Promise<boolean> {
  const phone = normalizePhone(to);
  const accountSid = config.apiKey;
  const authToken = config.apiSecret || "";
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const params = new URLSearchParams({
    From: config.senderId,
    To: `+${phone}`,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[SMS/Twilio] Failed to ${phone}: ${err}`);
    return false;
  }
  console.log(`[SMS/Twilio] Sent to +${phone}`);
  return true;
}

async function sendViaVonage(config: SmsConfig, to: string, body: string): Promise<boolean> {
  const phone = normalizePhone(to);
  const res = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      to: phone,
      from: config.senderId,
      text: body,
    }),
  });

  if (!res.ok) {
    console.error(`[SMS/Vonage] Failed to ${phone}`);
    return false;
  }
  console.log(`[SMS/Vonage] Sent to ${phone}`);
  return true;
}

async function sendViaCustom(config: SmsConfig, to: string, body: string): Promise<boolean> {
  if (!config.customUrl) {
    console.error("[SMS/Custom] No custom URL configured");
    return false;
  }
  const phone = normalizePhone(to);
  const res = await fetch(config.customUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ to: phone, from: config.senderId, message: body }),
  });

  if (!res.ok) {
    console.error(`[SMS/Custom] Failed to ${phone}`);
    return false;
  }
  console.log(`[SMS/Custom] Sent to ${phone}`);
  return true;
}

export async function sendSms(
  clinicId: string,
  to: string,
  body: string,
  options?: { appointmentId?: string; messageType?: string }
): Promise<boolean> {
  const config = await getClinicSmsConfig(clinicId);

  if (!config) {
    console.log(`[SMS STUB → ${to}] ${body}`);
    // Log as stub
    await db.insert(messageLogs).values({
      appointmentId: options?.appointmentId || null,
      clinicId,
      channel: "sms",
      messageType: options?.messageType || "general",
      recipientPhone: to,
      status: "sent",
    });
    return true;
  }

  let success = false;
  try {
    switch (config.provider) {
      case "vonage": success = await sendViaVonage(config, to, body); break;
      case "custom": success = await sendViaCustom(config, to, body); break;
      default: success = await sendViaTwilio(config, to, body);
    }
  } catch (e) {
    console.error("[SMS] Error:", e);
  }

  await db.insert(messageLogs).values({
    appointmentId: options?.appointmentId || null,
    clinicId,
    channel: "sms",
    messageType: options?.messageType || "general",
    recipientPhone: to,
    status: success ? "sent" : "failed",
    errorMessage: success ? null : "Send failed",
  });

  return success;
}

export async function sendSmsConfirmationRequest(
  clinicId: string, phone: string, patientName: string, doctorName: string, date: string, time: string, appointmentId?: string
): Promise<void> {
  const body = `Hello ${patientName}, your appointment with ${doctorName} on ${date} at ${time} is awaiting confirmation.\nReply YES to confirm or NO to cancel.\n- Rakaz Clinic`;
  await sendSms(clinicId, phone, body, { appointmentId, messageType: "confirmation" });
}

export async function sendSmsReminder(
  clinicId: string, phone: string, patientName: string, doctorName: string, date: string, time: string, hoursAhead: number, appointmentId?: string
): Promise<void> {
  const body = `Reminder: Your appointment with ${doctorName} is in ${hoursAhead} hours on ${date} at ${time}.\n- Rakaz Clinic`;
  await sendSms(clinicId, phone, body, { appointmentId, messageType: `reminder_${hoursAhead}h` });
}

export async function sendSmsCancellation(
  clinicId: string, phone: string, patientName: string, doctorName: string, date: string, time: string, appointmentId?: string
): Promise<void> {
  const body = `Hello ${patientName}, your appointment with ${doctorName} on ${date} at ${time} has been cancelled.\nTo rebook, visit our website.\n- Rakaz Clinic`;
  await sendSms(clinicId, phone, body, { appointmentId, messageType: "cancellation" });
}

export function isSmsConfigured(): boolean {
  return !!(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID);
}
