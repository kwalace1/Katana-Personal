# Firebase → Supabase data migration

One-shot import of Auth users, Firestore collections, and Storage objects.

## Before you run

1. Create a Supabase project and run [`supabase/migrations/20260328000000_init_social.sql`](../../supabase/migrations/20260328000000_init_social.sql) in the SQL editor.
2. Download a Firebase **service account** JSON (Project settings → Service accounts).
3. Copy env:

```bash
cp .env.example .env
```

4. Freeze Firebase writes (ask users to stay signed out of cloud briefly).

## Run

```bash
npm install
DRY_RUN=1 node migrate.mjs   # inspect mapping
node migrate.mjs             # write to Supabase
```

## UID mapping

Firebase Auth UIDs are not UUIDs. Each Firebase UID becomes a **deterministic UUID v5**. All friendship / viewer / member arrays are rewritten with the same map. Re-running the script is idempotent for the same inputs.

## Passwords

Email/password hashes are **not** copied by this script. After cutover, migrated users should use **Forgot password** (or you can separately import Firebase password hashes via Supabase’s Firebase Auth migration tooling). Apple users need the Apple provider enabled on Supabase.
