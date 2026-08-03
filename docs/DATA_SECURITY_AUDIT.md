# Katana Data Security & Privacy Audit

> **⚠️ Superseded:** see [SECURITY_REVIEW_2026-06-11.md](SECURITY_REVIEW_2026-06-11.md) for the
> current assessment. Some claims below are stale — e.g. "All tables have RLS enabled" is no
> longer true (the `kae_*` tables added since April have RLS disabled), and new anon-exposed
> KYI policies were introduced by the data-refresh pipeline.

**Date:** April 16, 2026
**Last Updated:** April 18, 2026
**Scope:** Full-stack security posture review — Supabase (live DB) + application layer (React/TypeScript)

---

## Current Security Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Authentication | ACTIVE | Supabase Auth w/ Microsoft SSO + email/password |
| Session management | ACTIVE | Auto token refresh, session persistence, expiry handling |
| RLS enabled on all tables | ACTIVE | All tables have RLS enabled |
| Organization-level multi-tenancy | ACTIVE | All module tables use `organization_id` RLS (migrated from `user_id`) |
| Comms membership-based RLS | ACTIVE | Organization-scoped, membership-checked policies |
| RBAC (role-based access) | ACTIVE | 4 roles: owner, admin, member, viewer |
| Module-level access control | ACTIVE | Per-employee module access array |
| HTTPS/TLS in transit | ACTIVE | Enforced by Supabase + Vercel |
| Data at rest encryption | ACTIVE | AES-256 via Supabase infrastructure |
| `.env` in `.gitignore` | ACTIVE | Secrets not committed to repo |
| Input validation | ACTIVE | Zod schemas in `src/lib/validation.ts` |
| File upload validation | ACTIVE | Type allowlist, 25MB size limit, MIME checking |
| Console stripping in prod | ACTIVE | `esbuild.drop` removes `console` and `debugger` in production |
| `.env.example` sanitized | ACTIVE | Placeholder values only |
| Audit logging | **MISSING** | No record of who did what and when |
| Rate limiting | **MISSING** | No API-level throttling |
| CSP headers | **MISSING** | No Content Security Policy headers |
| Error boundaries | **MISSING** | No React error boundaries to prevent state leakage |

---

## Remediation Log

### Fixes Applied — April 16–18, 2026

#### P0 — Critical (All Completed)

| # | Issue | Fix Applied | Status |
|---|-------|-------------|--------|
| 1 | 8 KYI tables had `qual: true` (wide-open) | Dropped `true` policies; replaced with `auth.uid() IS NOT NULL` on all 8 tables | FIXED |
| 2 | `organizations` table had RLS disabled | Enabled RLS; added SELECT (own org), UPDATE (owner/admin), INSERT (authenticated) policies | FIXED |
| 3 | All `user_id` columns were NULLABLE | Set `NOT NULL` with default `auth.uid()` on all existing module tables | FIXED |
| 4 | No input validation library | Added Zod; created `src/lib/validation.ts` with schemas for all modules | FIXED |
| 5 | No file upload restrictions | Added `validateFile()` — file type allowlist, 25MB limit, MIME validation in `upload-file-dialog.tsx` | FIXED |

#### P1 — Important (Mostly Completed)

| # | Issue | Fix Applied | Status |
|---|-------|-------------|--------|
| 6 | 200+ console statements leak state in prod | Added `esbuild: { drop: ['console', 'debugger'] }` to `vite.config.ts` for production builds | FIXED |
| 7 | `.env.example` contained real credentials | Replaced EmailJS service IDs and keys with placeholder values | FIXED |
| 8 | No React error boundaries | — | OPEN |

#### P2 — Post-Pilot (Partially Completed)

| # | Issue | Fix Applied | Status |
|---|-------|-------------|--------|
| 9 | No audit logging | — | OPEN |
| 10 | No rate limiting | — | OPEN |
| 11 | Module tables used `user_id` isolation (no multi-tenancy) | Added `organization_id` column to all module tables; backfilled existing data; replaced all `user_id` RLS policies with `organization_id = get_user_organization_id()` policies; updated all API layers to include `organization_id` on inserts | FIXED |
| 12 | No CSP headers | — | OPEN |

#### Additional Fixes (April 18, 2026)

| Issue | Fix Applied |
|-------|-------------|
| Comms conversations/messages not loading (PGRST200) | Dropped redundant FK constraints from `comms_conversation_members`, `comms_channel_members`, and `comms_messages` to `auth.users` that conflicted with `user_profiles` FKs; updated all PostgREST join hints in `comms-api.ts` to use explicit FK constraint names (`user_profiles!fk_conv_member_profile`, etc.) |
| Shared org ID helper missing | Created `getOrganizationId()` and `clearOrgCache()` in `auth-helpers.ts`; integrated cache clearing into `AuthContext.signOut()` |
| Group conversation names were null | Updated `NewConversationDialog.tsx` to pass selected member names as group name |

