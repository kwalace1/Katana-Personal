# Security Review & Vulnerability Assessment — Katana

**Date:** June 11, 2026
**Scope:** Live Supabase project **Katana V2** (`uhvmhzmxsvrkzqqesbli`) — database, RLS policies, auth config, storage — plus application repo (dependencies, secrets handling, deployment config, CI).
**Method:** Supabase security & performance advisors (live), direct `pg_policies` inspection, `npm audit`, repo secret scan, deployment config review.
**Previous audit:** [DATA_SECURITY_AUDIT.md](DATA_SECURITY_AUDIT.md) (April 2026). Several of its claims are now stale — notably *"All tables have RLS enabled"* is no longer true (see C-1).

---

## Executive summary

Overall posture is **moderate with three critical gaps**. The fundamentals put in place in
April (org-scoped RLS on module tables, auth-gated API functions, secret hygiene, input
validation) are holding. But features added since then — the KYI lead pipeline and the
Katana Agents (`kae_*`) tables — shipped with policies that expose data to the public
internet, and there are **no database backups** (covered separately in
[BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md)).

| Severity | Count | Headline |
|----------|-------|----------|
| Critical | 3 | Investor leads publicly readable; platform metadata publicly writable; 5 tables with no RLS |
| High | 4 | SECURITY DEFINER views bypass RLS; anon lead inserts; leaked-password protection off; `xlsx` vuln (no fix) |
| Medium | 6 | 19 anon-callable SECURITY DEFINER RPCs; 16 mutable search_path fns; bucket listing; no CSP/rate-limit/audit log |
| Low | 3 | Hardcoded anon keys in a script; dev auth bypass flags; 17 fixable npm vulns (mostly dev-time) |

Supabase advisors reported **67 security findings** and **280 performance findings** (summarized in §5).

---

## Critical

### C-1. Five `kae_*` tables have RLS disabled — fully exposed via the anon key

> **✅ FIXED June 12, 2026** — the katana-agents feature is deprecated (per owner), so RLS
> was enabled on all five tables with **no policies** (migration
> `enable_rls_kae_tables_security_fix`): full lockdown for anon/authenticated, data
> preserved, service_role/SQL access unaffected. Verified via REST — anon reads 0 rows on
> all five tables, INSERT returns 401. **Zero tables in `public` now have RLS disabled.**
> Reversible with `DISABLE ROW LEVEL SECURITY` (or proper policies) if the feature returns.

`public.kae_agents` (8 rows), `kae_events` (7), `kae_tasks` (5), `kae_messages`, `kae_xp_events`
have **no RLS at all**. Anyone holding the public anon key (it ships in the JS bundle) can
read **and write** every row via PostgREST — no login needed.

These tables back the Agent Office module and are written by the external katana-agents
service (its source is not in this repo; only `katana-agents/.env` is local).

**Remediation** — coordinate with the agents service first; if it connects with the anon key,
give it the service role key (bypasses RLS), then:

```sql
ALTER TABLE public.kae_agents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kae_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kae_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kae_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kae_xp_events ENABLE ROW LEVEL SECURITY;

-- Minimum viable policy set (mirror the KYI authenticated-only pattern):
CREATE POLICY authenticated_kae_agents    ON public.kae_agents    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY authenticated_kae_events    ON public.kae_events    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY authenticated_kae_tasks     ON public.kae_tasks     FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY authenticated_kae_messages  ON public.kae_messages  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY authenticated_kae_xp_events ON public.kae_xp_events FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
```

⚠️ Do **not** enable RLS without confirming how the agents service authenticates — enabling
it with no applicable policy will silently break that service.

### C-2. `kyi_investor_leads` is publicly readable — 7,463 rows, no login required

> **✅ FIXED June 12, 2026** — both anon policies dropped (migration
> `drop_anon_kyi_policies_security_fix`); verified via REST that the anon key now gets
> 0 rows on SELECT and a 400 on INSERT. ⚠️ The nightly KYI import will fail until the
> `SUPABASE_SERVICE_ROLE_KEY` repo secret is added (the import script already prefers it).

Live policy on the table (verified via `pg_policies`):

```
anon_select_kyi_leads  | anon | SELECT | qual: true
anon_insert_kyi_leads  | anon | INSERT | with_check: true
```

Anyone with the anon key can dump the **entire investor lead database** (names, firms,
contact and geo data) and insert arbitrary rows. This is the project's most valuable
dataset and it is effectively public.

Root cause: the daily `kyi-data-refresh.yml` GitHub Action imports with the anon key
(`SUPABASE_SERVICE_ROLE_KEY` is listed as *optional*), so anon write policies were added to
make the pipeline work.

**Remediation:**
1. Set the `SUPABASE_SERVICE_ROLE_KEY` repo secret (the import script
   [scripts/kyi-import-data.mjs](../scripts/kyi-import-data.mjs) already prefers it).
