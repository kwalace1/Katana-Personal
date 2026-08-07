# Supabase setup for Katana Personal

Optional cloud layer (Together: accounts, friends, circles, feed, workspace backup). Local IndexedDB stays the source of truth for personal data.

## 1. Create a project

1. Open [Supabase](https://supabase.com) → **New project**
2. Copy **Project URL** and **anon public** key (Settings → API)

## 2. Apply schema

In the SQL Editor, paste and run:

[`supabase/migrations/20260328000000_init_social.sql`](./supabase/migrations/20260328000000_init_social.sql)

This creates tables, RLS, Storage bucket `together`, and Realtime publication.

## 3. Env vars

Local `.env` and Vercel:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Optional:

```bash
# Show Continue with Apple (enable Apple provider in Supabase Auth first)
# VITE_SUPABASE_APPLE_AUTH=true
```

Auth → Providers → Email: enable. Disable “Confirm email” for soft launch if you want instant sign-up, or leave on and use magic-link / confirm flow.

## 4. Apple Sign-In (optional)

1. Apple Developer → Services ID + key
2. Supabase Auth → Providers → Apple → enable with Services ID / key / team ID
3. Set `VITE_SUPABASE_APPLE_AUTH=true`

## 5. Migrating from Firebase

If you have existing Firebase users/data, see [`scripts/migrate-firebase-to-supabase/README.md`](./scripts/migrate-firebase-to-supabase/README.md).

## 6. Smoke test

1. Settings → create cloud account
2. Friends → add by code
3. Circles / Feed / Shared
4. Settings → workspace sync merge/push/pull

Push notification *delivery* is not implemented yet (opt-in stores a token row only).