---

## Detailed Findings (Current State)

### 1. Authentication & Session (GOOD)

- Supabase Auth with Microsoft Azure AD SSO (OAuth) + email/password fallback
- Session auto-refresh via `autoRefreshToken: true`
- `AuthGuard` component redirects unauthenticated users from protected routes
- `ProtectedRoute` component enforces role requirements
- Clock skew detection and graceful error handling
- Password gate (`PasswordGate.tsx`) adds an additional access layer with 5-minute expiry tokens

### 2. Row Level Security — Live Database (GOOD)

**All tables with RLS enabled — no tables without RLS.**

**Organization-isolated tables (SECURE):**
All core module tables enforce `organization_id = get_user_organization_id()`:
- Projects: `projects`, `tasks`, `milestones`, `milestone_tasks`, `team_members`, `project_files`, `activities`, `sprints`, `sprint_tasks`
- HR: `hr_employees`
- Inventory: `inventory_items`, `inventory_movements`, `purchase_orders`, `po_line_items`, `suppliers`, `inventory_transactions`
- WFM: `wfm_technicians`, `wfm_jobs`, `wfm_schedules`, `wfm_timesheets`, `wfm_job_notes`
- Customer Success: `csm_users`, `cs_clients`, `cs_tasks`, `cs_milestones`, `cs_interactions`, `cs_health_history`

**KYI tables (SECURE — authenticated only):**
All KYI tables enforce `auth.uid() IS NOT NULL`:
- `kyi_companies`, `kyi_investors`, `kyi_client_geo_settings`, `kyi_investor_geo_settings`
- `kyi_investor_leads`, `kyi_investor_type_profiles`, `kyi_entities`
- `kyi_geocode_cache`, `kyi_geocode_jobs`, `kyi_claim_geocode_jobs`
- `kyi_lead_profile_intel`, `kyi_location_claims`

**Comms tables (SECURE — membership-based):**
Organization-scoped with membership checks via SECURITY DEFINER functions:
- `comms_channels`: org members can view public; private requires membership
- `comms_messages`: visible only to channel/conversation members
- `comms_conversations`: visible only to creator or members
- `comms_channel_members`, `comms_conversation_members`: scoped correctly

**Organization/profile tables (SECURE):**
- `organizations`: RLS enabled; SELECT own org, UPDATE for owner/admin, INSERT for authenticated
- `user_profiles`: read own + same-org profiles; insert/update own only
- `organization_invitations`: admin-only insert; read own-org only

### 3. Missing HR Tables

The API layer (`hr-api.ts`) references tables that only `hr_employees` exists for in the live database:
- `hr_performance_reviews`, `hr_goals`, `hr_goal_comments`, `hr_360_feedback`, `hr_mentorships`, `hr_recognitions`, `hr_learning_paths`, `hr_career_paths`, `hr_activities`

These will need `organization_id` columns and org-based RLS when created.

### 4. Application-Layer Security

**Input validation (IMPLEMENTED):**
- Zod schemas defined in `src/lib/validation.ts` for all module data types
- File upload validation: type allowlist (PDF, Office, images, etc.), 25MB size limit, MIME type checking

**Console logging (MITIGATED):**
- Production builds strip all `console.*` and `debugger` statements via Vite's esbuild config

**Known acceptable risks:**
- `dangerouslySetInnerHTML` in `chart.tsx` — low risk (static theme data)
- `VITE_ACCESS_PASSWORD` bundled in client JS — speed bump only, not real security

---

## Remaining Open Items

### P1 — Should Fix Before Pilot

1. **Add React error boundaries** — Prevent crashes from leaking internal state to users

### P2 — Should Fix Soon After Pilot

2. **Audit logging** — Track who changed what and when (Supabase DB triggers or edge functions)
3. **Rate limiting** — Add rate limiting via Supabase edge functions or Vercel middleware
4. **CSP headers** — Add Content Security Policy headers via Vercel config
5. **KYI org-scoping** — KYI tables currently use `auth.uid() IS NOT NULL` (authenticated-only); should migrate to `organization_id` isolation for true multi-tenancy when KYI has multi-org users

---

## What Supabase Handles (No Action Required)

- TLS/HTTPS enforcement on all API endpoints
- AES-256 encryption at rest for all database storage
- Automatic JWT token management and validation
- DDoS protection at the infrastructure level
- Database connection pooling and isolation
- Automated backups (Point-in-Time Recovery on Pro plan)
