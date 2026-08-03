# Katana – System Overview

Use this doc to get another AI (e.g. ChatGPT) or a new contributor on the same page about how the app works as of now.

---

## What It Is

**Katana** (package name: `katana-saas`) is a multi-tenant SaaS platform. It’s a single React SPA with multiple “modules” (Hub, PM, Inventory, Customers, WFM, HR, Employee Portal, Careers, Z-MO, Automation). The main codebase is **Vite + React 18 + TypeScript**; backend is **Supabase** (auth, Postgres, optional realtime).

- **Repo:** single monorepo; primary app lives under `src/`.
- **Port:** dev server is usually `http://localhost:3001` (or 3002 if 3001 is in use).
- **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; see `.env.example` if present.

---

## Tech Stack

- **Frontend:** React 18, React Router 6, TypeScript, Vite 5.
- **UI:** Tailwind CSS, Radix UI primitives, Lucide icons, Sonner toasts, Framer Motion where used.
- **Backend / data:** Supabase (Auth + Postgres). All module data is read/written via Supabase from the client using the anon key; RLS and policies live in Supabase.
- **Auth:** Supabase Auth (email/password and Microsoft OAuth). User profile and organization come from Supabase tables (`profiles`, `organizations` or equivalent) and are exposed via `AuthContext`.

---

## Auth & Access Control

- **AuthContext** (`src/contexts/AuthContext.tsx`): Provides `user`, `session`, `profile` (full_name, email, role, etc.), `organization`, `loading`, `signInWithMicrosoft`, `signOut`, `refreshProfile`, `hasRole(role)`.
- **Roles:** `owner` | `admin` | `member` | `viewer`. Admins/owners have full access to every module.
- **Module access (non-admins):** Driven by HR employee records. `ModuleAccessContext`:
  - Resolves the current user’s HR employee by login email via `hrApi.getEmployeeByEmail(loginEmail)`.
  - Reads `employee.module_access` (array of module IDs, e.g. `['hub','inventory','employee']`).
  - Exposes `allowedModules`, `loading`, and `hasModuleAccess(moduleIdOrPath)`.
  - While permissions are loading, `allowedModules` is empty and the sidebar shows a skeleton (no accidental full access).
  - If the user has no HR employee record, the UI uses `employee` + `careers` only.
  - If `module_access` is empty on the HR row, only `employee` (portal) is allowed until HR sets modules.
  - Subscribes to Supabase realtime on `hr_employees` for the current row and refetches on window focus so permission edits apply without re-login.
- **Module list** is defined in `src/lib/module-access.ts`: `MODULES` and `MODULE_PATH` (e.g. `hub` → `/hub`, `projects` → `/projects`). Sidebar and route guard use these.
- **ModuleRouteGuard** (`src/components/ModuleRouteGuard.tsx`): If the user is logged in and navigates to a path that belongs to a module they don’t have access to, they are redirected to `/employee`.

---

## Routing & Layout

- **App.tsx** wraps the app in `ModuleAccessProvider` and renders `Sidebar`, `Header`, `ModuleRouteGuard`, and React Router `Routes`.
- **Landing:** `path="/"` → `HomePage` (no sidebar/header).
- **Main routes:** `/hub`, `/projects`, `/projects/:id`, `/inventory` (and nested), `/customer-success`, `/workforce`, `/hr`, `/manufacturing`, `/automation`, `/careers`, `/settings/organization`, `/onboarding`.
- **Employee portal:** All under `/employee` (dashboard, directory, performance, goals, development, profile, jobs). These routes are wrapped in `EmployeePortalProvider` so the portal has access to “current employee” context.

---

## Sidebar

- **Sidebar** (`src/components/Sidebar.tsx`): Uses `useModuleAccess()`. Only nav items for which `hasModuleAccess(item.path)` is true are shown. Items: Hub, Katana PM, Katana Inventory, Katana Customers, WFM, Katana HR, Employee Portal, Careers, Z-MO, Automation.

---

## Data Layer (APIs & Supabase)

