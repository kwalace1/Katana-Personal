# Katana Personal — PDF Vision Roadmap

**Purpose:** Close the gap between what Katana Personal ships today and the product vision in *Katana Personal — Product Opportunity & Competitive Analysis* (the team PDF).

**Relationship to other docs**

| Doc | Role |
|-----|------|
| [POSITIONING.md](./POSITIONING.md) | What we say we are (already aligned with PDF) |
| [PERSONAL_NEXT_PLAN.md](./PERSONAL_NEXT_PLAN.md) | Soft-launch build (mostly done) |
| [SOFT_LAUNCH_CHECKLIST.md](./SOFT_LAUNCH_CHECKLIST.md) | Pre-launch QA |
| **This file** | Post–soft-launch plan to reach PDF orchestration vision |

**North star (from PDF):** Katana moves from **recording someone's life** to **actively coordinating it** — a calm intelligence layer that answers *What matters now?*

---

## Inventory: PDF vs today

| PDF priority | Today | Gap severity | Phase |
|--------------|-------|--------------|-------|
| Today + One Next Step | Loop shipped; priority waterfall only | **High** | 1 |
| Ask cross-domain intelligence | Snapshot + chips; not orchestration | **High** | 1–2 |
| Tasks + Calendar + Goals + Habits | Strong | Low | — |
| Core Health | Strong; import is file-only | Medium | 2 |
| Together + Circles | Strong | Low | — |
| Privacy architecture | Strong (local-first, opt-in cloud) | Low | — |
| Privacy transparency UI | Share prefs only | Medium | 3 |
| Integrations (external data) | Almost none | **Critical** | 2 |
| Tracking → orchestration | Mostly tracking | **High** | 1–2 |
| Proactive reach (push / native) | PWA; reminders while open | **High** | 4 |
| Behavioral moat (learn preferences) | None | Medium | 3 |
| Katana Plus monetization | Local unlock; no store billing | Medium | 4 |

---

## What we are **not** building (PDF “What to resist”)

Keep these out of scope unless strategy changes:

- Full document / Notion-style workspace
- Advanced social feed infrastructure (infinite scroll, discovery graph)
- Strava-grade GPS / segment ecosystem
- MyFitnessPal-scale nutrition database as the product
- Replacing specialist apps — **integrate and orchestrate** instead

---

## Phase 0 — Finish soft launch (prerequisite)

**Goal:** Ship what [SOFT_LAUNCH_CHECKLIST.md](./SOFT_LAUNCH_CHECKLIST.md) still marks open before layering orchestration.

| Item | Owner action |
|------|----------------|
| Deploy + env vars | Vercel + Supabase migration |
| Phone PWA smoke | Add to Home Screen on real device |
| Two-account Together path | Friends → Shared → Circles |
| Load demo day | Verify “Do this next” on clean workspace |
| Gentle reminders QA | Permission + in-tab nudge |

**Exit criteria:** Checklist human QA complete; `npm run build` + `npm run test:run` green.

---

## Phase 1 — Orchestration on native data (no new integrations)

**Goal:** One Next Step and Ask feel like coordination, not lists — using data already in IndexedDB.

**PDF quote:** *“You planned four workouts. You have 75 minutes tonight…”*

### 1A — Cross-domain One Next Step

**Problem:** `pickNextAction()` in `DashboardPage.tsx` only considers overdue tasks → soon events → priority tasks → habits. Workouts, sleep, goals, and free time are ignored.

**Build:**

1. **New module:** `src/lib/orchestration/next-step.ts`
   - Input: `LifeSnapshot` (reuse from `engine.ts`) + user workout plan (habit titled “gym”, goal-linked habits, or explicit weekly workout target in preferences)
   - Output: `{ kind, title, reason, estimatedMinutes?, actions[] }`
   - Ranking signals (rules, weighted):
     - Overdue / high-priority task (existing)
     - Event starting within 90 min (existing)
     - Planned workout behind weekly pace + calendar gap ≥ 45 min
     - Habit due today with streak at risk
     - Behind goal with target_date within horizon
     - “Stop for the night” when day closed or hour ≥ 21 and nothing urgent

2. **UI:** Replace bare title in “Do this next” with **one-line reason** (PDF-style):
   - *“You planned 4 workouts — 2 done. Next event 7:30 PM (~75 min free).”*

3. **Recalculate on completion:** After Mark done / Check in / Log workout, refresh next step immediately (already calls `refresh()` — wire to new picker).

4. **Tests:** `src/lib/orchestration/next-step.test.ts` — fixture snapshots for gym window, overdue wins, evening wind-down.

**Files to touch:** `DashboardPage.tsx`, new `orchestration/` lib, optional `today-layout` copy.

### 1B — Ask orchestration intents (rules-first)