2. Drop both anon policies:
   ```sql
   DROP POLICY anon_select_kyi_leads ON public.kyi_investor_leads;
   DROP POLICY anon_insert_kyi_leads ON public.kyi_investor_leads;
   ```
   The existing `authenticated_kyi_leads` policy (`auth.uid() IS NOT NULL`) keeps the app working.
3. Run the workflow manually once to confirm the import still succeeds.

### C-3. `kyi_platform_metadata` "service" write policy actually grants `public`

> **✅ FIXED June 12, 2026** — policy dropped in the same migration; verified anon UPDATE
> now affects 0 rows. The import's metadata upsert runs as service_role (bypasses RLS)
> once the secret is set; until then it logs a warning and continues.

```
service_kyi_platform_metadata_write | {public} | ALL | qual: true, with_check: true
```

The policy is named as if it scoped writes to the service role, but it applies to **all
roles including `anon`** — anyone can update/delete platform metadata. (The service role
bypasses RLS anyway, so a "service" policy is unnecessary.)

**Remediation:**
```sql
DROP POLICY service_kyi_platform_metadata_write ON public.kyi_platform_metadata;
-- service_role bypasses RLS; authenticated read policy already exists.
```

---

## High

### H-1. Two SECURITY DEFINER views bypass RLS

`public.kyi_companies_with_counts` and `public.kyi_leads_for_client` run with the view
creator's privileges — queries through them ignore the caller's RLS. Combined with C-2 this
widens KYI exposure.

```sql
ALTER VIEW public.kyi_companies_with_counts SET (security_invoker = true);
ALTER VIEW public.kyi_leads_for_client       SET (security_invoker = true);
```
Test the KYI pages afterward; if the views were relying on definer rights to read across
RLS, the underlying policies need fixing instead.

### H-2. Leaked-password protection disabled (Supabase Auth)

Compromised-password checking against HaveIBeenPwned is off.
**Fix:** Dashboard → Authentication → Settings → enable *Leaked password protection*. No code change.

### H-3. `xlsx` dependency — high-severity vulnerability, **no fix available**

`npm audit`: prototype pollution / ReDoS in SheetJS (`xlsx`), no patched version on the npm
registry. The app parses spreadsheets (PM import, data migration pages) — malicious files
are a realistic vector.
**Options:** migrate to the maintained SheetJS CDN distribution (`https://cdn.sheetjs.com`)
which receives fixes, or restrict parsing to authenticated admin flows and accept the risk
short-term.

### H-4. Public `job_applications` insert is unauthenticated and unthrottled

`anon_insert_job_applications` (`with_check: true`, role `public`) is intentional — the
public careers page needs it — but there is no rate limiting or CAPTCHA, so the table can be
spammed and resume storage filled by a script. Acceptable for pilot; add Vercel-level rate
limiting or a Turnstile/CAPTCHA before public launch. Also note the policy role is `{public}`
rather than `{anon}` — harmless here, but tighten when touching it.

---

## Medium

### M-1. 19 SECURITY DEFINER functions executable by `anon` (and `authenticated`)

All exposed at `/rest/v1/rpc/...`, including `create_employee_invite`,
`complete_invite_signup`, `notify_kyi_module_stakeholders`, `fix_conversation_member_owners`.
Some must be anon-callable (invite signup flow); most should not be. Worst case examples:
unauthenticated users can trigger notification spam to stakeholders or probe membership
helpers.

**Remediation pattern** (apply per function after checking app usage):
```sql
REVOKE EXECUTE ON FUNCTION public.create_employee_invite(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_kyi_module_stakeholders(text, text, text, text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_kyi_leads_imported(integer, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fix_conversation_member_owners(uuid) FROM anon;
-- Keep anon EXECUTE only on: get_invite_by_code, complete_invite_signup (signup flow).
```
Trigger functions (`handle_new_user_from_invite`, `notify_hr_on_job_application_insert`,
`set_conversation_member_owner`) should not be REST-callable at all:
`REVOKE EXECUTE ... FROM anon, authenticated;`

### M-2. 16 functions with mutable `search_path`

SECURITY DEFINER functions without a pinned `search_path` are vulnerable to search-path
hijacking. Fix is mechanical:
```sql
ALTER FUNCTION public.get_user_organization_id() SET search_path = public, pg_temp;
-- repeat for the 15 others flagged by the advisor
```

### M-3. Public storage buckets allow listing

`employee-photos` and `project-files` are public buckets **and** have broad SELECT policies
on `storage.objects`, letting clients enumerate every file. Public URL access doesn't need
the listing policy — scope or drop the `employee_photos_select` / `project_files_select`
policies. Employee photos are PII; consider making that bucket private with signed URLs.

