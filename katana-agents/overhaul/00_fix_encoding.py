# -*- coding: utf-8 -*-
"""Step 0 — Repair UTF-8 BOM + mojibake in every agent's text fields.

Idempotent: re-running is a no-op once prompts are clean. Run before the
content-editing steps so later edits are appended to clean text.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

TEXT_FIELDS = ("systemPrompt", "description", "soul")


def main():
    agents = c.list_agents()
    print(f"Scanning {len(agents)} agents for encoding corruption...\n")
    changed = 0
    for a in sorted(agents, key=lambda x: x["name"]):
        dirty_fields = []
        for field in TEXT_FIELDS:
            val = a.get(field)
            if isinstance(val, str) and c.has_mojibake(val):
                dirty_fields.append(field)
        if not dirty_fields:
            print(f"  {a['name']:16} clean")
            continue

        full = c.get_agent(a["id"])  # full object for a safe round-trip PUT
        for field in dirty_fields:
            full[field] = c.fix_text(full[field])
        c.put_agent(a["id"], full)
        changed += 1
        print(f"  {a['name']:16} FIXED: {', '.join(dirty_fields)}")

    print(f"\nDone. {changed} agent(s) repaired.")


if __name__ == "__main__":
    main()
