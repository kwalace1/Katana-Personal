# -*- coding: utf-8 -*-
"""Step 9 - Repair the specialists' cross-module handoff tables.

Problem (found 2026-07-08): the specialist handoff tables still reference the
PRE-rebuild agent roster - dead Comms/Automation agent IDs and stale IDs for
every other agent - so a specialist that tries to hand a question to a peer
targets a nonexistent agent. Only the Finance Agent's table was current.

This script fixes them surgically, without regenerating the whole prompt:
  - Reads the LIVE roster (name -> id) from the engine.
  - In each specialist's systemPrompt, finds handoff-table rows shaped like
        | <topics> | <Agent Name> | `<id>` |
    and (a) rewrites <id> to the agent's CURRENT id, (b) drops rows whose agent
    no longer exists (Comms, Automation), (c) ensures a Finance Agent row exists.
  - Leaves every other line untouched. Idempotent.

Target the engine with env vars (falls back to _common's localhost dev engine):
    OFFICE_API_BASE   e.g. https://katana-agents.fly.dev/api   (no trailing slash)
    OFFICE_ACCESS_KEY the engine access key

Always run with --dry-run first to review the diff, then again to apply.
    python 09_fix_handoffs.py --dry-run
    python 09_fix_handoffs.py
"""
import os
import re
import sys
import io
import json
import argparse
import urllib.request
import urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

BASE = os.environ.get("OFFICE_API_BASE", c.BASE).rstrip("/")
KEY = os.environ.get("OFFICE_ACCESS_KEY", c.ACCESS_KEY)

HUB = "Hub Agent"
FINANCE = "Finance Agent"

# Topic descriptions for a Finance handoff row, used only when a specialist's
# table is missing one (Finance post-dates the original prompts).
FINANCE_TOPICS = "financials, bookkeeping, accounting, transactions, bank accounts, reconciliation, month-end close, journal entries, vendors, 1099"

# A markdown table row with a trailing `<id>` in backticks in the last cell.
ROW_RE = re.compile(r"^\|(?P<body>.+?)\|\s*`(?P<id>[^`]+)`\s*\|\s*$")


def _req(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method=method,
        headers={"x-access-key": KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode("utf-8")
    return json.loads(raw) if raw.strip() else None


def list_agents():
    d = _req("GET", "/agents")
    return list(d.values()) if isinstance(d, dict) else d


def name_for_row(body_cells, by_id, by_name):
    """Given a table row's cells, figure out which agent it points at, preferring
    an explicit name cell, else the trailing id."""
    for cell in body_cells:
        name = cell.strip()
        if name in by_name:
            return name
    return None


def fix_prompt(prompt, self_name, by_name, id_to_name):
    """Return (new_prompt, changes[]) with handoff-table ids corrected."""
    changes = []
    lines = prompt.splitlines()
    out = []
    seen_agents = set()
    saw_table = False
    for line in lines:
        m = ROW_RE.match(line)
        if not m:
            out.append(line)
            continue
        cells = [x.strip() for x in m.group("body").split("|")]
        old_id = m.group("id").strip()
        # Every Katana agent name ends with " Agent"; that cell names the target.
        name_cell = next((cell for cell in cells if cell.endswith("Agent")), None)
        if name_cell is None and old_id not in id_to_name:
            # No agent-name cell and an unknown id -> not a handoff row we
            # recognize (or a header). Leave it untouched.
            out.append(line)
            continue
        saw_table = True
        target = name_cell if name_cell is not None else id_to_name.get(old_id)
        if target not in by_name:
            # Agent no longer exists (e.g. Comms/Automation) -> drop the row.
            changes.append(f"drop dead row -> {target or old_id}")
            continue
        if target == self_name:
            changes.append(f"drop self row -> {target}")
            continue
        seen_agents.add(target)
        new_id = by_name[target]["id"]
        if new_id != old_id:
            changes.append(f"{target}: `{old_id}` -> `{new_id}`")
        out.append(line[: m.start("id")] + new_id + line[m.end("id"):])

    new_prompt = "\n".join(out)
    if prompt.endswith("\n"):
        new_prompt += "\n"

    # Ensure a Finance row exists (unless this IS Finance or there was no table).
    if saw_table and self_name != FINANCE and FINANCE in by_name and FINANCE not in seen_agents:
        fin_id = by_name[FINANCE]["id"]
        # Insert after the last handoff row we emitted.
        new_lines = new_prompt.splitlines()
        last_row = max((i for i, ln in enumerate(new_lines) if ROW_RE.match(ln)), default=None)
        if last_row is not None:
            new_lines.insert(last_row + 1, f"| {FINANCE_TOPICS} | {FINANCE} | `{fin_id}` |")
            new_prompt = "\n".join(new_lines) + ("\n" if prompt.endswith("\n") else "")
            changes.append(f"add missing Finance row -> `{fin_id}`")

    return new_prompt, changes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    agents = list_agents()
    by_name = {a["name"]: a for a in agents}
    id_to_name = {a["id"]: a["name"] for a in agents}
    print(f"Engine: {BASE}  |  roster: {len(agents)} agents  |  {'DRY RUN' if args.dry_run else 'APPLYING'}\n")

    specialists = [a for a in agents if a["name"] != HUB]
    total_changes = 0
    for a in sorted(specialists, key=lambda x: x["name"]):
        full = _req("GET", f"/agents/{a['id']}")
        prompt = full.get("systemPrompt", "") or ""
        new_prompt, changes = fix_prompt(prompt, a["name"], by_name, id_to_name)
        if not changes:
            print(f"  {a['name']:18} ok (no change)")
            continue
        total_changes += len(changes)
        print(f"  {a['name']:18} {len(changes)} change(s):")
        for ch in changes:
            print(f"      - {ch}")
        if not args.dry_run:
            full["systemPrompt"] = new_prompt
            _req("PUT", f"/agents/{a['id']}", full)
            print("      -> applied")

    print(f"\n{'Would apply' if args.dry_run else 'Applied'} {total_changes} change(s) across {len(specialists)} specialists.")
    if args.dry_run:
        print("Re-run without --dry-run to apply.")


if __name__ == "__main__":
    main()
