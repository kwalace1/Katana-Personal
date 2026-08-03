# Environment variables

Copy `.env.example` to `.env` and fill in values. All client-side variables must be prefixed with `VITE_` so Vite exposes them to the app.

## Required for auth and core features

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://your-project-ref.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key | From Supabase → Settings → API |

- **Where to get:** [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **API** (Project URL and anon public key).
- **Setup:** See [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) for Microsoft sign-in and auth configuration.
- If these are missing or placeholder, the app runs with auth disabled (no sign-in, no protected data).

---

## Optional: Email (demo requests, project invites)

| Variable | Description | Required for |
|----------|-------------|----------------|
| `VITE_EMAILJS_SERVICE_ID` | EmailJS service ID | Demo request emails, project invites (if no invite-specific vars) |
| `VITE_EMAILJS_TEMPLATE_ID` | EmailJS template ID | Same as above |
| `VITE_EMAILJS_PUBLIC_KEY` | EmailJS public key | Same as above |
| `VITE_EMAILJS_INVITE_SERVICE_ID` | Optional separate service for invites | Project invite emails (prefer a service tied to your domain) |
| `VITE_EMAILJS_INVITE_TEMPLATE_ID` | Optional invite template | Project invite emails |

- **Where to get:** [EmailJS](https://www.emailjs.com/). See [EMAILJS_SETUP.md](./EMAILJS_SETUP.md).
- If unset, demo/invite actions may no-op or show a message that email is not configured.

---

## Optional: Pilot module access

| Variable | Description |
|----------|-------------|
| `VITE_PILOT_MODULES` | Comma-separated module IDs (e.g. `hub,projects,employee,careers,hr`). When set, **member** users only see modules in this list (intersected with their HR `module_access`). Owners and admins are not limited. Members with `hr` see self-service HR; add the `hr-admin` permission in HR (not a sidebar module) to delegate full HR management. |

- Leave unset for full production behavior (no pilot cap).
- Restart the dev server after changing `.env`.

---

## Optional: development / build

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set by Vite: `development` or `production`. Do not set in `.env` for normal runs. |
| `DEV` | Vite sets `import.meta.env.DEV`; used in code for dev-only behavior (e.g. geolocation fallbacks). |

---

## Checklist

1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for auth and Supabase-backed modules (HR, Projects, Inventory, WFM, Recruitment, Customer Success).
3. (Optional) Configure EmailJS variables for demo and invite emails.
4. Restart the dev server after changing `.env` (`npm run dev` or `pnpm dev`).
