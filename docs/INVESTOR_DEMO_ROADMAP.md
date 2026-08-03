# Investor Demo Roadmap — Full System for 1 Company by March 15

**Goal:** A fully working business ops platform (Hub + all modules) that works end-to-end for **at least one company**, demo-ready for investors by **March 15**.

---

## System scope (what “full” means)

| Area | What’s included |
|------|------------------|
| **Hub** | Central dashboard with KPIs, module summaries, activity feed, quick create |
| **Katana PM** | Projects, tasks, Kanban, milestones, team, files |
| **Katana Inventory** | Items, transactions, purchase orders, suppliers, scan-in/check-out |
| **Katana Customers** | Customer Success: clients, health, tasks, interactions |
| **WFM** | Workforce: technicians, jobs, scheduling |
| **Katana HR** | Employees, performance, goals, module access |
| **Employee Portal** | Dashboard, directory, profile, performance, goals, development, internal jobs |
| **Careers** | Job postings, applications (recruitment) |
| **Z-MO** | Manufacturing: machines, work orders, quality (if in scope) |
| **Automation** | Cross-module activity feed, doc list (if in scope) |
| **Know Your Investor (KYI)** | Companies, investors, cross-reference, access map |

---

## Phase 1: Foundation (Auth, org, one company) — **by ~Feb 28**

### 1.1 Supabase project and auth

- [ ] **Supabase project** created and env set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env`.
- [ ] **Auth providers:** Email + password enabled; Microsoft (Azure) configured if you want SSO for demo.  
  - See [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md).
- [ ] **URLs:** In Supabase → Authentication → URL Configuration, set **Site URL** and **Redirect URLs** to your demo URL (e.g. `https://app.yourdomain.com` or `http://localhost:3001` for local).

### 1.2 Core auth and org schema

- [ ] **Invite/org schema** applied so one company can exist and users belong to it:
  - Run **`supabase-invite-code-migration.sql`** (organizations, user_profiles, organization_invitations, RLS, `get_invite_by_token`).
  - Run **`supabase-invite-email-auth-migration.sql`** if you want invite-by-email sign-up.
- [ ] **First company:** Create one organization (via first user sign-up + onboarding, or by inserting one org in SQL and attaching your demo user’s profile to it).

### 1.3 Onboarding and “one company” flow

- [ ] **First login:** After sign-in, user without `onboarding_completed` goes to `/onboarding` (or ensure your app redirects there when `organization` exists but onboarding not completed).
- [ ] **Onboarding:** Complete flow in [OrganizationSetup](src/components/onboarding/OrganizationSetup.tsx): org name, industry, company size → then redirect to `/hub`.
- [ ] **Single-company assumption:** All module data (HR, Projects, Inventory, etc.) is currently “authenticated only” RLS (no `organization_id` on every table). For “1 company” this is enough: one Supabase project = one company. Confirm one demo org and 1–2 users (e.g. admin + member) for the demo.

---

## Phase 2: All schemas and RLS — **by ~Mar 5**

Apply every schema/migration so every module works against Supabase (no missing tables).

### 2.1 Run in Supabase SQL Editor (in this order)

- [ ] **HR:** `supabase-hr-schema.sql`  
  - Then: `supabase-hr-module-access-migration.sql`, `supabase-hr-profile-fields-migration.sql` (if you use location, timezone, bio).
- [ ] **Projects:** `supabase-projects-schema.sql`  
  - Then: `supabase-projects-ownership-migration.sql`, `supabase-projects-subtasks-migration.sql` (if needed).
- [ ] **Inventory:** `supabase-inventory-schema.sql`
- [ ] **Customer Success:** `customer-success-schema.sql`
- [ ] **WFM:** `supabase-wfm-schema.sql`
- [ ] **KYI:** `supabase-kyi-schema.sql`  
  - Then: `scripts/kyi-seed-demo-company.sql` (or your equivalent) for one demo company + investors.
- [ ] **Recruitment (Careers):** Ensure `job_postings` and `job_applications` exist (in invite or a dedicated schema file; see [BACKUP_RESTORE.md](../BACKUP_RESTORE.md)).
- [ ] **RLS:** `supabase-rls-authenticated-only-migration.sql` so only signed-in users can read/write (run after all table creation).

### 2.2 Verify no missing tables

- [ ] Start app, log in as demo user, open each module and confirm no “table not found” or schema errors.
- [ ] Fix any remaining schema (e.g. recruitment tables) and re-run RLS if you add policies for new tables.

---

## Phase 3: One-company data and critical paths — **by ~Mar 10**

### 3.1 Demo company data (at least one company)

- [ ] **Org:** One organization in `organizations` with a clear name (e.g. “Acme Corp” or “DW Griffin Capital” for KYI).
- [ ] **Users:** 1–2 users in Auth; `user_profiles` linked to that `organization_id`, one with role `owner` or `admin`.
- [ ] **HR:** Add 2–5 employees in HR (including the demo user’s email so they have an HR record and module access). Set `module_access` so the demo user can see Hub + all modules you want to show.
- [ ] **Projects:** 1–2 projects with a few tasks in different statuses (so Kanban and Hub look alive).
- [ ] **Inventory:** A few items, one or two POs, a couple of transactions.
- [ ] **Customer Success:** 1–2 clients with health scores and a task or two.
- [ ] **WFM:** A couple of technicians and jobs/schedules if you’re demoing WFM.
- [ ] **Careers:** 1–2 job postings; optional: 1 application.
- [ ] **KYI:** Already seeded via `scripts/kyi-seed-demo-company.sql` (one company, 2 investors, geo settings).

