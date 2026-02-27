/**
 * WhatsApp Business Cloud API (Meta)
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Required environment variables:
 *   WHATSAPP_API_TOKEN      - Permanent token from Meta Business Manager
 *   WHATSAPP_PHONE_NUMBER_ID - Phone Number ID from Meta Business Manager
 *
 * If these are not set the functions fall back to console.log so the app
 * still works during development / before credentials are configured.
 */

const API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const BASE_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

function isConfigured(): boolean {
  return !!(API_TOKEN && PHONE_NUMBER_ID);
}

/** Strip non-digit characters and ensure a leading + for the WhatsApp API */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `218${digits.slice(1)}` : digits;
}

async function sendMessage(to: string, body: string): Promise<void> {
  const phone = normalizePhone(to);

  if (!isConfigured()) {
    console.log(`[WhatsApp STUB → ${phone}] ${body}`);
    return;
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
    } else {
      console.log(`[WhatsApp] Message sent to ${phone}`);
    }
  } catch (e) {
    console.error(`[WhatsApp] Network error sending to ${phone}:`, e);
  }
}

/** Sent when a new online/phone booking is created and needs patient confirmation */
export async function sendBookingConfirmationRequest(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string
): Promise<void> {
  const body =
    `Hello ${patientName}, your appointment request with ${doctorName} on ${date} at ${time} has been received.\n\n` +
    `Reply *YES* to confirm or *NO* to cancel.\n\nThank you – Rakaz Clinic`;
  await sendMessage(phone, body);
}

/** Sent when an appointment is moved to "confirmed" status */
export async function sendConfirmedNotice(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string
): Promise<void> {
  const body =
    `✅ Hello ${patientName}, your appointment with ${doctorName} on ${date} at ${time} is *confirmed*.\n\nPlease arrive 10 minutes early. – Rakaz Clinic`;
  await sendMessage(phone, body);
}

/** Sent when an appointment is cancelled */
export async function sendCancellationNotice(
  phone: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string
): Promise<void> {
  const body =
    `Hello ${patientName}, your appointment with ${doctorName} on ${date} at ${time} has been *cancelled*.\n\nTo rebook, visit our website or call the clinic. – Rakaz Clinic`;
  await sendMessage(phone, body);
}

/** Broadcast sent to all confirmed patients when the doctor arrives */
export async function sendDoctorArrivedBroadcast(
  phone: string,
  patientName: string,
  doctorName: string
): Promise<void> {
  const body =
    `🏥 Hello ${patientName}, ${doctorName} has arrived at the clinic. Please head over now and arrive within 10 minutes. – Rakaz Clinic`;
  await sendMessage(phone, body);
}

/** Returns whether the WhatsApp integration is configured */
export function getWhatsAppStatus(): { configured: boolean; phoneNumberId: string | null } {
  return {
    configured: isConfigured(),
    phoneNumberId: PHONE_NUMBER_ID || null,
  };
}
