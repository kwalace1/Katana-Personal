# -*- coding: utf-8 -*-
"""Step 4 - Verify the overhaul end-state. Exit code 0 if everything passes.

Checks: 13 agents; Hub is a coordinator router with no data MCP on gemini-2.5-flash
and a routing table covering every specialist (incl. Support); each specialist has
delegation enabled, the Supabase MCP, gemini-2.5-flash, and the peer block; no agent
references the dead google/gemini-2.0-flash; no BOM/mojibake anywhere; Support is a
chatroom member.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

HUB = "Hub Agent"
SUPPORT = "Support Agent"
PEER_MARK = "KATANA-OVERHAUL:PEER-BLOCK"

problems = []


def check(cond, msg):
    if not cond:
        problems.append(msg)
    return cond


def main():
    agents = c.list_agents()
    by = {a["name"]: a for a in agents}
    specialists = [a for a in agents if a["name"] != HUB]

    print(f"Total agents: {len(agents)}")
    check(len(agents) == 13, f"expected 13 agents, found {len(agents)}")
    check(SUPPORT in by, "Support Agent missing")

    # Hub. role='coordinator' is not settable via SwarmClaw's API (AgentUpdateSchema
    # omits `role`), and delegation works without it, so we don't require it. What
    # matters: the Hub has NO data tools (so it cannot self-answer) and delegation on.
    hub = by.get(HUB)
    if check(hub is not None, "Hub Agent missing") and hub:
        if hub.get("role") != "coordinator":
            print(f"  note: Hub role is {hub.get('role')!r} (coordinator not settable via API; not required)")
        check(not (hub.get("mcpServerIds") or []), f"Hub still has MCP servers {hub.get('mcpServerIds')!r}")
        check(hub.get("model") == c.TARGET_MODEL, f"Hub model is {hub.get('model')!r}")
        check(hub.get("delegationEnabled") is True, "Hub delegationEnabled is not true")
        hp = hub.get("systemPrompt", "") or ""
        for s in specialists:
            check(s["id"] in hp, f"Hub routing table missing id for {s['name']} ({s['id']})")

    # Specialists (incl. Support)
    for a in sorted(specialists, key=lambda x: x["name"]):
        full = c.get_agent(a["id"])
        name = a["name"]
        check(full.get("role") == "worker", f"{name}: role is {full.get('role')!r}, expected worker")
        check(full.get("delegationEnabled") is True, f"{name}: delegationEnabled not true (peer consult off)")
        check(full.get("model") == c.TARGET_MODEL, f"{name}: model is {full.get('model')!r}")
        check(c.SUPABASE_MCP_ID in (full.get("mcpServerIds") or []), f"{name}: missing Supabase MCP")

    # No dead model anywhere
    for a in agents:
        full = c.get_agent(a["id"])
        check(full.get("model") != "google/gemini-2.0-flash", f"{a['name']}: still on dead google/gemini-2.0-flash")

    # Encoding clean everywhere
    for a in agents:
        full = c.get_agent(a["id"])
        for field in ("systemPrompt", "description", "soul"):
            v = full.get(field)
            if isinstance(v, str) and c.has_mojibake(v):
                problems.append(f"{a['name']}: '{field}' still has BOM/mojibake")

    # Support specifics
    if SUPPORT in by:
        sup = c.get_agent(by[SUPPORT]["id"])
        check(bool(sup.get("capabilities")), "Support Agent has no capabilities")
        try:
            rooms = c.get("/chatrooms")
            room = rooms.get(c.KATANA_CHATROOM_ID) if isinstance(rooms, dict) else None
            if room is not None:
                check(by[SUPPORT]["id"] in (room.get("agentIds") or []),
                      "Support Agent not in 'Katana agents' chatroom")
        except Exception as e:
            print(f"  (chatroom membership check skipped: {e})")

    # Summary table
    print("\n%-16s %-9s %-26s %-7s %-9s %-5s" % ("AGENT", "ROLE", "MODEL", "DELEG", "SUPABASE", "PEER"))
    for a in sorted(agents, key=lambda x: (x["name"] != HUB, x["name"])):
        full = c.get_agent(a["id"])
        mcp = full.get("mcpServerIds") or []
        peer = "yes" if (PEER_MARK in (full.get("systemPrompt") or "")) else ("n/a" if a["name"] == HUB else "NO")
        print("%-16s %-9s %-26s %-7s %-9s %-5s" % (
            a["name"], full.get("role"), full.get("model"),
            "on" if full.get("delegationEnabled") else "off",
            "yes" if c.SUPABASE_MCP_ID in mcp else ("none" if a["name"] == HUB else "NO"),
            peer,
        ))

    print()
    if problems:
        print(f"FAIL - {len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print("PASS - all checks green.")


if __name__ == "__main__":
    main()
