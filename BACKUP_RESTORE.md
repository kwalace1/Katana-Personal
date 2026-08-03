# Backup and restore

> **See [docs/BACKUP_DISASTER_RECOVERY.md](docs/BACKUP_DISASTER_RECOVERY.md) for the current,
> verified backup/DR state and full runbook (June 2026).** Note: the "Dashboard backups"
> option below is **not available** on the current free plan. This file is kept as a
> command reference.

Katana stores data in **Supabase** (PostgreSQL). This doc covers how to back up and restore that data.

## What is stored in Supabase

- **Auth:** Users, sessions (Supabase Auth).
- **HR:** Employees, goals, performance reviews, learning paths, recognitions, etc. (see `supabase-hr-schema.sql` and related migrations).
- **Projects:** Projects, tasks, milestones, team members, file references (see `supabase-projects-schema.sql`).
- **Inventory:** Items, transactions, purchase orders, suppliers (see `supabase-inventory-schema.sql`).
- **WFM:** Jobs, technicians, scheduling (see `supabase-wfm-schema.sql`).
- **Recruitment:** Job postings, applications (see Supabase types in `src/lib/supabase.ts`).
- **Customer Success:** Clients, CSMs, interactions, etc. (see `customer-success-schema.sql`).

There is no separate “local” production database; the app reads/writes Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.

---

## Backup options

### 1. Supabase Dashboard backups (managed)

- **Dashboard:** Supabase project → **Database** → **Backups** (if available on your plan).
- Enables point-in-time recovery (PITR) where supported.
- Prefer this for routine, managed backups.

### 2. Manual dump (pg_dump)

For a full database snapshot:

```bash
# Get the database connection string from Supabase:
# Project → Settings → Database → Connection string (URI, include password)

pg_dump "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  --no-owner --no-acl \
  -F c \
  -f katana_backup_$(date +%Y%m%d_%H%M).dump
```

- Use **direct** connection (port 5432) for a single consistent snapshot if needed; pooler (6543) is fine for most cases.
- Restore with `pg_restore` (see below).

### 3. Schema + data export (SQL)

For a readable SQL backup (smaller datasets or schema-only):

```bash
pg_dump "postgresql://..." --no-owner --no-acl -f katana_backup.sql
```

Restore:

```bash
psql "postgresql://..." -f katana_backup.sql
```

---

## Restore

1. **From a Supabase backup (Dashboard):** Use the Supabase project’s **Restore** / PITR UI if available.
2. **From a custom dump:**
   - Create a new Supabase project (or use a staging DB).
   - Restore:
     - Custom format: `pg_restore --no-owner --no-acl -d "postgresql://..." katana_backup.dump`
     - Plain SQL: `psql "postgresql://..." -f katana_backup.sql`
3. **App config:** Point the app at the restored DB by setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the (new) project’s URL and anon key.

---

## Best practices

- Run backups on a schedule (Supabase managed backups or cron + `pg_dump`).
- Keep schema migrations in version control (`supabase-*-schema.sql`, `supabase-*-migration.sql`) and apply them in order when restoring to a fresh DB.
- Test restore in a non-production project before relying on it in production.