### M-4. No security headers / CSP

[vercel.json](../vercel.json) contains only rewrites. Add a `headers` block with
`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

### M-5. No rate limiting on API routes

`api/chat.ts`, `api/rag.ts`, `api/tools.ts` authenticate correctly (Supabase bearer token
verified server-side, user-scoped client) but have no throttling — LLM endpoints are an
abuse/cost vector. Add per-user rate limiting (Vercel KV / Upstash) post-pilot.

### M-6. No audit logging

Unchanged from April review. No record of who changed what. Postgres triggers writing to an
append-only `audit_log` table is the lightest path.

---

## Low

- **L-1. Hardcoded anon keys in** [scripts/kyi-migrate-zenith-to-katana.mjs](../scripts/kyi-migrate-zenith-to-katana.mjs)
  — two project anon keys committed (Zenith + Katana). Anon keys are designed to be public,
  so impact is low, but move them to env vars; the Zenith key belongs to a third project and
  shouldn't live in this repo's history at all.
- **L-2. Dev auth bypass** (`VITE_DEV_AUTH_BYPASS`, `VITE_DEV_EMAIL/PASSWORD`) — fine
  locally; confirm these are never set in Vercel production env.
- **L-3. 17 fixable npm vulnerabilities** — `npm audit` shows 18 total (2 critical, 11 high,
  5 moderate); all but `xlsx` (H-3) have fixes via `npm audit fix` / minor bumps. The two
  criticals (`vitest`, `@vitest/coverage-v8`) are dev-only. Schedule a dependency-bump PR:
  react-router/react-router-dom, vite, rollup, undici, esbuild, postcss, ws, etc.

---

## What's working well (verified)

- **RLS coverage:** 76 of 81 tables have RLS enabled; core module tables enforce
  `organization_id = get_user_organization_id()` multi-tenancy; comms uses membership-based
  policies.
- **API auth:** the Edge functions verify the caller's Supabase JWT server-side and use a
  user-scoped client — RLS applies to AI tool calls. Good design.
- **Secret hygiene:** `.env`, `.env.local`, `katana-agents/.env` all gitignored and not in
  git history of tracked files; `.env.example` is placeholder-only; service role key used
  only in server-side scripts via env.
- **App layer:** Zod validation (`src/lib/validation.ts`), file-upload allowlist + 25MB cap,
  `console`/`debugger` stripped from prod builds, no hardcoded credentials in `src/`.
- **CI:** type-check + build + tests on every PR; least-privilege workflow permissions
  (`contents: read`).

## §5. Performance advisors (informational)

280 findings, none security-relevant: 89 unindexed foreign keys, 69 unused indexes,
63 multiple-permissive-policy warnings, 58 `auth.uid()` initplan warnings (wrap as
`(SELECT auth.uid())` in policies for performance), 1 duplicate index. Worth a separate
pass once the security items land — the initplan and multiple-permissive items also reduce
per-query policy cost on hot tables like `kyi_investor_leads`.

---

## Prioritized remediation plan

| # | Action | Effort | Owner suggestion |
|---|--------|--------|------------------|
| 1 | ~~Drop anon SELECT/INSERT policies on `kyi_investor_leads`~~ **DONE 6/12** — still need `SUPABASE_SERVICE_ROLE_KEY` secret for the refresh workflow (C-2) | ~30 min | This week |
| 2 | ~~Drop public write policy on `kyi_platform_metadata`~~ **DONE 6/12** (C-3) | 5 min | This week |
| 3 | ~~Enable RLS on `kae_*`~~ **DONE 6/12** — feature deprecated, locked down with no policies (C-1) | 1–2 h | This week |
| 4 | Enable leaked-password protection (H-2) | 2 min | This week |
| 5 | Convert 2 KYI views to `security_invoker` (H-1) | 30 min + test | This week |
| 6 | Revoke anon EXECUTE on non-signup RPCs (M-1) | 1 h | Next sprint |
| 7 | Pin `search_path` on 16 functions (M-2) | 1 h | Next sprint |
| 8 | Tighten storage bucket listing policies (M-3) | 1 h | Next sprint |
| 9 | Add security headers to vercel.json (M-4) | 1 h | Next sprint |
| 10 | `npm audit fix` + dep bump PR; decide on `xlsx` strategy (L-3, H-3) | 2–4 h | Next sprint |
| 11 | Rate limiting on careers form + AI endpoints (H-4, M-5) | 0.5–1 d | Pre-launch |
| 12 | Audit logging (M-6) | 1–2 d | Post-pilot |

**Remediation status:** all three criticals (C-1, C-2, C-3) were applied and verified on
June 12, 2026 (user-approved). The remaining SQL above is presented for explicit approval,
because the other fixes (H-1, M-1) can affect app flows if applied without testing.
