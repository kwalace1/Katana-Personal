# Sign in with Microsoft – Setup Guide

The app uses **Supabase** for auth. "Sign in with Microsoft" will work once you have a Supabase project and Azure app configured.

---

## Invite by email (Katana account without Microsoft)

Admins can invite people by email so they create a **Katana account with email + password** (no Microsoft login). After sign-up, add them as employees in HR to set permissions.

1. **Enable Email provider** in Supabase: **Authentication → Providers → Email** → enable and save (optionally turn off "Confirm email" so invite links work immediately).
2. **Run the invite migration** in Supabase SQL Editor: open **`supabase-invite-email-auth-migration.sql`** in this repo, copy its contents, paste into the editor, and run. This adds token/expires to `organization_invitations`, the `get_invite_by_token` RPC, and a trigger that creates `user_profiles` when someone signs up with an invited email.
3. **Invite someone:** as an admin, go to **Settings → Organization** → **Invite by email**, enter their email and role, click **Create invite link**, then copy the link and send it to them (e.g. from another email).
4. **They open the link**, set a password, and click **Create my Katana account**. They are added to your organization with the role you chose. Then add them in **HR → Employees** and set module access as needed.

---

## What you need

1. **Supabase project** (free at [supabase.com](https://supabase.com))
2. **Azure AD app** (Microsoft Entra) for OAuth
3. **Environment variables** in a `.env` file

---

## Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. **New project** → pick org, name, database password, region.
3. Wait for the project to be ready.
4. In the dashboard go to **Settings → API** and copy:
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **anon public** key → use as `VITE_SUPABASE_ANON_KEY`

---

## Step 2: Register an app in Azure (Microsoft Entra)

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** (or **Azure Active Directory**).
2. **App registrations** → **New registration**.
   - Name: e.g. `Katana Sign In`
   - Supported account types: e.g. **Accounts in this organizational directory only** (or as you need).
   - Redirect URI: choose **Web** and add exactly (replace `YOUR-PROJECT-REF` with your Supabase project reference):
     - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   - Use **localhost** (not 127.0.0.1) for local testing; the callback goes to Supabase first, then Supabase redirects to your app.
3. After creation, go to the app → **Overview** and copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**
4. **Certificates & secrets** → **New client secret** → copy the **Value** (secret). You’ll use this in Supabase.

---

## Step 3: Configure Microsoft in Supabase

1. In Supabase dashboard: **Authentication** → **Providers**.
2. Find **Azure** and enable it.
3. Fill in:
   - **Client ID (Azure)** = Application (client) ID from Azure.
   - **Client Secret (Azure)** = the client secret value from Azure.
   - **Azure Tenant ID** = Directory (tenant) ID (optional but recommended for single-tenant).
4. Save.

---

## Step 4: URL Configuration in Supabase (fixes "localhost refused to connect")

After Microsoft sign-in, Supabase redirects your browser back to your app. If that URL uses the **wrong port** (e.g. 3000), you’ll see **“This site can’t be reached / localhost refused to connect”** because nothing is running on that port.

1. In Supabase: **Authentication** → **URL Configuration**.
2. Set **Site URL** to the exact URL where your app runs:
   - Local dev: **`http://localhost:3001`** (this app’s Vite dev server uses port **3001** by default, not 3000).
   - Production: your real app URL, e.g. `https://app.yourdomain.com`.
3. Under **Redirect URLs**, add:
   - `http://localhost:3001/**`
   - `http://localhost:3001` (optional; some flows need the base URL too)
   - For production: `https://yourdomain.com/**`
4. Save.

If **Site URL** was `http://localhost:3000` but you run the app on 3001, change it to 3001 and try sign-in again.

---

## Step 5: Set environment variables locally

1. In the project root, copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_from_supabase
   ```
3. Restart the dev server:
   ```bash
   npm run dev
   ```

---

## Summary checklist

- [ ] Supabase project created
- [ ] Supabase **Project URL** and **anon key** in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Azure app registered with SPA redirect URI pointing to Supabase callback
- [ ] Azure **Client ID**, **Client secret**, and (optionally) **Tenant ID** set in Supabase → Authentication → Azure
- [ ] Redirect URLs in Supabase include your app origins (e.g. `http://localhost:3001/**`)
- [ ] Dev server restarted after changing `.env`

After this, **Sign in with Microsoft** should redirect to Microsoft and then back to your app (e.g. `/hub`) when login succeeds.

---

## Know Your Investor (KYI) organization isolation

KYI treats the signed-in **organization as the primary company** (`ensureOrganizationCompany` creates a `kyi_companies` row named after the org when missing). Companies, investors, geo, notes, intel, and Northstar stay private per organization. Investor **leads** are visible when they belong to your org **or** when `organization_id` is null (shared public-data catalog from `npm run kyi:import-data`).

### KYI 2.0 shared ecosystem

Run **`supabase-kyi-ecosystem-migration.sql`** in the SQL Editor to enable the shared investor directory:

- `kyi_global_investors` — platform-wide public identity (name, firm, focus, categories)
- `kyi_investor_category_defs` + junction — faceted taxonomy from the KYI 2.0 write-up
- `kyi_investors.global_investor_id` / `kyi_investor_leads.global_investor_id` — link private rows without duplicating identity
- Backfill from existing org investors + **high-quality** platform leads only
- Aggregate “tracked by N companies” counts (no org names exposed)

Then run **`supabase-kyi-ecosystem-quality-cleanup.sql`** to strip noisy scrapes (FEC, Reddit, GitHub, Mastodon, etc.) from an already-backfilled directory and re-link SEC / Wikidata / FINRA / registry sources.

Then run **`supabase-kyi-private-crm-migration.sql`** for the private tenant CRM layer on investor records (tasks, documents/NDAs, activity, valuations, internal rating). These never sync to the shared directory.

Then run **`supabase-kyi-files-bucket-migration.sql`** for private NDA/document file uploads (`kyi-files` storage bucket).

Then run **`supabase-kyi-enrichment-backfill.sql`** to fill sparse shared `investment_focus` / `public_history` from quality leads and tenant links.

UI: `/kyi/ecosystem` browse + **Add to our raise** (associate). Private notes/pipeline remain on `kyi_investors`.

For production (and any shared Supabase project), run these in the SQL Editor if they have not been applied yet:

1. **`supabase-pilot-org-rls-kyi-migration.sql`** — `org_isolation_*` RLS (org-owned rows + read-only platform leads).
2. **`scripts/kyi-fix-org-company-ownership.sql`** — detach leaked demo companies (Katana / Swing) from tenant orgs and ensure each org has a default company named after itself.
3. **`supabase-kyi-ecosystem-migration.sql`** — shared global directory + categories (KYI 2.0).
4. **`supabase-kyi-ecosystem-quality-cleanup.sql`** — keep only high-quality sources in the ecosystem directory.
5. **`supabase-kyi-private-crm-migration.sql`** — private tasks / docs / activity / valuations on `kyi_investors`.
6. **`supabase-kyi-files-bucket-migration.sql`** — private document storage bucket.
7. **`supabase-kyi-enrichment-backfill.sql`** — deepen shared focus/history from quality sources.

App code also fail-closes with `assertCompanyInOrg` / `assertInvestorInOrg`, and hides known cross-tenant demo names from the company list.

---

## Troubleshooting

### "This site can’t be reached" / "localhost refused to connect" after picking your Microsoft account

You’re being sent to a URL that isn’t running (usually **port 3000** while the app runs on **3001**).

1. In Supabase: **Authentication** → **URL Configuration**.
2. Set **Site URL** to **`http://localhost:3001`** (match the port your dev server uses).
3. In **Redirect URLs**, add **`http://localhost:3001/**`** and save.
4. Open the app at **http://localhost:3001** (not 3000), then try **Sign in with Microsoft** again.

---

### "Unable to exchange external code" (server_error)

This means Supabase received the code from Microsoft but **could not exchange it for tokens**. Fix it on the server side:

1. **Azure client secret**
   - In **Supabase** → Authentication → Providers → **Azure**, the **Client Secret** must be the **Value** of the secret (from Azure → App registration → Certificates & secrets), not the Secret ID.
   - If the secret has **expired**, create a **New client secret** in Azure and paste the new **Value** into Supabase (then delete the old secret in Azure if you want).

2. **Redirect URI in Azure**
   - In Azure → your app → **Authentication** → Redirect URIs, you must have exactly (with your project ref):
     - `https://uhvmhzmxsvrkzqqesbli.supabase.co/auth/v1/callback`
   - Type must be **Web**, not SPA.

3. **IDs in Supabase**
   - In Supabase → Azure provider, double-check **Client ID** (Application ID from Azure) and **Azure Tenant ID** (Directory (tenant) ID). Wrong Tenant ID can cause exchange to fail for some account types.

---

## Katana Projects tables ("could not find table public.projects")

If **Create project** fails with an error like *could not find the table public.projects and the Schema cache*, the project management tables don’t exist yet.

1. In the Supabase dashboard, open **SQL Editor**.
2. Open the file **`supabase-projects-schema.sql`** in this repo (project root).
3. Copy its contents, paste into the SQL Editor, and click **Run**.
4. That creates `projects`, `tasks`, `milestones`, `team_members`, `project_files`, `activities`, `sprints`, and related tables, plus RLS policies so the app can read/write.
5. Try **Create project** again in the app.

If you already created the tables from an older version of the schema and want **Created by** / **Assigned to** on projects, run **`supabase-projects-ownership-migration.sql`** in the SQL Editor (it adds `created_by_name`, `created_by_avatar`, `owner_name`, `owner_avatar` to `projects`).
