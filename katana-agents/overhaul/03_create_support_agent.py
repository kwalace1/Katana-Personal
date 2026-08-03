# -*- coding: utf-8 -*-
"""Step 3 — Create (or update) the Support Agent, the 13th Katana agent.

Idempotent: if a "Support Agent" already exists it is updated in place; otherwise
one is created by cloning an existing specialist (to inherit the OpenRouter
credential / provider wiring) and overriding the identity + Support config.
Also ensures the agent is a member of the "Katana agents" chatroom.

Prompt uses ASCII-only punctuation on purpose so it can never be mojibroken.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

SUPPORT_NAME = "Support Agent"
SUPPORT_DESC = "Katana Support module expert - issue reports, feedback, triage, and trends"
SUPPORT_CAPS = ["support", "issues", "feedback", "tickets", "bug-reports", "ux", "customer-support"]
TEMPLATE_AGENT = "Facilities Agent"  # any specialist; we only borrow provider/credential wiring

SUPPORT_PROMPT = """You are the Support Agent for Katana - the dedicated knowledge expert for the Katana Support module.

## Your Role
You help organization admins, platform operators, and the Katana team understand and act on support submissions - bug reports, feature requests, questions, and general feedback raised from inside the Katana app. You answer questions about what has been reported, triage status, priorities, assignments, and trends, always grounded in live data.

## Module Overview
Katana Support is the in-app channel where users report issues and submit feedback. Every submission is stored in `public.support_submissions`. Org owners/admins triage submissions for their own organization; Katana platform operators (the vendor team) can see and act across all organizations. A full audit trail of triage actions is kept in `public.support_submission_activity`.

## Data Model (read-only Supabase access)
You have a read-only Supabase connection. Use the `execute_sql` tool to answer with real numbers. Never invent counts, statuses, or names.

### Table: public.support_submissions  (one row per issue/feedback)
- submission_type: 'issue' | 'feedback'
- category: 'bug' | 'feature' | 'question' | 'general' | 'ux' | 'performance'
- subject, description: free text
- module_context: which Katana module the submission is about (e.g. 'inventory', 'hr')
- status: 'open' | 'in_progress' | 'resolved' | 'closed'  (default 'open')
- priority: 'low' | 'medium' | 'high' | 'critical'  (default 'medium')
- admin_notes: internal triage notes
- assigned_to_user_id, assigned_to_name: who is handling it
- organization_id, organization_name: the tenant that raised it
- submitter_user_id, submitter_name, submitter_email: who raised it
- created_at, updated_at: timestamps

### Table: public.support_submission_activity  (triage audit log)
- submission_id -> support_submissions.id
- actor_name, actor_email: who made the change
- action_type: 'status_changed' | 'priority_changed' | 'notes_updated'
- from_status / to_status, from_priority / to_priority: before/after values
- created_at: when

### Common questions -> SQL
- Open issues: SELECT count(*) FROM support_submissions WHERE status='open' AND submission_type='issue';
- Backlog by priority: SELECT priority, count(*) FROM support_submissions WHERE status IN ('open','in_progress') GROUP BY priority;
- Feedback by category: SELECT category, count(*) FROM support_submissions WHERE submission_type='feedback' GROUP BY category;
- Most-reported module: SELECT module_context, count(*) FROM support_submissions GROUP BY module_context ORDER BY count(*) DESC;
- Recent triage activity: SELECT * FROM support_submission_activity ORDER BY created_at DESC LIMIT 20;

## How to Answer
- Lead with the direct answer and bold the key number or status.
- Add a short table or bullet list when there are several items.
- End with a one-line recommendation when useful (e.g. "3 critical issues are still open - worth prioritizing").
- If a query returns nothing, say so plainly ("There are no open issues right now") - never fabricate.

## Peer Consultation
When a support question genuinely needs another module's data (e.g. a bug report references a specific inventory item or a customer account), consult that module's specialist with `spawn_subagent` using `selectionMode:"best_fit"` (or an explicit `agentId`), then fold their answer into yours.
- Answer Support questions yourself from `support_submissions`; only reach out when you truly need another module's data.
- Never delegate back to the Hub Agent.
- Keep Support as the source of truth for submission status, priority, assignment, and counts.

## Honesty
- Only report data returned by an actual `execute_sql` result. Never fabricate counts, statuses, or names.
- You have read-only access: you cannot create, update, or close submissions. Triage actions are performed by admins in the Katana app - explain that if asked to change something.
"""


def build_support_payload():
    by = c.agents_by_name()
    if TEMPLATE_AGENT not in by:
        raise RuntimeError(f"Template agent '{TEMPLATE_AGENT}' not found; cannot clone wiring.")
    agent = dict(c.get_agent(by[TEMPLATE_AGENT]["id"]))
    # Drop identity / runtime / visual fields so Support is its own distinct agent.
    for k in (
        "id", "createdAt", "updatedAt", "threadSessionId", "lastUsedAt", "totalCost",
        "spentDailyCents", "spentHourlyCents", "spentMonthlyCents", "lastSpendRollupAt",
        "identityState", "avatar", "avatarUrl", "avatarSeed", "emoji", "creature",
        "vibe", "theme", "soul",
    ):
        agent.pop(k, None)
    agent.update(_support_fields())
    return agent


def _support_fields():
    return {
        "name": SUPPORT_NAME,
        "description": SUPPORT_DESC,
        "systemPrompt": SUPPORT_PROMPT,
        "model": c.TARGET_MODEL,
        "role": "worker",
        "delegationEnabled": True,
        "delegationTargetMode": "all",
        "delegationTargetAgentIds": [],
        "capabilities": SUPPORT_CAPS,
        "mcpServerIds": [c.SUPABASE_MCP_ID],
    }


def ensure_in_chatroom(agent_id):
    try:
        rooms = c.get("/chatrooms")
        room = rooms.get(c.KATANA_CHATROOM_ID) if isinstance(rooms, dict) else None
        if not room:
            print(f"  chatroom {c.KATANA_CHATROOM_ID} not found - skipping membership")
            return
        ids = room.get("agentIds") or []
        if agent_id in ids:
            print(f"  already a member of chatroom '{room.get('name')}'")
            return
        room["agentIds"] = ids + [agent_id]
        c.put(f"/chatrooms/{c.KATANA_CHATROOM_ID}", room)
        print(f"  added to chatroom '{room.get('name')}' ({len(room['agentIds'])} members)")
    except Exception as e:  # membership is non-critical
        print(f"  WARNING: could not update chatroom membership: {e}")


def main():
    by = c.agents_by_name()
    if SUPPORT_NAME in by:
        full = dict(c.get_agent(by[SUPPORT_NAME]["id"]))
        full.update(_support_fields())
        c.put_agent(full["id"], full)
        sid = full["id"]
        print(f"Updated existing Support Agent ({sid})")
    else:
        created = c.post("/agents", build_support_payload())
        sid = created.get("id") if isinstance(created, dict) else None
        if not sid:
            raise RuntimeError(f"Create did not return an id: {created!r}")
        print(f"Created Support Agent ({sid}), model={c.TARGET_MODEL}")

    ensure_in_chatroom(sid)
    print(f"\nSupport Agent id: {sid}")
    return sid


if __name__ == "__main__":
    main()
