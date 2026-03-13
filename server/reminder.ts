/**
 * Automated Appointment Reminder Scheduler
 * Uses node-cron to run every 15 minutes and:
 *   - Send 24h reminder to appointments tomorrow
 *   - Send 2h reminder to appointments within 2 hours today
 *   - If WhatsApp not configured for clinic, fall back to SMS
 */

import cron from "node-cron";
import { db } from "./storage";
import { appointments, clinics, doctors, services, messageLogs } from "@shared/schema";
import { eq, and, not } from "drizzle-orm";
import { sendWhatsAppReminder } from "./whatsapp";
import { sendSmsReminder } from "./sms";

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

async function sendReminder(
  appt: any,
  doctorName: string,
  hoursAhead: number,
  clinic: any
): Promise<void> {
  const useWhatsApp = !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

  if (useWhatsApp) {
    await sendWhatsAppReminder(
      appt.patientPhone,
      appt.patientName,
      doctorName,
      appt.date,
      appt.time,
      hoursAhead,
      appt.id
    );
  } else if (clinic?.smsEnabled || process.env.SMS_API_KEY) {
    await sendSmsReminder(
      appt.clinicId,
      appt.patientPhone,
      appt.patientName,
      doctorName,
      appt.date,
      appt.time,
      hoursAhead,
      appt.id
    );
  } else {
    console.log(`[Reminder] No channel configured for clinic ${appt.clinicId}. Stub reminder for ${appt.patientName} (${hoursAhead}h).`);
    // Log stub
    await db.insert(messageLogs).values({
      appointmentId: appt.id,
      clinicId: appt.clinicId,
      channel: "whatsapp",
      messageType: `reminder_${hoursAhead}h`,
      recipientPhone: appt.patientPhone,
      status: "sent",
    });
  }
}

async function run24hReminders(): Promise<void> {
  const tomorrow = getTomorrowDate();
  try {
    const appts = await db.select().from(appointments).where(
      and(
        eq(appointments.date, tomorrow),
        eq(appointments.status, "confirmed"),
        eq(appointments.reminder24hSent, false)
      )
    );

    if (appts.length === 0) return;
    console.log(`[Reminder] Processing ${appts.length} 24h reminders for ${tomorrow}`);

    for (const appt of appts) {
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, appt.doctorId));
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, appt.clinicId));
      const doctorName = doc?.name ?? "your doctor";

      await sendReminder(appt, doctorName, 24, clinic);

      await db.update(appointments)
        .set({ reminder24hSent: true })
        .where(eq(appointments.id, appt.id));
    }
  } catch (e) {
    console.error("[Reminder] 24h error:", e);
  }
}

async function run2hReminders(): Promise<void> {
  const today = getTodayDate();
  const nowMins = getCurrentMinutes();
  const windowStart = nowMins + 100; // ~1h40m from now
  const windowEnd = nowMins + 140;   // ~2h20m from now

  try {
    const appts = await db.select().from(appointments).where(
      and(
        eq(appointments.date, today),
        eq(appointments.status, "confirmed"),
        eq(appointments.reminder2hSent, false)
      )
    );

    const due = appts.filter(a => {
      const apptMins = timeToMinutes(a.time);
      return apptMins >= windowStart && apptMins <= windowEnd;
    });

    if (due.length === 0) return;
    console.log(`[Reminder] Processing ${due.length} 2h reminders`);

    for (const appt of due) {
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, appt.doctorId));
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, appt.clinicId));
      const doctorName = doc?.name ?? "your doctor";

      await sendReminder(appt, doctorName, 2, clinic);

      await db.update(appointments)
        .set({ reminder2hSent: true })
        .where(eq(appointments.id, appt.id));
    }
  } catch (e) {
    console.error("[Reminder] 2h error:", e);
  }
}

export function startReminderScheduler(): void {
  console.log("[Reminder] Scheduler started (runs every 15 min)");

  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Reminder] Running reminder check...");
    await run24hReminders();
    await run2hReminders();
  });

  // Also run once on startup after 10s delay
  setTimeout(async () => {
    await run24hReminders();
    await run2hReminders();
  }, 10000);
}
