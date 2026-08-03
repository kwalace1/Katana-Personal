# -*- coding: utf-8 -*-
"""Step 6 - Clean slate for the agent office.

Clears conversational/runtime data via the SwarmClaw API (server-managed, so the
running server's caches stay consistent - no raw DB edits):
  - all chat sessions / conversations (and their messages + run state)
  - all notifications
  - chatroom message history (the room and its 13 members are KEPT)

PRESERVES everything that defines the office: the 13 agents and their config, MCP
servers, chatroom membership, credentials, provider configs, settings, and memory.

Idempotent. Note: SwarmClaw's /api/activity feed has no delete endpoint, so it is
left as-is (it ages out on its own); say so if you need it wiped too.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c


def clear_sessions():
    data = c.get("/chats")
    ids = list(data.keys()) if isinstance(data, dict) else [s.get("id") for s in (data or [])]
    ids = [i for i in ids if i]
    ok = 0
    for sid in ids:
        try:
            c.delete(f"/chats/{sid}")
            ok += 1
        except Exception as e:
            print(f"  WARN: could not delete session {sid}: {e}")
    print(f"  sessions deleted: {ok}/{len(ids)}")


def clear_notifications():
    # The bulk DELETE only removes *read* notifications, so delete each by id.
    before = c.get("/notifications")
    items = list(before.values()) if isinstance(before, dict) else list(before or [])
    n = len(items)
    ok = 0
    for it in items:
        nid = it.get("id") if isinstance(it, dict) else it
        if not nid:
            continue
        try:
            c.delete(f"/notifications?id={nid}")
            ok += 1
        except Exception as e:
            print(f"  WARN: could not delete notification {nid}: {e}")
    after = c.get("/notifications")
    remaining = len(after) if isinstance(after, (list, dict)) else 0
    print(f"  notifications cleared: {n} (deleted {ok}) -> {remaining}")


KATANA_CHATROOM_NAME = "Katana agents"


def ensure_katana_chatroom():
    """Clearing all sessions cascade-deletes session-backed chatrooms, so restore the
    'Katana agents' room (all 13 agents) if it's gone; otherwise just clear its messages.
    Membership is always preserved/restored."""
    rooms = c.get("/chatrooms")
    items = list(rooms.items()) if isinstance(rooms, dict) else [(r.get("id"), r) for r in (rooms or [])]
    agent_ids = [a["id"] for a in c.list_agents()]

    existing = next(((rid, room) for rid, room in items
                     if isinstance(room, dict) and room.get("name") == KATANA_CHATROOM_NAME), None)
    if existing:
        rid, room = existing
        room["agentIds"] = agent_ids
        room["messages"] = []
        c.put(f"/chatrooms/{rid}", room)
        print(f"  chatroom '{KATANA_CHATROOM_NAME}' kept ({len(agent_ids)} members), messages cleared")
        return

    created = c.post("/chatrooms", {"name": KATANA_CHATROOM_NAME, "agentIds": agent_ids})
    if isinstance(created, dict) and created.get("id"):
        created["messages"] = []  # drop the auto-generated join messages for a clean slate
        c.put(f"/chatrooms/{created['id']}", created)
        print(f"  chatroom '{KATANA_CHATROOM_NAME}' recreated (id={created['id']}, "
              f"{len(agent_ids)} members, no messages)")
    else:
        print(f"  WARN: could not recreate chatroom: {created!r}")


def main():
    print("Cleaning the agent office to a clean slate (config + agents + memory preserved)...\n")
    print("Sessions / conversations:")
    clear_sessions()
    print("Notifications:")
    clear_notifications()
    print("Chatroom history:")
    clear_chatroom_messages()

    agents = c.list_agents()
    print(f"\nPreserved: {len(agents)} agents, their config, MCP servers, chatroom membership, "
          f"credentials, settings, and memory.")
    print("Done - the office is a clean slate.")


if __name__ == "__main__":
    main()
