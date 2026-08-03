# -*- coding: utf-8 -*-
"""Step 2 - Configure the module specialists (every agent except Hub and Support).

Changes (all idempotent):
  - delegationEnabled: true, delegationTargetMode: all  (enables peer consultation -
    SwarmClaw only grants the spawn_subagent tool when delegation is enabled)
  - role: worker
  - model: gemini-2.5-flash  (replaces the now-removed google/gemini-2.0-flash)
  - ensure the read-only Supabase MCP is attached
  - repair any prompt encoding, then upsert one shared, sentinel-delimited block:
    peer consultation + data grounding/honesty + concise response style.

Support Agent is configured by 03 (it already ships these sections); Hub by 01.
Block uses ASCII-only punctuation so it can never be mojibroken.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

EXCLUDE = {"Hub Agent", "Support Agent"}

BLOCK_START = "<!-- KATANA-OVERHAUL:PEER-BLOCK"
BLOCK_END = "<!-- /KATANA-OVERHAUL:PEER-BLOCK -->"

SHARED_BLOCK = """<!-- KATANA-OVERHAUL:PEER-BLOCK v1 -->
## Working With the Team (peer consultation)
You are the specialist for your own Katana module. Answer questions in your domain yourself, grounded in live data. When a question genuinely needs another module's data, consult that module's specialist instead of guessing:
- Use `spawn_subagent` with `selectionMode:"best_fit"` and pass the sub-question as `message`, or target an explicit `agentId` if you know the right teammate.
- Only delegate the part you cannot answer from your own module; answer the rest yourself.
- Never delegate back to the Hub Agent, and do not bounce a question you can answer directly.
- After a teammate replies, fold their answer into your own response.

## Grounding and Honesty
- Answer from real data: run `execute_sql` against the read-only Supabase connection and report actual results. Never invent counts, names, IDs, or statuses.
- If a query returns no rows, say so plainly rather than guessing.
- If you lack a tool or the data is not present, say what you can and cannot see.

## Response Style
- Lead with the direct answer and bold the key number or status.
- Use a short table or bullet list when there are several items.
- Be concise; end with a one-line recommendation only when it genuinely helps.
<!-- /KATANA-OVERHAUL:PEER-BLOCK -->"""


def upsert_block(prompt):
    """Remove any prior overhaul block (so version bumps replace, not stack), then append."""
    i = prompt.find(BLOCK_START)
    if i != -1:
        j = prompt.find(BLOCK_END, i)
        if j != -1:
            prompt = prompt[:i] + prompt[j + len(BLOCK_END):]
    return prompt.rstrip() + "\n\n" + SHARED_BLOCK + "\n"


def main():
    agents = c.list_agents()
    targets = [a for a in agents if a["name"] not in EXCLUDE]
    print(f"Configuring {len(targets)} specialists (excluding {', '.join(sorted(EXCLUDE))})...\n")

    for a in sorted(targets, key=lambda x: x["name"]):
        full = dict(c.get_agent(a["id"]))
        full["delegationEnabled"] = True
        full["delegationTargetMode"] = "all"
        if not isinstance(full.get("delegationTargetAgentIds"), list):
            full["delegationTargetAgentIds"] = []
        full["role"] = "worker"
        full["model"] = c.TARGET_MODEL

        mcp = full.get("mcpServerIds") or []
        if c.SUPABASE_MCP_ID not in mcp:
            mcp = mcp + [c.SUPABASE_MCP_ID]
        full["mcpServerIds"] = mcp

        base = c.fix_text(full.get("systemPrompt", "") or "")
        full["systemPrompt"] = upsert_block(base)

        c.put_agent(full["id"], full)
        print(f"  {a['name']:16} delegation=on, model={c.TARGET_MODEL}, "
              f"supabase={'yes' if c.SUPABASE_MCP_ID in full['mcpServerIds'] else 'NO'}, peer-block=upserted")

    print(f"\nDone. {len(targets)} specialists configured.")


if __name__ == "__main__":
    main()
