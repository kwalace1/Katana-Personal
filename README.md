# Katana Personal

**Calm daily OS:** Plan the day. Do the next thing. Share your wins.

Not another list app. Not a water tracker. See [docs/POSITIONING.md](./docs/POSITIONING.md).

## The loop

- **Today** — one next step, capture, evening close, weekly review  
- **Ask** — day guide that knows your plate and can draft actions  
- **Together** (optional) — Feed, friends, shared plans, Circles; only what you choose to share  

Plan / Life (tasks, habits, health, notes…) are depth when you need them — not the home story.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3001 — on a phone, Add to Home Screen for an app-like feel.

**Native iOS (Capacitor):** see [docs/NATIVE_MOBILE.md](./docs/NATIVE_MOBILE.md). On a Mac: `npm run build:ios` then `npx cap open ios` (Simulator works before Apple Developer enrollment; TestFlight needs approval).

## Soft launch

See [docs/SOFT_LAUNCH_CHECKLIST.md](./docs/SOFT_LAUNCH_CHECKLIST.md). Ask + Gemini via OpenRouter: [docs/GEMINI_ASK.md](./docs/GEMINI_ASK.md). Demo data: Settings → Load demo day.

Supabase (optional social): [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — run the SQL migration, then set `VITE_SUPABASE_*` env vars.

## Docs note

This repo is **Katana Personal** (local-first life OS). Files like `SYSTEM_OVERVIEW.md` and `docs/ONBOARDING.md` describe an archived business SaaS — do not use them for Personal work.

## Keep a copy

Settings → **Save a copy** / **Bring a copy back** so a cleared browser doesn’t lose your space.
