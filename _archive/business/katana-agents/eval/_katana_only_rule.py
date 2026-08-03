# -*- coding: utf-8 -*-
"""Enforce the owner's KATANA-ONLY rule on every live agent.

The Hub described the PM module as "similar to tools like Asana or Monday" —
competitor comparisons are baked into the agents' system prompts (confirmed in
the 2026-06-18 agent-config backup). This is Katana's internal tool: agents must
never name or compare against any other company's product.

Two passes, both idempotent:
  1. SCRUB: remove/neutralize competitor names already in each systemPrompt.
     Known comparison clauses are rewritten cleanly; any other sentence that
     still names a competitor is dropped and reported.
  2. RULE: append a hard KATANA-ONLY rule block (marker-guarded) to every
     agent's systemPrompt.

Usage:
  python _katana_only_rule.py           # AUDIT ONLY: report what would change
  python _katana_only_rule.py --apply   # apply scrub + rule to the live engine

Needs EVAL_KATANA_JWT (fresh session token) like every engine script here.
"""
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import engine

RULE_MARKER = "KATANA-ONLY RULE:"
RULE_BLOCK = (
    "\n\nKATANA-ONLY RULE: This is Katana's internal tool. NEVER mention, name, "
    "or compare Katana to any other company, product, or software - no \"like "
    "Asana\", no \"similar to Monday.com\", no naming competitors for any reason. "
    "Describe every Katana module purely in its own terms (what it does, not what "
    "it resembles). The ONLY exception: names that appear inside the "
    "organization's own business data (client names, vendor names, deal names) "
    "are the user's data and must be reported faithfully."
)

# Product names that must not appear in prompts. Broader than the eval/observer
# blocklists because prompts are controlled text we authored (no false-positive
# risk from org data here). Case-insensitive, word-bounded.
COMPETITORS = [
    "asana", "trello", "jira", "clickup", "basecamp", "airtable", "hubspot",
    "zendesk", "freshdesk", "quickbooks", "xero", "netsuite", "workday",
    "bamboohr", "salesforce", "wrike", "smartsheet", "monday\\.com", "monday",
    "notion", "linear", "slack", "intercom", "gusto", "rippling", "zoho",
    "pipedrive", "shopify",
]
COMPETITOR_RE = re.compile(r"\b(" + "|".join(COMPETITORS) + r")\b", re.I)

# Known comparison clauses -> clean replacement. Applied before the generic
# sentence-drop so the module description survives with its meaning intact.
CLAUSE_REWRITES = [
    # "It's designed to be similar to tools like Asana or Monday, but (it's)
    # built right into / integrated directly into Katana."
    (re.compile(
        r"(?:It(?:'s| is) designed to (?:be similar to|function similarly to)|"
        r"(?:It )?functions? similarly to|Similar to|Think(?: of it as)?(?: something)? like)"
        r"\s+(?:tools? (?:like|such as)\s+)?[A-Z][\w.]*(?:\s*(?:,|or|and)\s*[A-Z][\w.]*)*"
        r"\s*,?\s*but (?:it'?s )?(?:built(?: right)? into|integrated directly into|native to)\s+Katana",
        re.I,
    ), "It is built natively into Katana"),
    # "(like|such as) Asana, Monday, or Trello" mid-sentence lists
    (re.compile(
        r"\s*\((?:like|such as|e\.g\.,?)\s+[^)]*\)" , re.I,
    ), None),  # None => only remove if the paren group names a competitor
]


def scrub_prompt(prompt):
    """Return (new_prompt, report_lines). Idempotent: clean prompts pass through."""
    report = []
    text = prompt

    # Never touch the rule block itself (it names competitors as examples).
    rule_at = text.find(RULE_MARKER)
    body, tail = (text[:rule_at], text[rule_at:]) if rule_at >= 0 else (text, "")

    for rx, replacement in CLAUSE_REWRITES:
        def _sub(m):
            if not COMPETITOR_RE.search(m.group(0)):
                return m.group(0)
            report.append(f"  clause: {m.group(0)[:120]!r} -> {(replacement or '(removed)')!r}")
            return replacement if replacement is not None else ""
        body = rx.sub(_sub, body)

    # Generic fallback: drop whole sentences/bullet lines that still name one.
    if COMPETITOR_RE.search(body):
        lines = body.split("\n")
        cleaned_lines = []
        for line in lines:
            if not COMPETITOR_RE.search(line):
                cleaned_lines.append(line)
                continue
            sentences = re.split(r"(?<=[.!?])\s+", line)
            kept = [s for s in sentences if not COMPETITOR_RE.search(s)]
            for s in sentences:
                if COMPETITOR_RE.search(s):
                    report.append(f"  dropped sentence: {s.strip()[:140]!r}")
            cleaned_lines.append(" ".join(kept))
        body = "\n".join(cleaned_lines)
        body = re.sub(r"[ \t]{2,}", " ", body)

    return body + tail, report


def main():
    apply = "--apply" in sys.argv
    agents = engine._req("GET", "/agents")
    items = agents.values() if isinstance(agents, dict) else agents

    changed = 0
    for a in sorted(items, key=lambda x: x.get("name", "")):
        name, aid = a.get("name", "?"), a.get("id", "?")
        prompt = a.get("systemPrompt", "") or ""

        new_prompt, report = scrub_prompt(prompt)
        needs_rule = RULE_MARKER not in new_prompt
        if needs_rule:
            new_prompt = new_prompt.rstrip() + RULE_BLOCK

        # Also report competitor names hiding in other text fields (not edited).
        other = {k: v for k, v in a.items() if k != "systemPrompt" and isinstance(v, str)}
        other_hits = {k: sorted({m.group(0) for m in COMPETITOR_RE.finditer(v)})
                      for k, v in other.items() if COMPETITOR_RE.search(v)}

        if not report and not needs_rule and not other_hits:
            print(f"OK    {name} ({aid}): clean, rule present")
            continue

        print(f"FIX   {name} ({aid}):")
        for line in report:
            print(line)
        if needs_rule:
            print("  + append KATANA-ONLY rule block")
        for field, hits in other_hits.items():
            print(f"  ! field {field!r} also mentions {hits} (review manually)")

        if apply and (report or needs_rule):
            a["systemPrompt"] = new_prompt
            engine._req("PUT", f"/agents/{aid}", a)
            back = engine._req("GET", f"/agents/{aid}").get("systemPrompt", "")
            ok_rule = RULE_MARKER in back
            body_clean = not COMPETITOR_RE.search(back[:back.find(RULE_MARKER)] if RULE_MARKER in back else back)
            print(f"  applied -> rule={'YES' if ok_rule else 'NO'} body_clean={'YES' if body_clean else 'NO'}")
            changed += 1

    print()
    print(f"{'APPLIED to' if apply else 'AUDIT ONLY - would change'} {changed if apply else 'see FIX lines above'} agent(s).")
    if not apply:
        print("Re-run with --apply to write changes to the live engine.")


if __name__ == "__main__":
    main()
