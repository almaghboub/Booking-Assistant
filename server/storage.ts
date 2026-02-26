import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  users, clinics, doctors, services, patients, appointments,
  type User, type InsertUser,
  type Clinic, type InsertClinic,
  type Doctor, type InsertDoctor,
  type Service, type InsertService,
  type Patient, type InsertPatient,
  type Appointment, type InsertAppointment,
} from "@shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Clinics
  getClinic(id: string): Promise<Clinic | undefined>;
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  updateClinic(id: string, data: Partial<InsertClinic>): Promise<Clinic | undefined>;

  // Doctors
  getDoctorsByClinic(clinicId: string): Promise<Doctor[]>;
  getDoctor(id: string): Promise<Doctor | undefined>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  updateDoctor(id: string, data: Partial<InsertDoctor>): Promise<Doctor | undefined>;
  deleteDoctor(id: string): Promise<void>;

  // Services
  getServicesByClinic(clinicId: string): Promise<Service[]>;
  getServicesByDoctor(clinicId: string, doctorId: string): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;

  // Patients
  getPatientsByClinic(clinicId: string): Promise<Patient[]>;
  getPatientByPhone(clinicId: string, phone: string): Promise<Patient | undefined>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: string, data: Partial<InsertPatient>): Promise<Patient | undefined>;

  // Appointments
  getAppointmentsByClinic(clinicId: string, filters?: { status?: string; date?: string }): Promise<Appointment[]>;
  getAppointmentsByDoctor(doctorId: string, filters?: { status?: string; date?: string }): Promise<Appointment[]>;
  getAppointmentsForDate(clinicId: string | null, doctorId: string | null, date: string): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: string, status: string): Promise<Appointment | undefined>;

  // Analytics
  getClinicStats(clinicId: string): Promise<any>;
  getAnalytics(clinicId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByUsername(username: string) {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }

  async createUser(user: InsertUser) {
    const [u] = await db.insert(users).values(user).returning();
    return u;
  }

  async getClinic(id: string) {
    const [c] = await db.select().from(clinics).where(eq(clinics.id, id));
    return c;
  }

  async createClinic(clinic: InsertClinic) {
    const [c] = await db.insert(clinics).values(clinic).returning();
    return c;
  }

  async updateClinic(id: string, data: Partial<InsertClinic>) {
    const [c] = await db.update(clinics).set(data).where(eq(clinics.id, id)).returning();
    return c;
  }

  async getDoctorsByClinic(clinicId: string) {
    return db.select().from(doctors).where(and(eq(doctors.clinicId, clinicId), eq(doctors.isActive, true)));
  }

  async getDoctor(id: string) {
    const [d] = await db.select().from(doctors).where(eq(doctors.id, id));
    return d;
  }

  async createDoctor(doctor: InsertDoctor) {
    const [d] = await db.insert(doctors).values(doctor).returning();
    return d;
  }

  async updateDoctor(id: string, data: Partial<InsertDoctor>) {
    const [d] = await db.update(doctors).set(data).where(eq(doctors.id, id)).returning();
    return d;
  }

  async deleteDoctor(id: string) {
    await db.update(doctors).set({ isActive: false }).where(eq(doctors.id, id));
  }

  async getServicesByClinic(clinicId: string) {
    return db.select().from(services).where(and(eq(services.clinicId, clinicId), eq(services.isActive, true)));
  }

  async getServicesByDoctor(clinicId: string, doctorId: string) {
    return db.select().from(services).where(
      and(
        eq(services.clinicId, clinicId),
        eq(services.isActive, true),
        sql`(${services.doctorId} IS NULL OR ${services.doctorId} = ${doctorId})`
      )
    );
  }

  async getService(id: string) {
    const [s] = await db.select().from(services).where(eq(services.id, id));
    return s;
  }

  async createService(service: InsertService) {
    const [s] = await db.insert(services).values(service).returning();
    return s;
  }

  async updateService(id: string, data: Partial<InsertService>) {
    const [s] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return s;
  }

  async deleteService(id: string) {
    await db.update(services).set({ isActive: false }).where(eq(services.id, id));
  }

  async getPatientsByClinic(clinicId: string) {
    return db.select().from(patients).where(eq(patients.clinicId, clinicId)).orderBy(patients.createdAt);
  }

  async getPatientByPhone(clinicId: string, phone: string) {
    const [p] = await db.select().from(patients).where(and(eq(patients.clinicId, clinicId), eq(patients.phone, phone)));
    return p;
  }

  async getPatient(id: string) {
    const [p] = await db.select().from(patients).where(eq(patients.id, id));
    return p;
  }

  async createPatient(patient: InsertPatient) {
    const [p] = await db.insert(patients).values(patient).returning();
    return p;
  }

  async updatePatient(id: string, data: Partial<InsertPatient>) {
    const [p] = await db.update(patients).set(data).where(eq(patients.id, id)).returning();
    return p;
  }

  async getAppointmentsByClinic(clinicId: string, filters?: { status?: string; date?: string }) {
    const conds: any[] = [eq(appointments.clinicId, clinicId)];
    if (filters?.status) conds.push(eq(appointments.status, filters.status));
    if (filters?.date) conds.push(eq(appointments.date, filters.date));
    return db.select().from(appointments).where(and(...conds)).orderBy(appointments.date, appointments.time);
  }

  async getAppointmentsByDoctor(doctorId: string, filters?: { status?: string; date?: string }) {
    let conds = [eq(appointments.doctorId, doctorId)];
    if (filters?.status) conds.push(eq(appointments.status, filters.status));
    if (filters?.date) conds.push(eq(appointments.date, filters.date));
    return db.select().from(appointments).where(and(...conds)).orderBy(appointments.date, appointments.time);
  }

  async getAppointmentsForDate(clinicId: string | null, doctorId: string | null, date: string) {
    if (doctorId) {
      return db.select().from(appointments).where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date)));
    }
    if (clinicId) {
      return db.select().from(appointments).where(and(eq(appointments.clinicId, clinicId), eq(appointments.date, date)));
    }
    return [];
  }

  async getAppointment(id: string) {
    const [a] = await db.select().from(appointments).where(eq(appointments.id, id));
    return a;
  }

  async createAppointment(appointment: InsertAppointment) {
    const [a] = await db.insert(appointments).values(appointment).returning();
    return a;
  }

  async updateAppointmentStatus(id: string, status: string) {
    const updateData: any = { status };
    if (status === "confirmed") updateData.confirmationTime = new Date();
    const [a] = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    return a;
  }

  async getClinicStats(clinicId: string) {
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = today.substring(0, 7);

    const todayAppts = await db.select().from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), eq(appointments.date, today)));

    const monthAppts = await db.select().from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), sql`${appointments.date} LIKE ${thisMonth + "%"}`));

    const allPatients = await db.select().from(patients).where(eq(patients.clinicId, clinicId));

    return {
      todayCount: todayAppts.length,
      confirmedToday: todayAppts.filter(a => a.status === "confirmed").length,
      patientCount: allPatients.length,
      monthCount: monthAppts.length,
    };
  }

  async getAnalytics(clinicId: string) {
    const allAppts = await db.select().from(appointments).where(eq(appointments.clinicId, clinicId));
    const allPatients = await db.select().from(patients).where(eq(patients.clinicId, clinicId));
    const allServices = await db.select().from(services).where(eq(services.clinicId, clinicId));

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    allAppts.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Daily volume - last 14 days
    const days: Record<string, number> = {};
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = 0;
    }
    allAppts.forEach(a => {
      if (days[a.date] !== undefined) days[a.date]++;
    });
    const dailyVolume = Object.entries(days).map(([date, count]) => ({
      date: date.substring(5),
      count
    }));

    // Top services
    const svcCounts: Record<string, { name: string; count: number }> = {};
    allAppts.forEach(a => {
      const svc = allServices.find(s => s.id === a.serviceId);
      if (svc) {
        if (!svcCounts[a.serviceId]) svcCounts[a.serviceId] = { name: svc.name, count: 0 };
        svcCounts[a.serviceId].count++;
      }
    });
    const topServices = Object.values(svcCounts).sort((a, b) => b.count - a.count).slice(0, 5);

    // Peak hours
    const hourCounts: Record<string, number> = {};
    allAppts.forEach(a => {
      const hour = a.time.split(":")[0];
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour: hour + ":00", count }));

    const noShowCount = allAppts.filter(a => a.status === "no_show").length;
    const noShowRate = allAppts.length > 0 ? ((noShowCount / allAppts.length) * 100).toFixed(1) : "0";

    const dayCount = Object.values(days).filter(c => c > 0).length || 1;
    const avgDaily = (allAppts.length / dayCount).toFixed(1);

    return {
      totalAppointments: allAppts.length,
      totalPatients: allPatients.length,
      noShowRate,
      avgDaily,
      statusBreakdown,
      dailyVolume,
      topServices,
      peakHours,
    };
  }
}

export const storage = new DatabaseStorage();
