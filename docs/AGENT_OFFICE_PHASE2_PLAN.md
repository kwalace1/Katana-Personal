# Katana Agent Office — Phase 2: The Agentic Plan

**Prepared:** 2026-07-13
**Scope:** SwarmClaw engine + Katana app + Supabase
**Status:** Phase 1 (Q&A) complete → planning Phase 2 (agentic)

> Phase 1 taught the agents to answer. Phase 2 lets them *act* — create, update, and
> adjust real records across the system, safely, with a human in the loop and a full
> audit trail behind every write.

---

## The bottom line, up front

- **Effort — mostly wiring, not a rebuild.** The hardest part of a safe agentic system,
  a durable human-approval loop with pause/resume, *already exists* in both the engine and
  the Katana client. You're extending a working spine, not laying a new one.
- **One blocker.** Before agents write anything, the database's write permissions must be
  made tenant-safe. Writes go through a small set of allowlisted, org-stamping functions —
  never a generic "let the agent run SQL" tool.
- **Cost.** Yes, it costs more, but modestly, and mostly as *safety infrastructure, not
  compute*: roughly **+$10–30/month** fixed for the core (a bigger engine VM + Vercel Pro),
  plus per-action token cost that stays in the cents. Supabase Pro is *deferrable* — you
  already run daily backups — and finer-grained recovery (PITR) is a later add-on, not a
  day-one cost. See §7 for the honest breakdown.

---

## 1 — What you already have

Five of the six pieces an enterprise agentic system needs are already in the stack, built
during the SwarmClaw era and the phase-1 work.

| Layer | Asset | Where |
|---|---|---|
| Engine | **A real approval loop** — request → pending → decide → durably resume the paused run, with activity logging and watch-jobs | `approvals.ts` · `requestApproval()` / `submitDecision()` |
| Engine | **Human-in-the-loop tool** — agents can pause a run mid-task and wait durably for a decision, then continue | `human-loop.ts` · `ask_human` (`request_approval` / `wait_for_approval`) |
| Client | **Approval-card store** — renders pending approvals, posts the decision, handles timeouts + multi-tab conflicts | `use-approval-store.ts` → `/openclaw/approvals` |
| Engine | **A clean tool-injection slot** — where phase-1's read tool is added is where a write-action toolset drops in, same gating | `session-tools/index.ts` · `KATANA_RLS_ENABLED` gate |
| Database | **The read-safety template** — the read-only RPC that made phase 1 tenant-safe is the exact pattern to invert for writes | `ai_query(q)` · `security invoker` |
| Quality | **Eval + observer loop** — 66-case harness with a regression gate, plus the answer-audit observer and the `/agents/quality` dashboard | `katana-agents/eval` · `agent-observer` · `QualityView` |

---

## 2 — Fix this first: write-isolation ⚠️

**Your base tables can't be trusted to enforce tenant boundaries on writes.**

Phase 1 was safe because the `ai_*` *views* were explicitly scoped to the caller's
organization. The underlying *base tables* have no such guarantee. Auditing every write
policy across the schema:

| Count | Shape | Meaning |
|---:|---|---|
| **27** | `using(true) with check(true)` | Fully open — any signed-in user can write any org's rows |
| **~64** | `auth.uid()`-based | Partial, inconsistent protection |
| **3** | organization-scoped | Truly tenant-safe (Finance only) |

**Consequence:** a generic "agent runs SQL to write" tool would be a cross-tenant write
hole — a single jailbroken or confused agent could mutate another customer's data. So the
security kernel for phase 2 is **not** a flexible write tool; it's a curated set of narrow,
org-stamping action functions. This constraint is also exactly what an enterprise security
review wants to see.

---

## 3 — Architecture: the action layer

Three thin layers over what you already run. Each write action is defined once in the
database, exposed as a typed tool to the agent, and gated by the approval loop before it
executes.

### 1. Action registry (Postgres)

Instead of one write tool, define a small library of `ai_act_<domain>_<verb>` functions —
`ai_act_pm_create_task`, `ai_act_pm_set_task_status`, `ai_act_inventory_adjust_stock`, etc.
Each one:

