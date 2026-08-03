# -*- coding: utf-8 -*-
"""Live agent test harness for the Katana Agent Office.

Usage:
  python test_live.py "<Agent Name>" "<message>"

Creates a fresh chat session for the agent, sends the message, drains the SSE
run stream, then reads the message log and reports:
  - any spawn_subagent tool calls (and the target agentId/name)
  - any execute_sql / Supabase tool calls
  - the final assistant text

This is a diagnostic, not an assertion harness; read the output to judge behavior.
"""
import sys
import io
import json
import socket
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c


def create_session(agent_id):
    s = c.post("/chats", {"agentId": agent_id})
    # service may wrap the session; accept either the session or {session:...}
    if isinstance(s, dict) and "id" in s:
        return s["id"]
    if isinstance(s, dict):
        for v in s.values():
            if isinstance(v, dict) and "id" in v:
                return v["id"]
    raise RuntimeError(f"Could not get session id from: {s!r}")


def run_turn(session_id, message, timeout=200):
    """POST the message and drain the SSE stream until {'t':'done'} or timeout."""
    body = json.dumps({"message": message}).encode("utf-8")
    req = urllib.request.Request(
        f"{c.BASE}/chats/{session_id}/chat",
        data=body,
        method="POST",
        headers={"x-access-key": c.ACCESS_KEY, "Content-Type": "application/json"},
    )
    events = []
    with urllib.request.urlopen(req, timeout=timeout) as r:
        r.fp.raw._sock.settimeout(timeout)  # type: ignore[attr-defined]
        for raw in r:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            events.append(ev)
            if ev.get("t") == "done":
                break
            if ev.get("t") == "err":
                print("  [stream err]", ev.get("text"))
    return events


def summarize(session_id):
    msgs = c.get(f"/chats/{session_id}/messages")
    if isinstance(msgs, dict):
        msgs = msgs.get("messages", msgs.get("data", []))

    # Tool calls live in the execution log, not /messages.
    print("  tool/delegation signals (from execution log):")
    found = False
    try:
        log = c.get(f"/chats/{session_id}/execution-log") or []
        for entry in (log if isinstance(log, list) else []):
            if entry.get("category") in ("tool_call", "tool_result"):
                detail = entry.get("detail") or {}
                tool = detail.get("toolName") or "?"
                out = json.dumps(detail.get("output") or detail, ensure_ascii=False)
                tgt = ""
                if tool == "spawn_subagent" and '"agentName"' in out:
                    import re
                    m = re.search(r'"agentName":"([^"]+)"', out)
                    if m:
                        tgt = f" -> {m.group(1)}"
                print(f"    {entry.get('category')}: {tool}{tgt}")
                found = True
    except Exception as e:
        print(f"    (execution-log unavailable: {e})")
    if not found:
        print("    (no tool/delegation signals detected -- likely answered directly)")

    # last assistant text
    last = ""
    for m in (msgs if isinstance(msgs, list) else []):
        role = m.get("role")
        if role == "assistant":
            txt = m.get("text") or m.get("content")
            if isinstance(txt, list):
                txt = " ".join(str(p.get("text", "")) for p in txt if isinstance(p, dict))
            if isinstance(txt, str) and txt.strip():
                last = txt
    print("\n  final assistant text:")
    print("    " + (last.strip()[:900].replace("\n", "\n    ") if last else "(none)"))


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "Hub Agent"
    message = sys.argv[2] if len(sys.argv) > 2 else "How many inventory items are below the reorder threshold?"
    by = c.agents_by_name()
    if name not in by:
        raise SystemExit(f"Agent {name!r} not found")
    agent_id = by[name]["id"]
    print(f"=== Live test: {name} [{agent_id}] ===")
    print(f"Q: {message}\n")
    sid = create_session(agent_id)
    print(f"  session: {sid}")
    try:
        run_turn(sid, message)
    except (socket.timeout, TimeoutError):
        print("  [turn timed out — reading whatever landed]")
    summarize(sid)


if __name__ == "__main__":
    main()
