# -*- coding: utf-8 -*-
"""Targeted prompt fix for the PM agent's one eval failure: it treated "open
tasks" as a literal status ('open', which doesn't exist) and returned 0 instead
of todo+backlog (6). Root cause: the EXACT STATUS MATCH rule listed "open" as a
status. Fix: drop "open" from that rule and define open/outstanding = not-done
(ai_pm_summary.open_tasks). Idempotent; PUTs through the office proxy (which
injects the engine key server-side)."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import engine

PM_ID = "7f94d552"

OLD_EXACT = (
    '- EXACT STATUS MATCH: When a question asks about a specific status/state '
    '(e.g. "blocked", "open", "overdue", "approved", "rejected", "active"), filter '
    "on that EXACT literal value: `WHERE status = '<exact value>'`. NEVER substitute "
    'a near-synonym. "blocked" is NOT "backlog", "todo", "on hold", or "unassigned". '
    '"open" is NOT "in-progress". Treat each status value as distinct.'
)
NEW_EXACT = (
    '- EXACT STATUS MATCH: When a question asks about a specific status/state '
    '(e.g. "blocked", "overdue", "approved", "rejected", "active"), filter on that '
    "EXACT literal value: `WHERE status = '<exact value>'`. NEVER substitute a "
    'near-synonym. "blocked" is NOT "backlog", "todo", "on hold", or "unassigned". '
    'Treat each status value as distinct. EXCEPTION: "open"/"outstanding" tasks is '
    "NOT a status value -- it means not-done work (todo + backlog). Use "
    "`ai_pm_summary.open_tasks` or `WHERE status IN ('todo','backlog')`, "
    "never `WHERE status = 'open'`."
)
SUMMARY_ANCHOR = "- `ai_pm_summary` - one-row rollup:"
CLARIFY = (
    '- "Open tasks" = `ai_pm_summary.open_tasks` (todo + backlog). There is no task '
    'status literally named "open" (statuses: backlog, todo, in-progress, review, '
    'blocked, done).'
)


def main():
    agent = engine._req("GET", f"/agents/{PM_ID}")
    prompt = agent.get("systemPrompt", "")
    changes = []

    if 'EXCEPTION: "open"/"outstanding"' in prompt:
        print("PM prompt already fixed (idempotent no-op).")
        return

    if OLD_EXACT in prompt:
        prompt = prompt.replace(OLD_EXACT, NEW_EXACT)
        changes.append("rewrote EXACT STATUS MATCH rule (dropped 'open' as a status)")
    else:
        print("WARNING: EXACT STATUS MATCH line not found verbatim; skipping that edit")

    if CLARIFY not in prompt:
        lines = prompt.splitlines()
        for i, ln in enumerate(lines):
            if ln.strip().startswith(SUMMARY_ANCHOR):
                lines.insert(i + 1, CLARIFY)
                changes.append("added open-tasks clarification after ai_pm_summary bullet")
                break
        prompt = "\n".join(lines)

    if not changes:
        print("No changes made.")
        return

    agent["systemPrompt"] = prompt
    engine._req("PUT", f"/agents/{PM_ID}", agent)
    # verify
    back = engine._req("GET", f"/agents/{PM_ID}").get("systemPrompt", "")
    ok = 'EXCEPTION: "open"/"outstanding"' in back
    print("Applied:", "; ".join(changes))
    print("Verified on engine:", "YES" if ok else "NO -- PUT may not have persisted")


if __name__ == "__main__":
    main()
