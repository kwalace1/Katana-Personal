# Soft launch checklist — Katana Personal

Use this before putting the app in front of 10–20 real busy people.

## Pre-flight

- [ ] `npm run build` succeeds
- [ ] Firebase rules published from `firestore.rules`
- [ ] Deploy web app (e.g. Vercel) with Firebase env vars
- [ ] Test on a real phone: Add to Home Screen (PWA)
- [ ] Settings → Load demo day → Today shows “Do this next”
- [ ] Capture: `Call Mom Friday 3pm` → confirm chip → undo works
- [ ] Evening close appears after 5pm local
- [ ] Gentle reminders: enable, grant permission, see timed habit/event nudge while app is open

## Social (Together)

- [ ] Cloud sign-in → Friends → copy Add-me link + QR
- [ ] Second account accepts friend request (notifications realtime)
- [ ] Share a task → Shared detail → Copy into my tasks
- [ ] Habit check-in → Circles refresh shows updated streak (auto sync)
- [ ] Circle empty state teaches friend → prefs → create

## Honest limits (do not promise)

- No paid LLM yet — Ask is a day guide with actions
- No App Store build yet — Web/PWA only
- No FCM background push on Spark — in-app + open-tab reminders
- No collaborative editing — Shared is plans/accountability, not multiplayer docs

## Demo script (~5 min)

1. Landing → Start free (name only)
2. Today: capture + Do this next + Mark done
3. Ask: “What should I work on today?” → action chip
4. Settings → Connect cloud → Friends invite link
5. Circles leaderboard story
6. Settings → Save a copy

## Cut list (if something breaks the story)

Ship without: Documents depth, rich note editor, nutrition/sleep polish, Apple Sign In (email is enough), browser push VAPID.