- is `security invoker` (runs as the signed-in user),
- resolves the caller's org from their JWT,
- **stamps and re-checks `organization_id` on every row it touches**,
- performs exactly one well-defined mutation,
- returns the before/after snapshot.

Add an append-only `agent_action_audits` table (owner/admin read via RLS, service-role
write) recording: who, which agent, which action, the payload, before/after, the approval
id, and the outcome.

### 2. Action tool (engine)

A new `katana-actions.ts` session-tool builder mirrors `katana-data.ts` and is injected at
the same guarded slot. It exposes the allowlisted actions as typed tools (rich schemas the
models handle well). Any action marked risky calls the existing `requestApproval()` →
`wait_for_approval` before touching the database — the run pauses and resumes on the decision.

### 3. Approval + audit surface (Katana)

Generalize the existing `PendingExecApproval` card from "shell command" to "proposed
action," render it inline in chat from the approval store, and add an **Actions** tab to
`/agents/quality` that reads `agent_action_audits` for a live, exportable trail.

### The loop

```
Agent proposes ──▶ Human decides ──▶ Execute ──▶ Audit ──▶ Confirm
(typed action)     (inline card)     (org-stamped  (before/     to user
     ▲                  │             RPC)          after row)
     └──── deny ────────┘
           revise
```

Tenant isolation carries over unchanged from phase 1: the agent acts *as the signed-in
user*, and the action function re-checks the org on every row — a jailbroken prompt still
can't escape the caller's tenant.

---

## 4 — Graduated autonomy

Trust is earned per action type, not granted wholesale. A per-org policy sets the level;
the action tool enforces it. Ship left-to-right.

| Level | Name | Behavior |
|---|---|---|
| **0** | Propose-only | The agent describes exactly what it would do and never executes. Zero risk — the ideal first ship, and the way to validate proposals are correct before any write goes live. |
| **1** | Approve-each | The agent proposes, a human approves each action in the card, then it executes and audits. The enterprise default — every mutation has a named human behind it. |
| **2** | Auto-approve allowlist | Specific low-risk actions (e.g. "add a comment," "move a task to In Progress") auto-run per an owner-configured policy; everything else still needs approval. Introduced only after Level 1 has a track record. |

---

## 5 — Rollout: one module at a time

Each increment is independently shippable and independently valuable. Prove the entire loop
on one module before widening; never turn on more surface than the audit trail and evals
cover.

### Phase 2.0 — Foundation *(~1–2 weeks)*

Stand up the machinery with zero live writes.

- Create `agent_action_audits` + the action-registry pattern; write the first 2–3
  `ai_act_pm_*` functions
- Add `katana-actions.ts` to the engine at Level 0 (propose-only)
- Generalize the approval card from "command" to "action"
- **Ship:** the PM agent proposes task actions in chat — nothing executes yet

### Phase 2.1 — Close the loop on one module *(~1 week)*

Turn on Level 1 for PM only, end to end.

- Wire `requestApproval` → card → execute → audit for PM writes
- Verify pause/resume survives the Vercel-edge-proxy → Fly-engine path
- **Ship:** "create a task for the Q3 launch and assign it to Sam" actually works, with an
  approval and an audit row

### Phase 2.2 — Widen the surface *(~1 week / module)*

Repeat the proven pattern module by module, each with its own RPCs and eval cases.

- Inventory (adjust stock), CRM (client note / status), Support (ticket status), Comms
  (post message), Careers (open posting)
- Each module = a small PR: new `ai_act_*` functions + tool entries + golden eval cases

### Phase 2.3 — Enterprise controls *(~1–2 weeks)*

The pieces a buyer's security review asks for.

- Level 2 allowlist + per-org autonomy policy UI (owner/admin)
- Audit export (CSV/JSON) from the Actions tab; retention policy
- RBAC on who can configure autonomy vs. who can act

### Phase 2.4 — Background agents *(optional, later)*

Move from reactive to proactive using the engine's existing schedules/tasks subsystems.

- Scheduled recurring ops (e.g. nightly "flag stale support tickets and propose a nudge")
- Still routed through approval + audit — background ≠ unsupervised

---

## 6 — Extending the quality loop

Phase 1's eval + observer infrastructure grades *answers*. Actions need a parallel it
doesn't have yet — verifying an action was proposed, executed, and had the right effect.

