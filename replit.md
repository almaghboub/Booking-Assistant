# Rakaz Smart Clinic Automation System

## Overview
A full-stack web-based clinic appointment booking and management platform built for clinics, doctors, and patients. Supports online booking, admin management, doctor dashboards, and analytics.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter
- **Backend**: Node.js + Express, drizzle-orm
- **Database**: PostgreSQL (Neon via Replit)
- **Charts**: Recharts

## Features

### Public Booking (no auth required)
- Multi-step booking wizard: Doctor → Service → Date/Time → Patient Details → Confirm
- Real-time availability checking (based on doctor working hours + existing bookings)
- Available at `/book`

### Clinic Admin Dashboard
- Login: `admin` / `admin123`
- Dashboard with today's schedule and stats
- Appointment management with status updates (Confirm/Complete/Cancel/No Show)
- Doctor management (add/edit/delete)
- Service management with duration, price, buffer time
- Patient CRM with visit history and no-show tracking
- Analytics with charts: daily volume, status breakdown, top services, peak hours

### Doctor Dashboard
- Login: `doctor1/2/3` / `doctor123`
- Today's schedule with appointment statuses
- Weekly view
- Mark appointments as completed / no-show
- "Doctor Arrived" notification button (broadcasts to confirmed patients)

## Routes
- `/` — Home (redirects based on auth)
- `/login` — Login page
- `/book` — Public appointment booking
- `/admin` — Admin dashboard
- `/admin/appointments` — Appointment management
- `/admin/doctors` — Doctor management
- `/admin/services` — Service management
- `/admin/patients` — Patient CRM
- `/admin/analytics` — Analytics & reports
- `/doctor` — Doctor schedule (today/week)
- `/doctor/appointments` — Doctor's appointments
- `/doctor/patients` — Doctor's patients

## Database Schema
- `users` — Admin and doctor accounts
- `clinics` — Clinic profile
- `doctors` — Doctor profiles with working hours
- `services` — Clinic services with duration/price
- `patients` — Patient records with no-show tracking
- `appointments` — All appointments with status history

## Seed Data
- 1 clinic: Rakaz Medical Clinic
- 3 doctors: Dr. Ahmed Al-Mansouri (General), Dr. Sara Hassan (Dermatology), Dr. Khalid Omar (Pediatrics)
- 6 services
- 6 patients (including 1 flagged patient with 3 no-shows)
- 10 appointments across today, yesterday, tomorrow

## Appointment Status Flow
`pending_confirmation` → `confirmed` → `completed`
                        → `cancelled`
                        → `no_show`

## No-Show Logic
- Patients are automatically flagged when they accumulate 3+ no-shows
- Flagged patients are visually marked in the admin dashboard

## Clinic ID
Fixed at `clinic-1` for the MVP (single-clinic setup, multi-clinic expandable).

## Session Auth
- Express sessions stored in PostgreSQL via `connect-pg-simple`
- Session secret from `SESSION_SECRET` environment variable
