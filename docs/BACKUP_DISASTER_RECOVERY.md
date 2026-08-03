# Backup & Disaster Recovery — Katana

> **Status update (June 12, 2026):** automated daily backups are now **ACTIVE** via the
> GitHub Actions workflow described in §2 Option B. The `SUPABASE_DB_URL` secret is set and
> a verified test backup ran successfully (full dump incl. `public`, `auth`, `storage`
> schemas — confirmed to contain all key tables). §1 below describes the state as found
> during the June 11 review, before the workflow was enabled.

**Date verified:** June 11, 2026
**Verified against:** Live Supabase project **Katana V2** (`uhvmhzmxsvrkzqqesbli`, us-west-2, Postgres 17), org **DW Growth & Capital**
**Supersedes:** [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) (kept for the pg_dump/pg_restore command reference)

---

## 1. Confirmed current state (verified, not assumed)

| Item | Status | Detail |
|------|--------|--------|
| Supabase managed backups | ❌ **NOT ACTIVE** | Org is on the **free plan**. Managed daily backups require Pro; PITR is a paid add-on on top of Pro. |
| Point-in-time recovery (PITR) | ❌ Not available | Pro + PITR add-on required. |
| Scheduled `pg_dump` (CI or cron) | ❌ None found | The only scheduled workflow is `kyi-data-refresh.yml` (data import). CI does lint/test/build only. |
| Database schema | ✅ In version control | All `supabase-*.sql` schema/migration files in repo root. |
| Application code | ✅ In version control | GitHub (`main` branch), deployed via Vercel. |
| Storage objects (uploaded files) | ❌ Not backed up | Buckets `employee-photos`, `project-files` live only in Supabase Storage. |
| Auth users | ❌ Not backed up | `auth.users` exists only in the live database. |
| Restore procedure ever tested | ❌ Never | No record of a test restore. |

> **Bottom line:** as of June 11, 2026 there are **no backups of any production data**. If the
> Supabase project were deleted, corrupted, or hit by a bad migration, all rows (including
> ~7,400 KYI investor leads, HR employee records, comms history, and all auth users) would be
> unrecoverable. The schema and code would survive; the data would not.

Other projects in the org (`Katana v2 copy`, `Katana Switch`) are **INACTIVE** free-tier projects, not backups.

**Effective objectives today:** RPO = ∞ (total data loss possible) · RTO = undefined.
**Recommended targets:** RPO ≤ 24h, RTO ≤ 4h — both achievable with the steps in §2.

---

## 2. Closing the gap (pick at least one of A/B — do this week)

### Option A — Upgrade Supabase to Pro (recommended)

- **Pro plan** includes automated daily backups with 7-day retention; restore from the
  Dashboard → Database → Backups.
- Optional **PITR add-on** gives second-level granularity (RPO ≈ seconds).
- Zero maintenance; backups live inside Supabase infrastructure.

### Option B — Scheduled `pg_dump` via GitHub Actions (free)

**✅ CONFIGURED AND VERIFIED — June 12, 2026.** The workflow at
[.github/workflows/db-backup.yml](../.github/workflows/db-backup.yml) runs daily at
08:00 UTC, dumps the full database (custom format, includes `auth` schema), and stores it
as a GitHub Actions artifact with 30-day retention (Actions → Database Backup → run →
Artifacts).

How it authenticates — a dedicated Postgres role **`backup_runner`** (not the master
`postgres` user):

- Read-only (`pg_read_all_data`) + `BYPASSRLS` (required — `pg_dump` refuses to run when
  RLS would filter rows), `LOGIN`, connection limit 2, 30-min statement timeout.
- The `SUPABASE_DB_URL` repo secret holds its **session pooler** connection string
  (`postgresql://backup_runner.<ref>:<password>@aws-0-us-west-2.pooler.supabase.com:5432/postgres`).
  Session pooler, not direct (IPv6-only, unreachable from GitHub runners) and not the
  transaction pooler on 6543 (`pg_dump` needs session mode).
