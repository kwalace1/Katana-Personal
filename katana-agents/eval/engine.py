# -*- coding: utf-8 -*-
"""Drive a single agent turn and capture everything needed to score it.

Works against either the Vercel office proxy (with a real Katana JWT) or the
SwarmClaw engine directly (with an access key). Returns a TurnResult with the
final answer text plus the tool activity pulled from the execution log --
crucially the spawn_subagent delegation targets and any execute_sql calls, which
the SSE stream does not expose.
"""
import json
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field

import config as C


@dataclass
class TurnResult:
    ok: bool
    answer: str = ""
    tool_calls: list = field(default_factory=list)      # [{name, input, output}]
    delegated_to: list = field(default_factory=list)    # [agentId, ...] (spawn_subagent targets)
    sql_queries: list = field(default_factory=list)     # [query text, ...]
    error: str = None
    latency_ms: int = 0
    session_id: str = None

    @property
    def used_sql(self):
        return len(self.sql_queries) > 0

    @property
    def delegated_names(self):
        return [C.AGENT_ID_TO_NAME.get(a, a) for a in self.delegated_to]


def _base_and_headers():
    """(base_url, headers) for the selected drive backend."""
    if C.TARGET == "engine":
        base = C.ENGINE_URL
        headers = {"Content-Type": "application/json"}
        if C.ENGINE_KEY:
            headers["x-access-key"] = C.ENGINE_KEY
        return base, headers
    # proxy
    base = C.OFFICE_BASE
    headers = {"Content-Type": "application/json"}
    if C.KATANA_JWT:
        headers["x-katana-jwt"] = C.KATANA_JWT
    return base, headers


def _req(method, path, body=None, timeout=60):
    base, headers = _base_and_headers()
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(f"{base}{path}", data=data, method=method, headers=headers)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", "replace")
    if not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def create_session(agent_id):
    s = _req("POST", "/chats", {"agentId": agent_id})
    if isinstance(s, dict):
        if "id" in s:
            return s["id"]
        for v in s.values():
            if isinstance(v, dict) and "id" in v:
                return v["id"]
    raise RuntimeError(f"Could not read session id from create response: {s!r}")


def _drain_stream(session_id, message, timeout=240):
    """POST the message and drain the SSE stream, returning accumulated text."""
    base, headers = _base_and_headers()
    body = json.dumps({"message": message}).encode("utf-8")
    r = urllib.request.Request(
        f"{base}/chats/{session_id}/chat", data=body, method="POST", headers=headers
    )
    text_parts = []
    stream_err = None
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            t = ev.get("t")
            if t == "d":
                text_parts.append(ev.get("text", ""))
            elif t == "r":
                text_parts = [ev.get("text", "")]
            elif t == "reset":
                text_parts = []
            elif t == "err":
                stream_err = ev.get("text")
            elif t == "done":
                break
    return "".join(text_parts), stream_err


def _final_answer(session_id):
    """The last assistant message text (authoritative over accumulated deltas)."""
    msgs = _req("GET", f"/chats/{session_id}/messages")
    if isinstance(msgs, dict):
        msgs = msgs.get("messages") or msgs.get("data") or []
    last = ""
    for m in msgs if isinstance(msgs, list) else []:
        if m.get("role") != "assistant":
            continue
        txt = m.get("text") or m.get("content")
        if isinstance(txt, list):
            txt = " ".join(str(p.get("text", "")) for p in txt if isinstance(p, dict))
        if isinstance(txt, str) and txt.strip():
            last = txt
    return last


def _collect_agent_ids(value, out):
    """Recursively pull agentId values out of a spawn_subagent input object."""
    if isinstance(value, dict):
        for k, v in value.items():
            if k == "agentId" and isinstance(v, str):
                out.append(v)
            else:
                _collect_agent_ids(v, out)
    elif isinstance(value, list):
        for v in value:
            _collect_agent_ids(v, out)


def _parse_tool_input(raw):
    """Tool `detail.input` arrives JSON-encoded, sometimes double-wrapped as
    {"input":"{\\"query\\":...}"} -- unwrap it into a plain dict."""
    val = raw
    for _ in range(3):
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except (json.JSONDecodeError, ValueError):
                break
        else:
            break
    if isinstance(val, dict) and isinstance(val.get("input"), str):
        try:
            inner = json.loads(val["input"])
            if isinstance(inner, dict):
                val = {**val, **inner}
        except (json.JSONDecodeError, ValueError):
            pass
    return val if isinstance(val, dict) else {}


def _tool_activity(session_id):
    """Return (tool_calls, delegated_to, sql_queries) from the execution log.
    Only `tool_call` entries carry inputs; `tool_result` entries are the replies."""
    tool_calls, delegated, sql = [], [], []
    try:
        log = _req("GET", f"/chats/{session_id}/execution-log") or []
    except Exception:
        return tool_calls, delegated, sql
    for entry in log if isinstance(log, list) else []:
        cat = entry.get("category")
        if cat not in ("tool_call", "tool_result"):
            continue
        detail = entry.get("detail") or {}
        name = detail.get("toolName") or detail.get("name") or "?"
        parsed_in = _parse_tool_input(detail.get("input") or detail.get("args"))
        tool_calls.append({"name": name, "input": parsed_in, "output": detail.get("output")})
        if cat != "tool_call":
            continue  # extract signals only from the invocation, not the result
        low = name.lower()
        if name == "spawn_subagent" or "subagent" in low or "delegat" in low:
            _collect_agent_ids(parsed_in, delegated)
        if "sql" in low or "query" in low:
            sql.append(parsed_in.get("query") or parsed_in.get("q") or parsed_in.get("sql") or "(query)")
    seen = set()
    delegated = [a for a in delegated if not (a in seen or seen.add(a))]
    return tool_calls, delegated, sql


def run_case(agent_id, message, cleanup=True):
    """Full turn: create session, send, then read answer + tool activity."""
    started = time.time()
    session_id = None
    try:
        session_id = create_session(agent_id)
        _, stream_err = _drain_stream(session_id, message)
        answer = _final_answer(session_id)
        tool_calls, delegated, sql = _tool_activity(session_id)
        latency = int((time.time() - started) * 1000)
        err = None
        if not answer:
            err = stream_err or "empty answer"
        return TurnResult(
            ok=bool(answer),
            answer=answer,
            tool_calls=tool_calls,
            delegated_to=delegated,
            sql_queries=sql,
            error=err,
            latency_ms=latency,
            session_id=session_id,
        )
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        return TurnResult(ok=False, error=f"HTTP {e.code}: {detail}",
                          latency_ms=int((time.time() - started) * 1000), session_id=session_id)
    except Exception as e:  # noqa: BLE001 - diagnostic harness
        return TurnResult(ok=False, error=f"{type(e).__name__}: {e}",
                          latency_ms=int((time.time() - started) * 1000), session_id=session_id)
    finally:
        if cleanup and session_id:
            try:
                _req("DELETE", f"/chats/{session_id}")
            except Exception:
                pass