### 3.2 Critical user journeys (must work)

- [ ] **Sign-in** (Microsoft or email) → redirect to Hub or onboarding as appropriate.
- [ ] **Onboarding** (if new org) → set org name → land on Hub.
- [ ] **Hub:** Loads without errors; shows widgets for Projects, CS, HR, Recruitment, etc., with real data.
- [ ] **PM:** List projects → open project → Kanban drag-and-drop → create/edit task.
- [ ] **Inventory:** Dashboard → items list → create PO or run a transaction (check-out/scan-in).
- [ ] **Customers:** Client list → open client → see health, tasks, interactions.
- [ ] **HR:** Employee list → add employee (with module access) → edit profile.
- [ ] **Employee portal:** Log in as employee → Dashboard, Directory, My Profile (edit location/timezone if you use it), Performance, Goals, Jobs.
- [ ] **Careers:** View job postings; optional: submit application.
- [ ] **KYI:** Companies list → open demo company → investors, cross-reference, access map (if applicable).
- [ ] **Settings:** Organization settings (invite by email if you use it) — no crashes.

### 3.3 Module access and sidebar

- [ ] **Module access:** For the demo user, `hr_employees.module_access` includes all modules you want to show (e.g. `hub`, `projects`, `inventory`, `customer-success`, `workforce`, `hr`, `employee`, `careers`, `manufacturing`, `automation`, `kyi`).  
  - See [ModuleRouteGuard](src/components/ModuleRouteGuard.tsx) and [module-access.ts](src/lib/module-access.ts).
- [ ] **Sidebar:** Only allowed modules appear; clicking a module doesn’t redirect to `/employee` (no “access denied” during demo).

---

## Phase 4: Polish and stability — **by Mar 12**

### 4.1 Errors and loading

- [ ] No uncaught errors on Hub load (fix any missing API or bad data in Hub widgets).
- [ ] Empty states: every list view shows a clear “No X yet” (or similar) instead of blank or error.
- [ ] Loading states: spinners or skeletons where data is fetched so the app never looks stuck.

### 4.2 Build and types

- [ ] `pnpm run build` (or `npm run build`) passes with no TypeScript errors.
- [ ] No console errors on the critical paths above (or only benign warnings).

### 4.3 Demo script and env

- [ ] **Demo script:** Short script (5–10 min): Land → Hub → PM (Kanban) → HR (one employee) → Inventory (one PO or transaction) → Customers (one client) → Employee portal (profile) → KYI (one company). Adjust to the modules you’re emphasizing.
- [ ] **Env:** Production or staging `.env` (or env vars) for the demo URL; same Supabase project as used for seed data.

---

## Phase 5: Deploy and backup — **by Mar 15**

### 5.1 Hosting and URL

- [ ] App deployed at a stable URL (e.g. Vercel, Netlify, or your own host).
- [ ] Supabase **Site URL** and **Redirect URLs** include that URL so sign-in works in the demo.

### 5.2 Backup and restore

- [ ] Supabase backup enabled (dashboard or pg_dump). See [BACKUP_RESTORE.md](../BACKUP_RESTORE.md).
- [ ] Optional: Export seed data or a small SQL snapshot so you can restore “demo company” if needed.

### 5.3 Investor-facing checklist

- [ ] **Landing (**`/`**):** Clear value prop; “Sign in” works (Microsoft and/or email).
- [ ] **One demo account** that has access to Hub and all modules you’re showing.
- [ ] **One company’s data** in the system (org + HR + projects + inventory + CS + WFM + careers + KYI as applicable).
- [ ] **No broken routes:** Every item in the sidebar for that user goes to a working page.
- [ ] **Stable build** and a 5–10 min path that you can walk through without errors.

---

## Optional / later

- **Z-MO (Manufacturing):** If you show it, confirm whether it uses Supabase or local state; if Supabase, add schema and seed data.
- **Automation:** Currently uses HR/Projects/CS/Recruitment APIs + localStorage; ensure feed doesn’t error and looks intentional.
- **Multi-tenant:** For “1 company” you don’t need `organization_id` on every table; add it later when you need multiple orgs in one project.
- **Email (invites, demo requests):** Optional; configure EmailJS (see [ENV.md](../ENV.md), [EMAILJS_SETUP.md](../EMAILJS_SETUP.md)) if you want live invite or demo-request flows during the demo.

---

## Quick reference: key files

| Purpose | File(s) |
|--------|--------|
| Auth & org | [AuthContext](src/contexts/AuthContext.tsx), [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md) |
| Onboarding | [OrganizationSetup](src/components/onboarding/OrganizationSetup.tsx), [OnboardingPage](src/pages/OnboardingPage.tsx) |
| Module access | [module-access.ts](src/lib/module-access.ts), [ModuleAccessContext](src/contexts/ModuleAccessContext.tsx), [ModuleRouteGuard](src/components/ModuleRouteGuard.tsx) |
| Hub | [HubPage](src/pages/HubPage.tsx) |
| APIs | `src/lib/*-api.ts`, `src/lib/project-data-supabase.ts`, `src/lib/supabase-api.ts` |
| Schemas | All `supabase-*-schema.sql` and `*-migration.sql` in repo root |

---

*Last updated for March 15 investor demo — full system for one company.*
