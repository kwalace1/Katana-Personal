# Katana Agent Eval Harness

The training loop for the Agent Office. It drives real chats against the live
agents, scores each answer three ways, and reports per-agent and overall pass
rates so you can measure a prompt or model change instead of guessing.

This is how the agents get to "enterprise grade": you change a prompt or swap a
model, run the harness, and see exactly which capabilities improved or regressed
before it reaches a user.

## What it checks

Each golden case is scored by layers, cheapest first:

1. **Deterministic assertions** (`scorers.py`) — exact, free, and catch the
   failure classes that matter most here:
   - `no_leak` — no internal JSON / reflection metadata / empty code fences /
     control tokens / `[Error:]` in the answer.
   - `used_sql` — the agent actually queried live data.
   - `numeric_match` — the answer contains the **ground-truth number**.
   - `delegated_to` / `delegated_to_all` — the Hub routed to the correct
     specialist(s) (read from the execution log's `spawn_subagent` targets).
   - `refusal` — an honest "no data / handing off" (Facilities, empty modules).
   - plus `contains_any`, `not_contains`, `regex`, `no_delegation`.
2. **SQL ground truth** (`ground_truth.py`) — the expected number is computed at
   run time by calling the **same `ai_query` RPC with the same user JWT** the
   agent uses, so "expected" is scoped to exactly the org the agent sees. No
   hardcoded numbers to go stale.
3. **LLM rubric judge** (`judge.py`) — a *different, cheap* model
   (`google/gemini-2.5-flash-lite` via OpenRouter) grades the answer 0-100
   against a per-case rubric. Never the model under test, so it isn't self-grading.

A case passes only if it produced an answer **and** every deterministic assertion
passed **and** the judge score cleared the case's `min_score`.

## Setup

```bash
pip install -r requirements.txt
```

Config is read from the repo's `.env` / `.env.local`, plus these eval-specific
vars (put them in `.env.local`, which is gitignored):

| Var | Needed for | How to get it |
|-----|------------|---------------|
| `EVAL_KATANA_JWT` | driving chats + org-scoped ground truth | Your Katana session token — in the browser devtools console: `sessionStorage.getItem('sc_katana_jwt')` while signed in. Use a user in the org whose data you want to eval. |
| `OPENROUTER_API_KEY` | the LLM judge | already in `.env` |
| `VITE_SUPABASE_ANON_KEY` | ground truth | already in `.env` |
| `EVAL_TARGET` | optional | `proxy` (default) drives through the Vercel office proxy; `engine` drives the SwarmClaw engine directly (needs `EVAL_ENGINE_URL` + `EVAL_ENGINE_KEY`, no user identity so data cases won't be org-scoped). |
| `EVAL_OFFICE_BASE` | optional | defaults to `https://katana-vv2.vercel.app/api/office` |

Why a JWT? Chat endpoints are per-user isolated (see `api/office/[...path].ts`),
and org-scoped `ai_query` needs a real user identity to return that org's data.
A dedicated eval user works too — just make sure it's in the org you want to test.

## Running

```bash
python runner.py                       # every dataset
python runner.py --agent "Hub Agent"   # one agent
python runner.py --suite data          # only data cases (data|feature|routing|refusal)
python runner.py --limit 3             # first 3 cases per agent (quick smoke)
python runner.py --no-judge            # deterministic only (no OpenRouter spend)
python runner.py --dry-run             # validate datasets + ground truth, don't drive agents

# the before/after workflow around any change:
python runner.py --baseline            # snapshot current pass/fail as the baseline
#   ... change a prompt or model ...
python runner.py --gate                # exits 1 if any case that passed now fails
```

Results are written to `results/run-<timestamp>.json`; `--baseline` also writes
`results/baseline.json`. The `results/` dir is gitignored.

## Adding cases

Datasets are one YAML per agent in `datasets/`. A case:

```yaml
- id: inv-low-stock-count          # stable, unique; used by the gate
  type: data                       # data | feature | routing | refusal
  question: How many inventory items are at or below their reorder threshold?
  ground_truth_sql: select count(*)::int as n from ai_inventory_low_stock
  assert:
    - {check: used_sql}
    - {check: numeric_match, sql_field: n}
    - {check: no_leak}
  judge:
    rubric: States the number of low-stock items and leads with the count.
    min_score: 70
```

Enum values in questions/SQL must match the real DB `CHECK` constraints (e.g.
task status includes `blocked`, support status includes `in_progress`/`resolved`,
client status includes `at-risk`) — the harness deliberately exercises the values
the older agent prompts got wrong.

Flagged answers from the production observer (`agent_answer_audits`) are the best
source of new cases: when the observer catches a bad answer, turn it into a case
here so the fix is regression-tested forever.

## Cost

Tiny. A full 66-case sweep is one agent turn + one flash-lite judge call per case
≈ **$0.20**. Run it freely.