- **Supabase client:** `src/lib/supabase.ts`. Single client; `isSupabaseConfigured` is derived from env so the app can degrade when Supabase isn’t set.
- **Module-specific APIs** (all talk to Supabase; tables and RLS are defined in SQL in the repo):
  - **HR:** `src/lib/hr-api.ts` – employees, performance reviews, goals, feedback, etc. Key table: `hr_employees` (includes `module_access`, `location`, `timezone`, `bio`). Add-employee flow and profile updates go through here.
  - **Projects (PM):** `src/lib/project-data-supabase.ts` (and related) – projects, tasks, milestones, team members, files, activities. Tables: `projects`, `tasks`, `milestones`, etc.
  - **Inventory:** `src/lib/inventory-api.ts` – items, transactions, purchase orders, suppliers.
  - **Customer Success:** `src/lib/customer-success-api.ts` – clients, health, tasks, interactions, etc. Tables: `cs_*`.
  - **WFM:** `src/lib/wfm-api.ts` – technicians, jobs, scheduling (tables described in `supabase-wfm-schema.sql`).
- **Schema / migrations:** SQL files in repo root: `supabase-hr-schema.sql`, `supabase-projects-schema.sql`, `supabase-inventory-schema.sql`, `customer-success-schema.sql`, `supabase-wfm-schema.sql`, plus migrations for module_access, profile fields (location, timezone, bio), etc. These are run manually in Supabase SQL Editor.

---

## Employee Portal

- **EmployeePortalContext** (`src/contexts/EmployeePortalContext.tsx`): Resolves “current” employee by login email; stores selected `employeeId` in localStorage for directory drill-down; provides `employee`, `employeeId`, `setEmployeeId`, `loading`, `error`, `refresh`, `currentUserEmployeeId`, `isViewingSelf`.
- **Pages:** Dashboard (`EmployeePortalPage`), Company Directory (`EmployeeDirectoryPage` – uses `hrApi.getAllEmployees()`), My Profile (`EmployeeProfilePage`), Performance, Goals, Learning & Development, Internal Jobs (`JobApplicationsPage`). Profile editing (phone, location, timezone, bio) saves via `hrApi.updateEmployee()`; notification/privacy toggles are in state + localStorage.
- **Profile timezone from location:** On My Profile, user can enter a location (e.g. “Philadelphia, Pennsylvania”). A “detect timezone” action (MapPin button or blur on location) calls `getTimezoneFromLocation()` in `src/lib/location-timezone.ts`, which uses Open-Meteo’s geocoding API (timezone comes from the geocoding result). In dev, requests are proxied via Vite (`/api/geocode`, `/api/timezone` in `vite.config.ts`) to avoid CORS.

---

## Key UX Flows

1. **Login:** Supabase Auth (Microsoft or email). After auth, profile/org are loaded; then module access is resolved from HR employee by email (or full access for admin/owner).
2. **Nav:** User only sees sidebar links for allowed modules; visiting a disallowed module path redirects to `/employee`.
3. **HR:** Add employee form includes module access checkboxes; saved as `module_access` on `hr_employees`. Profile fields (location, timezone, bio) are optional and saved when the corresponding columns exist (migrations may be required).
4. **Employee portal:** User opens `/employee`; context resolves their HR employee by email. They can view/edit their profile (including location → timezone), directory, development, jobs, etc.

---

## Conventions & Cursor Rules

- **TypeScript:** Strict; fix all type errors before push. Use optional chaining, nullish coalescing, type guards; avoid `any` where possible. Pre-push/build runs `npm run build` (or `pnpm run build`) to catch errors.
- **Structure:** Pages in `src/pages/`, shared UI in `src/components/`, API and shared logic in `src/lib/`, contexts in `src/contexts/`. Route params and module IDs align with `module-access.ts`.

---

## Optional / Legacy

- An **`app/`** directory exists with Next.js-style routes (e.g. `app/hub/page.tsx`). The primary running app is the Vite SPA in `src/`; `app/` may be legacy or a separate target.
- Migrations for HR (module_access, profile fields), projects, inventory, CS, WFM are in the repo; apply as needed in Supabase.

---

*Last updated to reflect the system as of the time this doc was generated (routing, auth, module access, employee portal, profile + timezone-from-location, Vite proxy for geocoding).*
