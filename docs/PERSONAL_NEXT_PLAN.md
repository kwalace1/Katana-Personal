# Katana Personal — Next plan (soft-launch build)

Soft-launch direction: deepen the calm daily OS and Together accountability, make the product prettier and more marketable — **without** a paid LLM.

**Source of truth for this product:** this file, [SOFT_LAUNCH_CHECKLIST.md](./SOFT_LAUNCH_CHECKLIST.md), and the root [README.md](../README.md). Ignore archived business SaaS docs (`SYSTEM_OVERVIEW.md`, `docs/ONBOARDING.md`, etc.).

## Bets in scope

| Bet | Focus | Out of scope |
|-----|--------|--------------|
| **A — Calm daily OS** | Today rituals, smarter Ask (rules only), weekly review | Generative AI / API keys |
| **B — Together** | Invite polish, empty states that teach, 7-day Circle challenges | Live collaborative editing |
| **Beauty / market** | Brand-first landing story, ritual screens, PWA/backup trust | New modules, App Store |

## Ship order (current build)

1. Loop glue — Ask ↔ Together intents; Today cheer + For-you chips; Shared vs Circle Schedule copy
2. Honest weekly review aggregates + Today secondary sections de-dashboarded
3. Thin-module polish (Nutrition/Sleep/Notes/Documents + reminder honesty)
4. Circles extract (Manage / Challenge / board UI) + Together QA path
5. Trust strip — gate Apple behind `VITE_FIREBASE_APPLE_AUTH`, Ask tests, green build
6. Soft-launch checklist on phone + two cloud accounts

## Honest limits (unchanged)

- Ask stays a day guide with actions — no LLM
- Shared = plans/accountability, not multiplayer docs
- Web/PWA only for now
- Reminders while Katana is open — not background push
- Apple Sign In optional (off unless `VITE_FIREBASE_APPLE_AUTH=true`)
