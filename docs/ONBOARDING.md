# Katana — Team Onboarding Guide

Welcome to Katana. This guide gets a new developer or team member from zero to productive.
For end-user (non-developer) training, see [USER_TRAINING.md](USER_TRAINING.md).

---

## 1. What you're working on

**Katana** (`katana-saas`) is a multi-tenant business operations SaaS — a single React SPA
with 13 modules behind per-employee module access control:

| Module | Path | What it does |
|--------|------|--------------|
| Hub | `/hub` | Central dashboard |
| Katana PM | `/projects` | Projects, drag-and-drop Kanban, sprints, milestones |
| Katana Inventory | `/inventory` | Items, transactions, purchase orders, suppliers, scan in/out |
| Katana Customers | `/customer-success` | Clients, health scores, interactions, CS tasks |
| WFM | `/workforce` | Field workforce: technicians, jobs, schedules, timesheets |
| Katana HR | `/hr` | Employees, reviews, goals, recruitment, time off, training |
| Employee Portal | `/employee` | Self-service: profile, directory, performance, goals, internal jobs |
| Careers | `/careers` | Public job postings + applications |
| Katana Facilities | `/manufacturing` | Manufacturing/facilities operations |
| Automation | `/automation` | Org document knowledge + web tools |
| Know Your Investor (KYI) | `/kyi` | Investor lead intelligence: companies, investors, leads, geo targeting (org-scoped workspace + shared platform lead catalog; requires `supabase-pilot-org-rls-kyi-migration.sql`) |
| Katana Comms | `/comms` | Channels, DMs, group conversations |
| Agent Office | `/agents` | AI agent management (backed by external katana-agents service) |

**Stack:** Vite + React 18 + TypeScript + Tailwind + Radix UI on the front;
**Supabase** (Auth + Postgres + Storage + Realtime) as the backend; Vercel for hosting and
Edge Functions (`api/`) for legacy org-data AI tools (conversation is Agent Office).

There is no traditional backend server — the SPA talks to Supabase directly with the anon
key, and **Row Level Security (RLS) policies are the security model**. Treat every policy
change as a security change.

---

## 2. Day-one setup

Prereqs: Node 20+, npm, git. Windows, macOS, and Linux all work.

```bash
git clone <repo-url> && cd katana-vv2
npm install
cp .env.example .env       # then fill in values below
```

Minimum `.env` (ask a teammate for the real values, or use your own Supabase project):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>

# Local-only convenience login
VITE_DEV_AUTH_BYPASS=true
VITE_DEV_EMAIL=dev@localhost
VITE_DEV_PASSWORD=DevLocal123!

# Server-side only, used by npm run dev:seed — never commit
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Then:

```bash
npm run dev:seed   # creates dev auth user + org + HR employee with full module access
npm run dev        # http://localhost:3001 (3002 if busy)
```

Click **Continue without sign-in (dev)** on the landing page. Full walkthrough +
troubleshooting table: [DEV_LOCAL_SETUP.md](DEV_LOCAL_SETUP.md).

If you set up a **fresh Supabase project**, apply the SQL files from the repo root in the
Supabase SQL Editor — at minimum `supabase-invite-code-migration.sql`,
`supabase-hr-schema.sql`, `supabase-hr-module-access-migration.sql`, and the RLS migrations.
The schema lives in those `supabase-*.sql` files; there is no automated migration runner.

---

## 3. Repo map

```
src/                  ← the app (Vite SPA) — this is where you work
  pages/              ← one component per route (KYIPage, HRPage, employee/, Agents/…)
  components/         ← shared UI; ui/ has the Radix-based primitives
  contexts/           ← AuthContext, ModuleAccessContext, EmployeePortalContext
  lib/                ← data layer + helpers (see §4)
api/                  ← Vercel Edge Functions: chat.ts, rag.ts, tools.ts (legacy AI tools)
scripts/              ← node scripts: dev seeding, KYI fetch/import pipeline
e2e/                  ← Playwright tests
supabase-*.sql        ← schema + migrations (run manually in Supabase SQL Editor)
docs/                 ← project docs (this file, security review, DR runbook…)
.github/workflows/    ← ci.yml, kyi-data-refresh.yml (daily), db-backup.yml
app/                  ← legacy Next.js-style routes — NOT the running app; don't add code here
katana-agents/        ← only an .env for the external agents service; source lives elsewhere
```

## 4. Architecture in five minutes

- **Auth:** Supabase Auth (email/password + Microsoft OAuth).
  [AuthContext](../src/contexts/AuthContext.tsx) exposes `user`, `profile`, `organization`,
  `hasRole()`. Roles: `owner` | `admin` | `member` | `viewer` — admins/owners get every module.