**Problem:** Ask informs but doesn’t propose schedule changes or triage.

**Build:**

1. **New intents** in `engine.ts` (or split `engine-orchestration.ts`):
   - `what matters today` → triage: top 2 tasks + defer rest
   - `move my workout` / `when should I work out` → suggest slot + chip “Open calendar” / “Log workout”
   - `am I on track for [goal]` → progress vs target_date + one concrete next action
   - `these can wait` → park non-priority tasks (extend existing `park_tasks`)

2. **Orchestration copy style:** Short sentence + **why** + one chip (match PDF tone).

3. **Wire One Next Step ↔ Ask:** Same `pickNextStep()` used by Today hero and Ask “what’s next” intent — single source of truth.

**Exit criteria:**

- Demo path: user with 2/4 workouts done, gap before 7:30 event → Today shows gym as next step with reason line.
- Ask “what should I focus on today?” returns ≤2 priorities + defer language, not full task dump.
- No LLM required for above (rules only).

---

## Phase 2 — Integrations (PDF: “essential”)

**Goal:** Stop making the user the integration layer. Katana reads external calendars and health; writes back only when user confirms.

**Priority order (ROI vs effort):**

| # | Integration | Reads | Writes | Notes |
|---|-------------|-------|--------|-------|
| 1 | **Google Calendar** | Events | Optional: create event from capture | OAuth; sync into local `events` with `source: 'google'` |
| 2 | **Apple Calendar (.ics URL / CalDAV)** | Events | — | Lighter than full HealthKit; good for iOS users |
| 3 | **Apple Health (HealthKit)** | Sleep, workouts, weight | — | Requires native shell or iOS wrapper — **blocked on Phase 4** for live sync; until then improve `.xml` import + scheduled re-import reminder |
| 4 | **Fitbit API** | Sleep, activity | — | OAuth; complements file import |
| 5 | **Strava / MFP** | Activity / nutrition | — | Read-only; **Plus tier** candidate |

### 2A — Integration architecture

**New:**

- `src/lib/integrations/types.ts` — connector interface: `pull()`, `lastSyncAt`, `status`
- `src/lib/integrations/google-calendar.ts` — first connector
- Settings → **Connections** section: connect / disconnect / last sync / what data flows
- Server: `api/integrations/google-oauth.ts` (token exchange; store refresh token encrypted in Supabase **only if user opts into cloud sync**, else session-only for web)

**Rules:**

- Imported events merge into local IndexedDB (local-first unchanged).
- De-dupe by external id + `source`.
- Orchestration reads merged calendar, not siloed copy.

### 2B — Health import upgrade (pre-native)

Until HealthKit ships:

- Sleep panel: “Last imported {date}” + nudge to re-import weekly
- Optional: parse more Apple Health export fields (steps, workouts) into existing health APIs
- Document honest limits in UI (already partially there in `SleepPanel.tsx`)

**Exit criteria:**

- Google Calendar connected → today’s events include external meetings → One Next Step respects real schedule.
- Settings Connections shows what’s linked and last sync time.

---

## Phase 3 — Trust, learning, and goal plans

**Goal:** Privacy story and long-horizon goals match PDF moat language.

### 3A — Privacy transparency UI

**PDF:** *“Users must know exactly what leaves their device and why.”*

**Build:** Settings → **Privacy & data**

| Section | Content |
|---------|---------|
| On this device | IndexedDB collections list (tasks, journal, …) |
| Leaves device (if enabled) | Cloud sync fields, Together share prefs, LLM Ask (when used) |
| Integrations | Per-connector: what’s read, stored locally, never uploaded |
| Export | Link to Save a copy |

Reuse `DEFAULT_SHARE_PREFS` and cloud sync docs; no new backend required for v1.

### 3B — Behavioral preference layer (lightweight moat)

**PDF:** *“Which recommendations they accept. Which they ignore.”*

**Build:**

- `src/lib/orchestration/feedback.ts` — log anonymous events locally: `next_step_shown`, `next_step_completed`, `next_step_dismissed`, `ask_action_taken`
- Weekly roll-up in preferences: weights for task vs workout vs habit (simple counts, no ML v1)
- Feed weights into `pickNextStep()` as tie-breakers

**Privacy:** Never leave device unless user exports backup.

### 3C — Goal → plan (Ask + rules)

**PDF:** *“I want to lose 10 pounds by December” → plan around actual life.*

**Build (v1 rules, v2 LLM):**

1. Goal with `target_date` + category (fitness / health / other)
2. Ask intent parses weight/fitness goals → generates:
   - Weekly workout habit suggestion (or link existing)
   - Check-in reminder on weekly review
   - Progress chip on Today when behind pace
3. **Plus / LLM (v2):** multi-step plan draft user confirms (tasks + habits + calendar blocks)

