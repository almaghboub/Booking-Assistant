import { db } from "./storage";
import { users, clinics, doctors, services, patients, appointments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  // Check if already seeded
  const existingClinics = await db.select().from(clinics).where(eq(clinics.id, "clinic-1"));
  if (existingClinics.length > 0) {
    console.log("[seed] Database already seeded, skipping.");
    return;
  }

  console.log("[seed] Seeding database...");

  // Create clinic
  await db.execute(sql`INSERT INTO clinics (id, name, address, phone, whatsapp_number, business_hours) VALUES ('clinic-1', 'Rakaz Medical Clinic', '123 Healthcare Street, Tripoli, Libya', '+218-91-123-4567', '+218-91-123-4567', '08:00-20:00') ON CONFLICT (id) DO NOTHING`);

  // Create admin user
  await db.execute(sql`INSERT INTO users (id, username, password, role, clinic_id, full_name) VALUES ('user-admin-1', 'admin', 'admin123', 'clinic_admin', 'clinic-1', 'Clinic Administrator') ON CONFLICT (username) DO NOTHING`);

  // Create doctors
  await db.execute(sql`INSERT INTO doctors (id, clinic_id, name, specialty, working_hours, break_time, is_active) VALUES
    ('doctor-1', 'clinic-1', 'Dr. Ahmed Al-Mansouri', 'General Medicine', '08:00-16:00', '13:00-14:00', true),
    ('doctor-2', 'clinic-1', 'Dr. Sara Hassan', 'Dermatology', '09:00-17:00', '13:00-14:00', true),
    ('doctor-3', 'clinic-1', 'Dr. Khalid Omar', 'Pediatrics', '10:00-18:00', '14:00-15:00', true)
    ON CONFLICT (id) DO NOTHING`);

  // Create doctor users
  await db.execute(sql`INSERT INTO users (id, username, password, role, clinic_id, doctor_id, full_name) VALUES
    ('user-doctor-1', 'doctor1', 'doctor123', 'doctor', 'clinic-1', 'doctor-1', 'Dr. Ahmed Al-Mansouri'),
    ('user-doctor-2', 'doctor2', 'doctor123', 'doctor', 'clinic-1', 'doctor-2', 'Dr. Sara Hassan'),
    ('user-doctor-3', 'doctor3', 'doctor123', 'doctor', 'clinic-1', 'doctor-3', 'Dr. Khalid Omar')
    ON CONFLICT (username) DO NOTHING`);

  // Create services
  await db.execute(sql`INSERT INTO services (id, clinic_id, doctor_id, name, duration, price, buffer_time, is_active) VALUES
    ('service-1', 'clinic-1', null, 'General Consultation', 30, '50.00', 5, true),
    ('service-2', 'clinic-1', 'doctor-1', 'Full Physical Exam', 60, '150.00', 10, true),
    ('service-3', 'clinic-1', 'doctor-2', 'Skin Consultation', 30, '80.00', 5, true),
    ('service-4', 'clinic-1', 'doctor-2', 'Dermatology Procedure', 45, '200.00', 15, true),
    ('service-5', 'clinic-1', 'doctor-3', 'Pediatric Checkup', 30, '60.00', 5, true),
    ('service-6', 'clinic-1', 'doctor-3', 'Vaccination', 15, '30.00', 0, true)
    ON CONFLICT (id) DO NOTHING`);

  // Create patients
  await db.execute(sql`INSERT INTO patients (id, clinic_id, full_name, phone, notes, no_show_count, is_flagged) VALUES
    ('patient-1', 'clinic-1', 'Mohammed Al-Farsi', '+218-91-234-5678', 'Regular patient, mild hypertension', 0, false),
    ('patient-2', 'clinic-1', 'Fatima Benali', '+218-92-345-6789', 'Allergic to penicillin', 1, false),
    ('patient-3', 'clinic-1', 'Omar Al-Tayyeb', '+218-93-456-7890', '', 3, true),
    ('patient-4', 'clinic-1', 'Aisha Mohammed', '+218-91-567-8901', 'Diabetic patient', 0, false),
    ('patient-5', 'clinic-1', 'Ibrahim Hassan', '+218-92-678-9012', '', 0, false),
    ('patient-6', 'clinic-1', 'Mariam Al-Nouri', '+218-93-789-0123', 'First visit', 0, false)
    ON CONFLICT (id) DO NOTHING`);

  // Create appointments
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];

  await db.execute(sql`INSERT INTO appointments (id, clinic_id, doctor_id, patient_id, service_id, patient_name, patient_phone, date, time, status) VALUES
    ('appt-1', 'clinic-1', 'doctor-1', 'patient-1', 'service-1', 'Mohammed Al-Farsi', '+218-91-234-5678', ${today}, '09:00', 'confirmed'),
    ('appt-2', 'clinic-1', 'doctor-1', 'patient-2', 'service-2', 'Fatima Benali', '+218-92-345-6789', ${today}, '10:05', 'confirmed'),
    ('appt-3', 'clinic-1', 'doctor-2', 'patient-3', 'service-3', 'Omar Al-Tayyeb', '+218-93-456-7890', ${today}, '09:00', 'pending_confirmation'),
    ('appt-4', 'clinic-1', 'doctor-2', 'patient-4', 'service-4', 'Aisha Mohammed', '+218-91-567-8901', ${today}, '10:35', 'confirmed'),
    ('appt-5', 'clinic-1', 'doctor-3', 'patient-5', 'service-5', 'Ibrahim Hassan', '+218-92-678-9012', ${today}, '10:00', 'pending_confirmation'),
    ('appt-6', 'clinic-1', 'doctor-1', 'patient-1', 'service-1', 'Mohammed Al-Farsi', '+218-91-234-5678', ${yesterday}, '09:00', 'completed'),
    ('appt-7', 'clinic-1', 'doctor-2', 'patient-6', 'service-3', 'Mariam Al-Nouri', '+218-93-789-0123', ${yesterday}, '09:35', 'no_show'),
    ('appt-8', 'clinic-1', 'doctor-1', 'patient-4', 'service-1', 'Aisha Mohammed', '+218-91-567-8901', ${tomorrow}, '09:35', 'pending_confirmation'),
    ('appt-9', 'clinic-1', 'doctor-3', 'patient-2', 'service-6', 'Fatima Benali', '+218-92-345-6789', ${tomorrow}, '10:00', 'pending_confirmation'),
    ('appt-10', 'clinic-1', 'doctor-1', 'patient-5', 'service-2', 'Ibrahim Hassan', '+218-92-678-9012', ${dayAfter}, '09:05', 'pending_confirmation')
    ON CONFLICT (id) DO NOTHING`);

  console.log("[seed] Database seeded successfully.");
}