- **Module access:** non-admins get modules from their HR record's `module_access` array
  (set in HR → Add/Edit Employee). [module-access.ts](../src/lib/module-access.ts) is the
  canonical module list; `ModuleRouteGuard` redirects unauthorized paths to `/employee`.
- **Data layer:** each module has an API file in `src/lib/` (`hr-api.ts`,
  `inventory-api.ts`, `customer-success-api.ts`, `wfm-api.ts`, `comms-api.ts`,
  `project-data-supabase.ts`…). They all use the shared client in
  [supabase.ts](../src/lib/supabase.ts).
- **Multi-tenancy:** module tables carry `organization_id`; RLS enforces
  `organization_id = get_user_organization_id()`. Always include `organization_id` on
  inserts (helper: `getOrganizationId()` in `auth-helpers.ts`).
- **Validation:** Zod schemas in `src/lib/validation.ts`; file uploads go through
  `validateFile()` (type allowlist, 25MB).
- **Agent Office / AI tools:** Conversation is Agent Office (`/agents`). Legacy
  `api/chat.ts` (Edge) verifies the user's Supabase JWT and runs tool-calling LLM
  chat where tools query Supabase *as that user* (RLS applies). Prefer Agent Office
  for product work; keep `api/chat.ts` for tool compatibility until fully folded in.
- **KYI pipeline:** `.github/workflows/kyi-data-refresh.yml` runs daily at 06:00 UTC —
  fetches 36 public data sources and imports leads (dedup by name).

## 5. Conventions

- **TypeScript strict** — `npm run build` (tsc + vite) must pass before pushing; CI enforces it.
- Pages in `src/pages/`, shared UI in `src/components/`, logic/API in `src/lib/`,
  contexts in `src/contexts/`. Route paths must match `MODULE_PATH` in `module-access.ts`.
- Branch off `main`, PR back to `main` (template in `.github/`). CI runs lint (non-blocking),
  type-check, build, and unit tests.
- Schema changes: write a new `supabase-<feature>-migration.sql` in the repo root, run it in
  the SQL Editor, and **check the Supabase security advisors afterward** (the MCP/dashboard
  lints catch missing RLS). New tables need `organization_id` + RLS from day one — see
  [SECURITY_REVIEW_2026-06-11.md](SECURITY_REVIEW_2026-06-11.md) for what happens otherwise.

## 6. Testing

```bash
npm run test          # vitest watch mode
npm run test:run      # CI mode
npm run test:e2e      # Playwright (see E2E_TESTING.md for auth setup)
npm run test:e2e:ui   # Playwright UI mode
```

## 7. Deployment & environments

- **Hosting:** Vercel — pushes to `main` deploy automatically; `vercel.json` handles SPA
  rewrites and `api/` functions.
- **Database:** Supabase project **Katana V2** (`uhvmhzmxsvrkzqqesbli`, us-west-2). The
  other projects in the org (`Katana v2 copy`, `Katana Switch`) are inactive.
- **Secrets:** Vercel env vars (app) + GitHub Actions secrets (KYI pipeline, backups).
  Never put the service role key in anything prefixed `VITE_` — those are bundled into
  client JS.

## 8. Key documents

| Doc | What's in it |
|-----|--------------|
| [SYSTEM_OVERVIEW.md](../SYSTEM_OVERVIEW.md) | Detailed architecture walkthrough |
| [DEV_LOCAL_SETUP.md](DEV_LOCAL_SETUP.md) | Local Supabase setup + troubleshooting |
| [SECURITY_REVIEW_2026-06-11.md](SECURITY_REVIEW_2026-06-11.md) | Current security posture + open remediations |
| [BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md) | Backup state, restore runbook |
| [E2E_TESTING.md](../E2E_TESTING.md) | Playwright setup |
| [ENV.md](../ENV.md) | Environment variable reference |
| [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md) | Auth provider configuration |
| [kyi-automation.md](kyi-automation.md) | KYI data pipeline details |

## 9. Gotchas (learned the hard way)

- `.env` changes need a dev-server restart; Vite only reads env at startup.
- RLS errors surface as empty lists or `permission denied`, not exceptions — when data
  "disappears", check policies before debugging the UI.
- PostgREST join errors (`PGRST200`) usually mean an FK/join-hint mismatch — comms APIs use
  explicit FK constraint names in their `select=` hints.
- `WorkforcePage.tsx` is current; `WorkforcePage.backup.tsx` / `WorkforcePageNew.tsx` are
  historical. The `app/` directory is legacy Next.js — the running app is `src/`.
- Console statements are stripped in production builds (`esbuild.drop`) — don't rely on
  `console.log` for prod diagnostics.
