# -*- coding: utf-8 -*-
"""One-off: drive one turn and dump the RAW execution log + tool-signal parse so
we can see how tool calls are actually represented (why used_sql/delegated_to
came back empty)."""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import config as C, engine

agent_id = C.AGENTS[sys.argv[1] if len(sys.argv) > 1 else "HR Agent"]
q = sys.argv[2] if len(sys.argv) > 2 else "How many active employees do we have?"

sid = engine.create_session(agent_id)
print("session:", sid)
_, err = engine._drain_stream(sid, q)
print("stream err:", err)
ans = engine._final_answer(sid)
print("\n--- ANSWER ---\n", (ans or "(none)")[:600])

raw = engine._req("GET", f"/chats/{sid}/execution-log")
print("\n--- execution-log type:", type(raw).__name__, "len:", (len(raw) if isinstance(raw, list) else "n/a"))
entries = raw if isinstance(raw, list) else (raw.get("entries") or raw.get("log") or [] if isinstance(raw, dict) else [])
print("categories seen:", sorted({e.get("category") for e in entries if isinstance(e, dict)}))
# dump first few tool-ish entries structurally
shown = 0
for e in entries if isinstance(entries, list) else []:
    if not isinstance(e, dict):
        continue
    cat = e.get("category", "")
    if "tool" in str(cat).lower() or shown < 3:
        print(json.dumps(e, ensure_ascii=False)[:500])
        shown += 1
    if shown >= 8:
        break
tc, deleg, sql = engine._tool_activity(sid)
print("\nparsed -> used_sql:", bool(sql), "sql:", sql[:2], "delegated_to:", deleg, "tool_calls:", [t["name"] for t in tc])
try: engine._req("DELETE", f"/chats/{sid}")
except Exception: pass