- **Eval harness:** add assertion types `action_proposed`, `action_executed`, and
  `db_state_verified` — the last re-reads state via the same `ai_query` path to confirm the
  write actually landed. Provision a throwaway sandbox org so destructive test cases can run
  and roll back.
- **Observer:** new flags `unapproved_action` (a write with no matching approval),
  `action_failed`, and `cross_scope_action`. These feed the same `agent_answer_audits`
  pipeline and dashboard you already run.

**One thing to revisit:** engine reflection / learned-skills is currently *disabled*
because it leaked internal JSON into phase-1 answers. Those are genuine autonomy features —
reconsider re-enabling them (carefully, behind the sanitizer) once the agents are doing
multi-step work.

---

## 7 — Will it cost more?

A little — and less than the first draft of this plan implied. The step-change isn't
compute. Two things are genuinely needed to go live (a bigger engine VM, and Vercel Pro for
commercial use); the database upgrade is real but *deferrable*, because you already run
daily backups.

| Line item | Today | Phase 2 | Why it changes |
|---|---|---|---|
| **Fly.io engine** | 512 MB ≈ $3–4/mo | 1–2 GB ≈ $6–15/mo | Multi-step agentic runs are heavier and more concurrent; the 512 MB VM already returns sporadic 400s under load. **Needed for live writes.** |
| **Vercel** | Hobby | Pro ≈ $20/mo | Not phase-2-specific, but Hobby prohibits commercial use — needed the moment you sell to a real customer. |
| **Supabase** | Free + daily `pg_dump` | Pro ≈ $25/mo *(deferrable)* | You **already have daily backups** (`db-backup.yml`, 08:00 UTC, 30-day retention). Pro's real adds for an agentic system are **7-day log retention** (Free keeps ~1 day — you'll want more to reconstruct "what did the agent do") and higher connection/compute limits. **Skip it through Phase 2.0; add when live writes ship.** |
| **Point-in-time recovery** | — | Pro add-on ≈ $100/mo *(later)* | Not included in base Pro. Fixes the one real gap your daily dump leaves: a bad write at 23:00 means restoring the 08:00 snapshot loses ~15h of everyone's legitimate work. Buy this only when a customer's data genuinely depends on second-level recovery. |
| **Model tokens** | ~cents / Q&A | 2–4× / action | Propose → approve → execute → confirm is a multi-step loop. On gemini-flash + haiku it's still cents per action (~low tens of $/mo at ~1,000 actions). |
| **Model upgrades** | — | test first | Risky-write specialists may need haiku/sonnet over gemini-flash for reliability. Measure with the eval harness before upgrading. |

**To ship live writes: ≈ +$10–30/month** (bigger Fly VM + Vercel Pro), plus per-action
tokens (cents). **Supabase Pro (+$25)** when writes go live; **PITR (+~$100)** only once
real customer data is at stake. So the "enterprise-grade" ceiling is ~$150/mo, but you reach
it in steps, not on day one.

> **Verify before committing.** Vercel Pro $20 and Supabase Pro $25 are stable and current;
> PITR add-on pricing has changed over time — confirm the current rate. Fly VM prices and
> OpenRouter token rates are from working notes ~2 weeks old (the live price-verification
> pass was cut off by an account session limit). Re-check Fly + OpenRouter before locking
> the budget.

---

## 8 — The first three moves

1. **Decide the security kernel.** Confirm the allowlisted-action-RPC approach (recommended)
   over hardening ~90 base-table write policies. This is the one decision everything else
   hangs on.
2. **Build the foundation (Phase 2.0).** The audit table, the first three `ai_act_pm_*`
   functions, and the propose-only tool — no live writes, fully reversible, provable in the
   eval harness.
3. **Nothing on the infra bill yet.** Phase 2.0 is propose-only — no live writes, so no new
   spend. When you flip on live writes (Phase 2.1), add the bigger Fly VM and turn on
   Supabase Pro for log retention; add PITR only once a customer's data is genuinely at
   stake.

---

*Prepared from direct review of the engine (`swarmclaw`), the Katana app (`katana-vv2`),
and the eval/observer tooling. A deeper adversarial design-panel pass (three competing
architectures + a security red-team) was queued but blocked by an account session limit —
available on request.*
