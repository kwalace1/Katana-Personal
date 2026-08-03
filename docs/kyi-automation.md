# Automating KYI data collection

You can automate (1) **downloading** CSV data from URLs and (2) **importing** it into the platform lead pool.

## Organization isolation

- **Tenant workspace** (companies, investors, geo, notes, intel, Northstar) is scoped to the signed-in user's `organization_id`. Each org gets a default KYI company named after the organization.
- **Platform lead catalog** rows imported by these scripts intentionally leave `organization_id` null so every org can browse the shared public-data pool (then filtered by that org's geo settings).
- Production databases must have run **`supabase-pilot-org-rls-kyi-migration.sql`** and **`scripts/kyi-fix-org-company-ownership.sql`** so RLS + ownership match the app. See [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md#know-your-investor-kyi-organization-isolation).

## 1. One-off refresh (fetch + import)

```bash
npm run kyi:refresh
```

This runs **fetch** (downloads CSVs from configured URLs into `data/`) then **import** (upserts into Supabase). Use this manually or from cron.

## 2. Configure where to fetch data from

Add a file **`data/kyi-fetch-urls.json`** (copy from `data/kyi-fetch-urls.example.json`):

```json
{
  "fec_donors.csv": "https://your-source.com/fec_donors.csv",
  "sec_13f.csv": "https://your-source.com/sec_13f.csv"
}
```

Each key is the filename to write under `data/`; each value is the URL to download. Only files you list are fetched; other CSVs in `data/` are left as-is.

**Alternative: env vars**

Set `KYI_FETCH_<filename>=<url>`. The script turns the key into a filename (e.g. `KYI_FETCH_fec_donors=https://...` → `fec_donors.csv`).

If no URLs are configured, **`npm run kyi:fetch-data`** just prints a short help and exits. **`npm run kyi:refresh`** still runs import after fetch (so import will use whatever is already in `data/`).

## 3. Schedule with cron (recommended)

Run a full refresh on a schedule (e.g. daily at 2 AM):

```bash
# Edit crontab
crontab -e

# Add (adjust path to your katana repo):
0 2 * * * cd /path/to/katana-vv2 && npm run kyi:refresh >> /tmp/kyi-refresh.log 2>&1
```

Or **only import** (no fetch) if you update CSVs by some other means:

```bash
0 2 * * * cd /path/to/katana-vv2 && npm run kyi:import-data >> /tmp/kyi-import.log 2>&1
```

## 4. Background scheduler (optional)

Keep a process running that runs fetch + import every N hours:

```bash
npm run kyi:schedule
# Or every 12 hours:
node scripts/kyi-schedule.mjs 12
```

Stop with Ctrl+C. Prefer **cron** on a server so you don’t depend on a long-running process.

## Summary

| Goal | Command |
|------|--------|
| Download CSVs from URLs | `npm run kyi:fetch-data` |
| Import CSVs into Supabase | `npm run kyi:import-data` |
| Fetch then import (full refresh) | `npm run kyi:refresh` |
| Run refresh every N hours in foreground | `npm run kyi:schedule` or `node scripts/kyi-schedule.mjs 24` |
| Run refresh daily via cron | `0 2 * * * cd /path/to/katana-vv2 && npm run kyi:refresh` |
