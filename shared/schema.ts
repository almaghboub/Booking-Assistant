import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("clinic_admin"), // super_admin | clinic_admin | doctor
  clinicId: varchar("clinic_id"),
  doctorId: varchar("doctor_id"),
  fullName: text("full_name").notNull().default(""),
});

export const clinics = pgTable("clinics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logo: text("logo"),
  address: text("address"),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  businessHours: text("business_hours").default("09:00-17:00"),
  // Multi-tenant subscription
  subscriptionPlan: text("subscription_plan").default("basic"), // basic | pro | enterprise
  subscriptionStatus: text("subscription_status").default("active"), // active | suspended | expired
  // Payment gateway settings (per-clinic Stripe config)
  stripePublishableKey: text("stripe_publishable_key"),
  stripeSecretKey: text("stripe_secret_key"),
  paymentEnabled: boolean("payment_enabled").default(false),
  depositPercentage: integer("deposit_percentage").default(50),
  // SMS settings
  smsEnabled: boolean("sms_enabled").default(false),
  smsApiKey: text("sms_api_key"),
  smsProvider: text("sms_provider").default("twilio"), // twilio | vonage | custom
  smsSenderId: text("sms_sender_id"),
  // WhatsApp webhook verify token (per-clinic)
  whatsappVerifyToken: text("whatsapp_verify_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctors = pgTable("doctors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: varchar("clinic_id").notNull(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  photo: text("photo"),
  backgroundPhoto: text("background_photo"),
  workingHours: text("working_hours").default("09:00-17:00"),
  breakTime: text("break_time").default("13:00-14:00"),
  isActive: boolean("is_active").default(true),
  // Google Calendar integration
  googleCalendarId: text("google_calendar_id"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: varchar("clinic_id").notNull(),
  doctorId: varchar("doctor_id"),
  name: text("name").notNull(),
  duration: integer("duration").notNull().default(30),
  price: decimal("price", { precision: 10, scale: 2 }),
  bufferTime: integer("buffer_time").default(0),
  isActive: boolean("is_active").default(true),
  // Payment settings per service
  requiresPayment: boolean("requires_payment").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: varchar("clinic_id").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  noShowCount: integer("no_show_count").default(0),
  isFlagged: boolean("is_flagged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: varchar("clinic_id").notNull(),
  doctorId: varchar("doctor_id").notNull(),
  patientId: varchar("patient_id"),
  serviceId: varchar("service_id").notNull(),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("pending_confirmation"),
  notes: text("notes"),
  confirmationTime: timestamp("confirmation_time"),
  // Google Calendar event ID for sync/deletion
  googleCalendarEventId: text("google_calendar_event_id"),
  // Payment tracking
  paymentStatus: text("payment_status").default("not_required"), // not_required | pending | paid | refunded
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  // Reminder tracking
  reminder24hSent: boolean("reminder_24h_sent").default(false),
  reminder2hSent: boolean("reminder_2h_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id").notNull(),
  clinicId: varchar("clinic_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentType: text("payment_type").notNull().default("full"), // deposit | full
  status: text("status").notNull().default("pending"), // pending | paid | failed | refunded
  transactionId: text("transaction_id"),
  gateway: text("gateway").default("stripe"), // stripe | manual
  stripeSessionId: text("stripe_session_id"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Message logs table
export const messageLogs = pgTable("message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id"),
  clinicId: varchar("clinic_id").notNull(),
  channel: text("channel").notNull(), // whatsapp | sms
  messageType: text("message_type").notNull(), // confirmation | reminder_24h | reminder_2h | arrival | cancellation | payment
  recipientPhone: text("recipient_phone").notNull(),
  status: text("status").notNull().default("sent"), // sent | delivered | failed
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
  deliveredAt: timestamp("delivered_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertClinicSchema = createInsertSchema(clinics).omit({ id: true, createdAt: true });
export const insertDoctorSchema = createInsertSchema(doctors).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, confirmationTime: true, googleCalendarEventId: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertMessageLogSchema = createInsertSchema(messageLogs).omit({ id: true, sentAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinics.$inferSelect;

export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctors.$inferSelect;

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;
export type MessageLog = typeof messageLogs.$inferSelect;

export type AppointmentStatus = "pending_confirmation" | "confirmed" | "cancelled" | "completed" | "no_show";
