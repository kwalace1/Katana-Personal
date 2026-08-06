> **Archived business SaaS docs** — this file does **not** describe Katana Personal. For the current product see [../README.md](../README.md), [SOFT_LAUNCH_CHECKLIST.md](./SOFT_LAUNCH_CHECKLIST.md), and [PERSONAL_NEXT_PLAN.md](./PERSONAL_NEXT_PLAN.md).

# Local dev with a real database

The **Continue without sign-in (dev)** button can use a real Supabase session so HR, projects, inventory, and other modules work (not just the UI shell).

## 1. Configure Supabase in `.env`

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

VITE_DEV_AUTH_BYPASS=true
VITE_DEV_EMAIL=dev@localhost
VITE_DEV_PASSWORD=DevLocal123!

# Server-only — for npm run dev:seed (never commit)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

In Supabase: **Authentication → Providers → Email** → enable Email, and turn off **Confirm email** for faster local signup.

## 2. Apply database schemas

In **Supabase → SQL Editor**, run (at minimum):

1. `supabase-invite-code-migration.sql` — organizations, user_profiles  
2. `supabase-hr-schema.sql` — hr_employees  
3. `supabase-hr-module-access-migration.sql` — module_access column  
4. `supabase-rls-authenticated-only-migration.sql` **or** your team’s RLS migrations  

If inserts fail with column errors, also run `supabase-user-isolation-migration.sql` (adds `user_id`, `organization_id` where applicable).

## 3. Seed the dev user

```bash
npm run dev:seed
```

This creates:

- Auth user `dev@localhost` (or `VITE_DEV_EMAIL`)
- Organization + `user_profiles` row (owner)
- `hr_employees` row for the same email with full module access

## 4. Run the app

```bash
npm run dev
```

Open http://localhost:3001 → **Continue without sign-in (dev)**. You should be signed in with a valid JWT; **HR → Add Employee** and other writes will hit Supabase.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Not authenticated` | Add `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD`; restart dev server after `.env` changes |
| `No organization found` | Run `npm run dev:seed` |
| RLS / permission denied | Ensure authenticated RLS policies exist; seed sets `user_id` on HR rows |
| Invalid API key | Replace placeholder `VITE_SUPABASE_*` with real project keys |

Mock-only mode (no database) still works if Supabase URL/key are placeholders and dev email/password are unset — UI only, no saves.