- **To rotate:** `ALTER ROLE backup_runner PASSWORD '<new>';` then update the
  `SUPABASE_DB_URL` secret. **To revoke entirely:** `DROP ROLE backup_runner;` and delete
  the secret — app traffic is unaffected.

**Caveats of Option B:**
- Backup artifacts contain PII (HR records, emails). They are visible to anyone with read
  access to this repo — keep the repo private, and prefer Option A or an encrypted S3 target
  for anything beyond pilot stage.
- GitHub artifacts max retention is 90 days; this is operational backup, not archival.

### Also do regardless of A or B

- **Storage buckets:** the backup workflow includes a storage step that downloads every
  object in every bucket (via `storage.objects` + the Storage API) into a second artifact.
  It activates once the `SUPABASE_SERVICE_ROLE_KEY` repo secret is set; until then it
  skips with a warning and uploaded files are unprotected.
- **Test a restore** (see §4) into a scratch Supabase project once, and quarterly thereafter.
  An untested backup is not a backup.

---

## 3. Backup procedures (manual, on demand)

Take a manual snapshot before any risky migration or bulk import:

```bash
# Connection string: Dashboard → Settings → Database → Connection string (URI)
pg_dump "postgresql://postgres:[password]@db.uhvmhzmxsvrkzqqesbli.supabase.co:5432/postgres" \
  --no-owner --no-acl -F c \
  -f katana_backup_$(date +%Y%m%d_%H%M).dump
```

- Use the **direct** connection (port 5432) for a consistent snapshot. `pg_dump` version must
  be ≥ 17 to match the server.
- For a readable plain-SQL dump, drop `-F c` and use `-f backup.sql`.

---

## 4. Restore runbook

### Scenario 1 — Bad data change / accidental delete (most likely)

1. Stop the bleeding: if a workflow or import caused it, disable the workflow
   (`kyi-data-refresh.yml` is the only scheduled writer).
2. Create a **scratch Supabase project**, restore the latest dump into it:
   ```bash
   pg_restore --no-owner --no-acl -d "postgresql://...scratch..." katana_backup.dump
   ```
3. Extract just the affected rows (SQL `COPY`/`INSERT ... SELECT` via a foreign data wrapper,
   or export to CSV) and re-insert into production. Avoid restoring the whole dump over
   production — you'd lose everything written since the dump.

### Scenario 2 — Whole project lost (deletion, region failure, account compromise)

1. Create a new Supabase project (same region: us-west-2).
2. Restore the most recent dump:
   ```bash
   pg_restore --no-owner --no-acl -d "postgresql://...new project..." katana_backup.dump
   ```
   If no dump exists, rebuild schema only from the repo's `supabase-*.sql` files in the
   order described in [DEV_LOCAL_SETUP.md](DEV_LOCAL_SETUP.md) — data is gone.
3. Re-create storage buckets (`employee-photos`, `project-files`) and re-apply
   `supabase-storage-buckets-migration.sql`; restore files from the storage sync if one exists.
4. Re-point the app: update `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel project
   env vars and redeploy; update the same values in GitHub Actions secrets
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_DB_URL`) and in `katana-agents/.env`.
5. Auth: a full `pg_dump` restore includes `auth.users`, but users signed in via
   Microsoft OAuth re-authenticate transparently; email/password users keep working because
   password hashes are in `auth.users`. JWT secret differs on a new project, so all existing
   sessions are invalidated — users just log in again.
6. Verify: log in, spot-check one module per data domain (HR, PM, Inventory, KYI, Comms).

### Scenario 3 — Vercel/app outage

No data is at risk; redeploy from `main` (Vercel → Deployments → Redeploy, or push a commit).
The Supabase backend is unaffected.

---

## 5. Ongoing schedule

| Action | Frequency | Owner |
|--------|-----------|-------|
| Automated dump (workflow) or Supabase managed backup | Daily | Automated |
| Manual dump before risky migrations / bulk imports | As needed | Whoever runs the migration |
| Restore test into scratch project | Quarterly | Eng |
| Review this doc + verify backups are actually running | Quarterly | Eng |
