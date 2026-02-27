# Rakaz Smart Clinic Automation System

## Overview
A full-stack web-based clinic appointment booking and management platform built for clinics, doctors, and patients. Supports online booking, admin management, doctor dashboards, WhatsApp notifications, Google Calendar sync, and HL7 FHIR R4 EMR integration.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter
- **Backend**: Node.js + Express, drizzle-orm
- **Database**: PostgreSQL (Neon via Replit)
- **Charts**: Recharts

## Features

### Arabic / English Language Switching
- Flag toggle button (🇬🇧 / 🇱🇾) appears in every page header
- Switches between full Arabic (RTL) and English (LTR) modes
- Language preference persisted in `localStorage` ("mawid-lang")
- Logo swaps: Arabic logo (`F1C71113-...png`) ↔ English "Mawid" logo (`45A1E150-...png`)
- Translations in `client/src/lib/i18n.ts`; context in `client/src/hooks/use-language.tsx`
- Public pages fully bilingual: home, login, booking wizard
- Admin/doctor dashboards use Arabic (staff-facing); navigation labels are translated

### Public Booking (no auth required)
- Multi-step booking wizard: Doctor → Service → Date/Time → Patient Details → Confirm
- Real-time availability checking (based on doctor working hours + existing bookings)
- Shareable doctor-specific booking links: `/book?doctor=DOCTOR_ID`
- Available at `/book`

### Clinic Admin Dashboard
- Login: `admin` / `admin123`
- Dashboard with today's schedule and stats
- Appointment management with status updates (Confirm/Complete/Cancel/No Show)
- Doctor management (add/edit/delete)
- Service management with duration, price, buffer time
- Patient CRM with visit history and no-show tracking
- Analytics with charts: daily volume, status breakdown, top services, peak hours
- **Settings page** — integration status for WhatsApp, FHIR, and Google Calendar

### Doctor Dashboard
- Login: `doctor1/2/3` / `doctor123`
- Today's schedule with appointment statuses
- Weekly view
- Mark appointments as completed / no-show
- "Doctor Arrived" notification button (broadcasts WhatsApp to all confirmed patients)
- **Shareable booking link** with one-click copy
- **Phone booking dialog** — book on behalf of patients who call in
- **Google Calendar card** — connect/disconnect personal Google Calendar

## Integrations

### WhatsApp Business Cloud API (Meta)
- Service file: `server/whatsapp.ts`
- Uses `https://graph.facebook.com/v19.0/{phoneNumberId}/messages`
- Required env vars: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- Fallback: logs to console when env vars are not set (safe for dev)
- Triggers:
  - New public booking → sends "pending confirmation" request to patient
  - Status → confirmed → sends confirmation notice
  - Status → cancelled → sends cancellation notice
  - Doctor Arrived button → broadcasts to all confirmed patients today

### Google Calendar (OAuth 2.0 per-doctor)
- Service file: `server/googleCalendar.ts`
- Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Each doctor connects their own Google Calendar via OAuth
- Appointments are created/updated in the doctor's calendar on confirm
- Cancelled appointments delete the calendar event automatically
- OAuth flow: `/api/doctor/calendar/connect` → Google → `/api/auth/google/callback`

### HL7 FHIR R4 EMR Integration
- Service file: `server/fhir.ts`
- Base URL: `/fhir`
- Auth: `Authorization: Bearer <FHIR_API_KEY>`
- Required env var: `FHIR_API_KEY` (auto-generated, stored in shared env)
- Endpoints: Patient CRUD, Appointment CRUD, CapabilityStatement (public)
- `/fhir/metadata` — public, no auth
- All other endpoints require Bearer token

## Routes

### Frontend
- `/` — Home (redirects based on auth)
- `/login` — Login page
- `/book` — Public appointment booking
- `/admin` — Admin dashboard
- `/admin/appointments` — Appointment management
- `/admin/doctors` — Doctor management
- `/admin/services` — Service management
- `/admin/patients` — Patient CRM
- `/admin/analytics` — Analytics & reports
- `/admin/settings` — Integration settings (WhatsApp, FHIR, Google Calendar)
- `/doctor` — Doctor schedule (today/week)
- `/doctor/appointments` — Doctor's appointments
- `/doctor/patients` — Doctor's patients

### API
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/auth/google/callback` — Google OAuth redirect handler
- `GET /api/public/doctors`, `/api/public/services`, `/api/public/slots`
- `POST /api/public/appointments` — Patient self-booking
- `GET/PATCH /api/admin/appointments`, `/api/admin/doctors`, etc.
- `GET /api/admin/settings` — Integration status
- `POST /api/admin/whatsapp/test` — Send test WhatsApp message
- `GET /api/doctor/calendar/status` — Calendar connection status
- `GET /api/doctor/calendar/connect` — Initiate Google OAuth
- `DELETE /api/doctor/calendar/disconnect` — Remove tokens
- `POST /api/doctor/appointments` — Phone booking (auto-confirmed)
- `POST /api/doctor/arrived` — Trigger patient broadcast
- `GET /fhir/metadata` — FHIR CapabilityStatement (public)
- `GET/POST /fhir/Patient`, `GET/POST/PUT /fhir/Appointment` — FHIR resources

## Database Schema
- `users` — Admin and doctor accounts
- `clinics` — Clinic profile
- `doctors` — Doctor profiles + `googleCalendarId`, `googleAccessToken`, `googleRefreshToken`, `googleTokenExpiry`
- `services` — Clinic services with duration/price
- `patients` — Patient records with no-show tracking
- `appointments` — All appointments + `googleCalendarEventId`

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