**Exit criteria:**

- User can see Privacy & data page and articulate what syncs.
- Next-step picks shift after 2 weeks of ignored workout suggestions (local feedback).

---

## Phase 4 — Proactive reach & monetization

**Goal:** Katana reaches the user at the right moment; Plus attaches to real value.

**PDF:** *“That interaction is fundamentally different from expecting the user to remember to open Katana.”*

### 4A — Web push (PWA)

- Wire existing `VITE_VAPID_PUBLIC_KEY` + service worker
- Notification types: habit reminder, event soon, orchestration nudge (“80 min before next event — workout?”)
- Respect day closed + quiet hours in preferences
- **Honest copy:** requires installed PWA + permission

### 4B — Native mobile (milestone, not day one)

Options (decide once push proves value):

| Approach | Pros | Cons |
|----------|------|------|
| Capacitor wrapper | Reuse React app | HealthKit via plugins |
| React Native / Expo | Best native UX | Larger rewrite |
| Store PWA (iOS 17.4+) | Minimal new code | Limited background |

HealthKit live sync **depends** on this phase.

### 4C — Katana Plus billing

- Attach Plus to: unlimited LLM Ask, Circle challenges (existing), meal AI (existing), **advanced integrations** (Google/Fitbit), **proactive orchestration nudges**
- StoreKit / Play Billing or RevenueCat when native ships; Stripe for web-only interim if needed

**Exit criteria:**

- PWA push delivers one orchestration nudge end-to-end on test device.
- Plus feature matrix documented in Settings.

---

## Suggested ship order (summary)

```
Phase 0  ──► Soft launch QA complete
     │
Phase 1  ──► Cross-domain One Next Step + Ask orchestration (rules)
     │         └─ Highest product feel per engineering week
Phase 2  ──► Google Calendar (+ improved health import)
     │         └─ Unblocks real-day accuracy for orchestration
Phase 3  ──► Privacy UI + feedback loop + goal plans
     │
Phase 4  ──► Push → native → billing
```

**Recommended first sprint after Phase 0:** Phase **1A + 1B** — no OAuth, no App Store, immediately matches PDF “One Next Step” story on demo data + real local users.

---

## Success metrics (PDF-aligned)

| Metric | Meaning |
|--------|---------|
| **Time-to-first-action** | Open → complete one next step (target < 60s, onboarding excluded) |
| **Next-step completion rate** | % of shown next steps acted on within 2h |
| **Ask action rate** | Chips tapped / Ask sessions |
| **Integration adoption** | % of WAU with ≥1 external connector |
| **Day close rate** | Evening close completed / eligible days |
| **Together opt-in** | Friends or Circles connected (optional social) |

Do **not** optimize time-in-app — PDF explicitly rejects that.

---

## Engineering conventions

- Orchestration logic lives in `src/lib/orchestration/` — **not** scattered in page components.
- Today and Ask **must** call the same picker (`pickNextStep`).
- All new orchestration behavior gets Vitest coverage before merge.
- Run `npm run build` before push (per `.cursorrules`).
- Feature flags: `preferences.orchestrationEnabled` default `true` after Phase 1 stable.

---

## Open decisions (team)

Record choices here as they’re made:

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | First integration | Google Calendar vs Apple .ics | _TBD_ |
| 2 | Workout plan source | Habit named “gym” vs explicit weekly target in settings | _TBD_ |
| 3 | LLM in free orchestration | Rules only vs 3/day LLM for plan questions | _TBD_ |
| 4 | Native path | Capacitor vs Expo vs PWA-only + push | _TBD_ |
| 5 | Google OAuth token storage | Cloud-only vs local encrypted | _TBD_ |

---

## File map (planned)

| Area | New / primary files |
|------|---------------------|
| One Next Step | `src/lib/orchestration/next-step.ts`, tests |
| Ask orchestration | `src/modules/assistant/engine-orchestration.ts` or extend `engine.ts` |
| Integrations | `src/lib/integrations/*`, `api/integrations/*`, Settings Connections UI |
| Privacy UI | `src/modules/settings/components/PrivacyDataPanel.tsx` |
| Feedback | `src/lib/orchestration/feedback.ts` |
| Push | `src/lib/notifications/push.ts`, service worker updates |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-29 | Initial roadmap from PDF gap analysis |
| 2026-08-29 | Phase 1 shipped — orchestration next-step + Ask intents |
| 2026-08-29 | Phase 2 shipped — Google Calendar OAuth, ICS feeds, Connections UI, health import upgrade |
| 2026-08-29 | Phase 3 shipped — Privacy & data UI, local feedback weights, goal-plan Ask |
| 2026-08-29 | Phase 4 shipped — Web push + orchestration nudges, Plus matrix + Stripe stub, native milestone doc |
