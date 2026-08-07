# Soft launch checklist — Katana Personal

Use this before putting the app in front of 10–20 real busy people.

## Pre-flight

- [x] `npm run build` succeeds *(verified 2026-08-06)*
- [x] `npm run test:run` Ask engine + week stats *(verified 2026-08-06)*
- [ ] Supabase SQL migration applied (see `SUPABASE_SETUP.md`)
- [ ] Deploy web app (e.g. Vercel) with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] Test on a real phone: Add to Home Screen (PWA)
- [x] Landing → Open local space → Today loads *(browser smoke 2026-08-06)*
- [ ] Settings → Load demo day → Today shows “Do this next”
- [x] Capture: `Call Mom Friday 3pm` → confirm chip → undo works *(browser smoke 2026-08-06)*
- [x] Evening close appears after 5pm local *(browser smoke 2026-08-06)*
- [ ] Gentle reminders: enable, grant permission, see timed habit/event nudge while app is open

## Social (Together)

- [ ] Cloud sign-in → Friends → copy Add-me link + QR
- [ ] Second account accepts friend request (notifications realtime)
- [ ] Share a task → Shared detail → Copy into my tasks
- [ ] Habit check-in → Circles refresh shows updated streak (auto sync)
- [ ] Circle empty state teaches friend → prefs → create
- [x] Ask “Invite a friend” → Friends / Shared / Circles chips *(browser smoke 2026-08-06)*
- [x] Shared vs Circle Schedule copy taught in empty states *(shipped)*

## Honest limits (do not promise)

- Ask uses rules for actions; optional Gemini Flash via OpenRouter when `OPENROUTER_API_KEY` is set (see `.env.example`)
- Together Feed (text / photo / video / cards) needs Supabase schema + Storage — see [TOGETHER_FEED.md](./TOGETHER_FEED.md)
- No App Store build yet — Web/PWA only
- Push delivery not wired yet — in-app + open-tab reminders
- No collaborative editing — Shared is plans/accountability, not multiplayer docs
- Apple Sign In hidden unless `VITE_SUPABASE_APPLE_AUTH=true`

## Recently shipped (soft-launch build)

- Ask ↔ Together intents + suggested chips
- Today cheer toast + For-you Together cue; user-facing cloud copy
- Honest week aggregates on Weekly review + Ask
- Today secondary sections de-dashboarded
- Nutrition/Sleep/Notes/Documents polish + reminder honesty
- Circles Manage / Challenge / board UI extracted
- Stale SaaS docs banners; README + PERSONAL_NEXT_PLAN as source of truth

See [PERSONAL_NEXT_PLAN.md](./PERSONAL_NEXT_PLAN.md).

## Demo script (~5 min)

1. Landing → Start free (name only)
2. Today: capture + Do this next + Mark done
3. Ask: “What should I work on today?” → action chip; “Invite a friend” → Friends
4. Settings → Connect cloud → Friends invite link
5. Circles leaderboard story
6. Settings → Save a copy

## Still needs a human (phone + 2 accounts)

1. Deploy + publish Firestore rules  
2. Real phone PWA install  
3. Two cloud accounts through the Together path above  
4. Load demo day once in Settings on a clean workspace  
5. Reminders while the tab is open  

## Cut list (if something breaks the story)

Ship without: Documents depth, rich note editor, nutrition/sleep polish beyond current, Apple Sign In (email is enough), browser push VAPID.
