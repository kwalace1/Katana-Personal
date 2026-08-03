# Agent Training & Quality Loop

How the Katana Agent Office agents are made — and kept — enterprise grade:
measure, observe, fix, re-measure. This doc is the operator runbook. It covers
what was built, what you need to run, and the exact steps for each credential-
gated action.

## The system

| Piece | Where | What it does |
|-------|-------|--------------|
| **Eval harness** | `katana-agents/eval/` | Drives real chats against the live agents and scores each answer 3 ways: deterministic assertions, SQL ground truth (via `ai_query` + your JWT), and an LLM rubric judge on `gemini-2.5-flash-lite`. 66 golden cases across all 12 agents. |
| **Observer (inline)** | `src/lib/office/observer/` | On every delivered answer, computes deterministic flags (leaked JSON, empty, error, refusal) + tool signals (used SQL, delegated-to) on the client, zero latency. |
| **Observer (async)** | `supabase/functions/agent-observer` | Fire-and-forget after each answer: re-checks it and runs a cheap grounding screen on a *different* model, then writes a verdict to `agent_answer_audits`. |
| **Quality dashboard** | `/agents/quality` (owner/admin) | Per-agent flag rates, observer scores, and the flagged answers — which become new eval cases. |
| **Handoff fixer** | `katana-agents/overhaul/09_fix_handoffs.py` | Repairs the specialists' stale cross-module handoff tables. |

## Model choices (accuracy per dollar)

| Role | Model | Why |
|------|-------|-----|
| Hub (router) | **`google/gemini-2.5-pro`** (planned swap from `claude-sonnet-4.5`) | ~45% cheaper per turn than Sonnet 4.5; validate no routing/relay regression with the eval before/after. |
| 11 specialists | `google/gemini-2.5-flash` | Cheap, answers cleanly; the eval catches any regression. |
| Judge + observer | `google/gemini-2.5-flash-lite` | Cheapest capable; never the model under test. |

Full-system cost is tiny: the observer adds ≈ **$0.0003 per answer**, and a full
66-case eval sweep is ≈ **$0.20**.

---

## Operator runbook

### 0. Merge the security hotfix first (highest priority)

PR [#140](https://github.com/etomlinson-dev/katana-vv2/pull/140) hardens the
office proxy (auth gate + secret redaction). Merge it to deploy.

**Then rotate the two tokens that were publicly exposed** through
`/api/office/mcp-servers` (hardening stops *future* exposure; it does not
invalidate already-leaked keys):

1. **Supabase personal access token** (`sbp_…`): revoke at
   <https://supabase.com/dashboard/account/tokens>, create a new one.
2. **GitHub PAT** (`github_pat_…`): revoke at <https://github.com/settings/tokens>,
   create a new one with the same scopes.
3. **Update the engine's MCP configs** with the new tokens (the engine keeps
   querying with these). Against the engine directly (`$BASE` = engine `/api`,
   `$KEY` = engine access key):
   ```bash
   # supabase MCP server id = 2356baeb
   curl -s $BASE/mcp-servers/2356baeb -H "x-access-key: $KEY" > s.json
   # edit s.json: env.SUPABASE_ACCESS_TOKEN = <new sbp_ token>, then:
   curl -X PUT $BASE/mcp-servers/2356baeb -H "x-access-key: $KEY" \
        -H "Content-Type: application/json" --data-binary @s.json
   # repeat for the github MCP server's headers.Authorization
   ```

### 1. Set the observer's OpenRouter secret

The `agent-observer` function is deployed and records deterministic flags today;
its LLM grounding screen turns on once this secret is set:

```bash
supabase secrets set OPENROUTER_API_KEY=<key> --project-ref uhvmhzmxsvrkzqqesbli
# or: Dashboard -> Edge Functions -> agent-observer -> Secrets
```

The Quality dashboard at `/agents/quality` populates as people use the agents.

### 2. Baseline the current agents

```bash
cd katana-agents/eval
pip install -r requirements.txt
# put your session token in ../../.env.local:
#   EVAL_KATANA_JWT=<sessionStorage.getItem('sc_katana_jwt') from the browser>
python runner.py --baseline          # scores all 66 cases, saves the baseline
```

Read the per-agent pass rates. Cases that fail on **data** questions with the
right enum (e.g. `pm-blocked-tasks`, `support-in-progress`, `cs-at-risk-clients`)
pinpoint agents whose prompts still use stale enum values — fix those prompt
sections and re-run.

### 3. Fix the stale handoff tables

The specialists currently delegate to deleted Comms/Automation agents by dead
ids. Against the engine (`OFFICE_API_BASE` = engine `/api`, `OFFICE_ACCESS_KEY`
= engine key):

```bash
cd katana-agents/overhaul
OFFICE_API_BASE=https://katana-agents.fly.dev/api OFFICE_ACCESS_KEY=<key> \
  python 09_fix_handoffs.py --dry-run     # review the diff
OFFICE_API_BASE=... OFFICE_ACCESS_KEY=... \
  python 09_fix_handoffs.py               # apply
```

Then re-run the eval and `--gate` to confirm no regression.

### 4. Swap the Hub to Gemini 2.5 Pro (with before/after eval)

```bash
cd katana-agents/eval && python runner.py --agent "Hub Agent" --baseline   # Sonnet baseline
# swap the model on the engine (Hub id = 116c3cfa), full-object GET->modify->PUT:
curl -s $BASE/agents/116c3cfa -H "x-access-key: $KEY" > hub.json
#   set "model": "google/gemini-2.5-pro" in hub.json, then:
curl -X PUT $BASE/agents/116c3cfa -H "x-access-key: $KEY" \
     -H "Content-Type: application/json" --data-binary @hub.json
cd katana-agents/eval && python runner.py --agent "Hub Agent" --gate        # compare
```

If the gate flags a regression on routing or multi-module synthesis, revert the
model (PUT back `anthropic/claude-sonnet-4.5`) and keep Sonnet.

### 5. The ongoing loop

1. Watch `/agents/quality` for flagged answers.
2. Turn a flagged answer into a golden case in `katana-agents/eval/datasets/`.
3. Fix the prompt/model; run `python runner.py --gate`.
4. Never ship a change that regresses the baseline.

Once the eval set is large and scores plateau, the accumulated
question→correct-answer pairs are also a ready-made supervised fine-tuning
dataset for Gemini 2.5 Flash on Vertex AI — the natural next step if prompt-level
tuning tops out.
