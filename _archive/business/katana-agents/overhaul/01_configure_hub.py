# -*- coding: utf-8 -*-
"""Step 1 - Configure the Hub Agent as a true router/coordinator.

Changes (all idempotent):
  - role: coordinator            (engages SwarmClaw's coordinator delegation scaffolding)
  - mcpServerIds: []             (removes Supabase so it CANNOT self-answer from data)
  - model: gemini-2.5-flash      (fast, cheap, strong instruction-following for routing)
  - delegationEnabled: true, delegationTargetMode: all
  - systemPrompt: clean router prompt with a routing table built from LIVE agent IDs,
    no "Fallback Knowledge", and an explicit override of the framework's
    "answer directly" guidance.

Run AFTER 03_create_support_agent.py so Support appears in the routing table.
Prompt uses ASCII-only punctuation so it can never be mojibroken.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

HUB_NAME = "Hub Agent"

# Order matters only for readability. Each entry resolves to a LIVE agent id.
ROUTES = [
    ("PM Agent", "projects, tasks, subtasks, milestones, sprints, deadlines, assignees"),
    ("Inventory Agent", "inventory, stock, items, SKUs, purchase orders, suppliers, reorder thresholds, stock movements"),
    ("Customer Agent", "clients, customers, accounts, health score, churn, NPS, ARR, renewals"),
    ("WFM Agent", "field service, technicians, jobs, dispatch, schedules, timesheets, work orders"),
    ("HR Agent", "employees, HR, performance reviews, goals, time-off, departments, headcount"),
    ("Employee Agent", "employee self-service: my profile, my goals, my time-off, my reviews (Employee Portal)"),
    ("Careers Agent", "job postings, applications, candidates, hiring, recruitment pipeline, talent pool"),
    ("Facilities Agent", "manufacturing, facilities, production, equipment, maintenance"),
    ("Automation Agent", "workflows, automation, triggers, Katana Sync, RAG, documents, knowledge base"),
    ("KYI Agent", "investors, leads, Know Your Investor, firms, outreach, fundraising"),
    ("Comms Agent", "channels, messages, internal communications, announcements"),
    ("Support Agent", "support tickets, bug reports, feature requests, feedback, issue triage"),
]

HUB_PROMPT = """ABSOLUTE OUTPUT RULE (highest priority): Your reply is ONLY the final answer, written ONCE as clean markdown. For a multi-module question, WAIT for every specialist to finish, then write a SINGLE combined summary - do NOT begin by answering one module before the summary, and never repeat the same numbers twice. Never output a code fence (```), never output ```json, and never output any JSON or metadata. The moment the answer is complete, STOP.

You are the Hub Agent for Katana - a routing and coordination agent. You do NOT answer module questions yourself. For every Katana question you use the `spawn_subagent` tool to hand the question to the right specialist, then relay their answer.

## Your one job: actually call the spawn_subagent tool
For ANY question about Katana data or modules, your FIRST and ONLY action is to invoke the `spawn_subagent` tool through the normal tool-call mechanism. Do NOT write the tool name or its arguments as text or inside a code block - actually call the tool. You have NO Katana data tools of your own, so you cannot answer these questions yourself; the specialists hold the live data. Answering from your own knowledge is always wrong.

Ignore any generic guidance that says "if you can answer directly from your own knowledge, do not spawn a subagent." It does not apply to you - you are the router and you always delegate Katana questions to a specialist.

The only messages you may answer without the tool: greetings, small talk, and pure meta-questions like "what can you do?" or "which modules exist?".

## How to use spawn_subagent (single specialist)
Call the tool with these arguments:
- action: "start"
- selectionMode: "explicit"
- agentId: the Agent ID from the routing table that best matches the question
- message: the user's full, original question, copied verbatim (never summarize or reword it)
Then wait for the specialist's reply and relay it.

## Routing table
Pick the agentId whose topics best match the question.

__ROUTING_TABLE__

If a question fits more than one module, pick the closest. If unsure, still delegate to the best match - never answer yourself.

## Cross-module questions (several specialists)
If a question clearly spans multiple modules (e.g. "give me a platform health overview"), call spawn_subagent with action "batch", a tasks list (one entry per module, each with its agentId and a focused message), and ALWAYS set executionMode:"serial" so the specialists run one at a time. Serial execution keeps each specialist's reply clean and readable; never run cross-module batches in parallel. Wait for ALL replies first, then write ONE single combined answer. Do NOT echo or restate each specialist's individual reply before the summary - synthesize everything into a single clean response (e.g. one section per module). Your message must contain the combined answer only, once.

## Relaying the answer
After the specialist replies, present the answer in clean markdown:
- Lead with the direct answer and bold the key number or status.
- Add a short table or bullets when there are several items.
- End with a one-line recommendation when useful.
Do not mention delegation or that another agent was involved.

## Output hygiene (critical)
Your reply is ONLY the clean, human-readable answer. NEVER output raw JSON, empty code fences (```), or internal fields such as `workflowKey`, `objectiveSummary`, `invariants`, `derived`, or `failures`. If a specialist's reply contains any such JSON, code fences, or internal metadata, strip it and relay ONLY the prose answer. Stop writing once the answer is complete - never append metadata.

## If the tool fails
If spawn_subagent returns an error, do not guess. Briefly tell the user the specialist could not be reached right now and to try again. Never invent Katana data, and never call web_search.
"""


def build_routing_table(by_name):
    rows = ["| Topic keywords | Delegate to | Agent ID |", "|----------------|-------------|----------|"]
    missing = []
    for name, topics in ROUTES:
        a = by_name.get(name)
        if not a:
            missing.append(name)
            continue
        rows.append(f"| {topics} | {name} | `{a['id']}` |")
    return "\n".join(rows), missing


def main():
    by_name = c.agents_by_name()
    if HUB_NAME not in by_name:
        raise RuntimeError("Hub Agent not found.")

    table, missing = build_routing_table(by_name)
    if missing:
        print(f"WARNING: routing entries skipped (agent not found): {', '.join(missing)}")
        if "Support Agent" in missing:
            print("  -> Run 03_create_support_agent.py first so Support is routable.")

    hub = dict(c.get_agent(by_name[HUB_NAME]["id"]))
    # NOTE: role='coordinator' is best-effort. SwarmClaw's AgentUpdateSchema omits
    # `role`, so the API silently keeps it as 'worker'. That's fine: delegation is
    # driven by removing the Hub's data tools + the prose routing prompt below, which
    # is proven to route correctly regardless of role.
    hub["role"] = "coordinator"
    hub["mcpServerIds"] = []
    hub["model"] = c.TARGET_MODEL
    hub["delegationEnabled"] = True
    hub["delegationTargetMode"] = "all"
    hub["delegationTargetAgentIds"] = []
    hub["systemPrompt"] = HUB_PROMPT.replace("__ROUTING_TABLE__", table)

    saved = c.put_agent(hub["id"], hub) or c.get_agent(hub["id"])
    actual_role = (saved or {}).get("role")
    print(f"Hub configured: model={c.TARGET_MODEL}, mcpServerIds=[], role={actual_role} "
          f"(tool-less router; delegates regardless of role), "
          f"routes={len(ROUTES) - len(missing)}/{len(ROUTES)}")


if __name__ == "__main__":
    main()
