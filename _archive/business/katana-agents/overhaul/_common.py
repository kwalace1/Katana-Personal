# -*- coding: utf-8 -*-
"""Shared helpers for the Katana Agent Office overhaul scripts.

All agent/chatroom state lives in SwarmClaw's runtime DB and is edited through its
REST API (http://localhost:3456/api). The API uses full-object PUTs, so every
mutation follows GET -> modify -> PUT. Stdlib only (urllib) so it runs anywhere.

This source file is intentionally pure ASCII; every non-ASCII marker is built from
\\u escapes so the script's own bytes can never be mojibroken.
"""
import json
import urllib.request
import urllib.error

ACCESS_KEY = "75b862a32c33ae221f28b722a5ec89cb"
BASE = "http://localhost:3456/api"

# Standard model for every Katana agent. google/gemini-2.0-flash was removed from
# OpenRouter; 2.5-flash is the cheapest high-accuracy replacement (verified available).
TARGET_MODEL = "google/gemini-2.5-flash"
SUPABASE_MCP_ID = "3e54b3b7"
KATANA_CHATROOM_ID = "d2934cb8"

BOM = "﻿"
# Mojibake fingerprints. "â€" is the "a-circumflex + euro" pair that
# begins every smart-punctuation char when UTF-8 is mis-decoded as CP1252;
# "Ã"/"Â" begin mis-decoded accented/control bytes.
_MOJI_MARKERS = ("â€", "Ã", "Â")
_REPLACEMENT = "�"


def _req(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"x-access-key": ACCESS_KEY, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8")
            if not raw.strip():
                return None
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw  # some endpoints (e.g. DELETE) return plain "OK"
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {detail[:500]}") from None


def get(path):
    return _req("GET", path)


def put(path, body):
    return _req("PUT", path, body)


def post(path, body):
    return _req("POST", path, body)


def delete(path):
    return _req("DELETE", path)


def list_agents():
    d = get("/agents")
    return list(d.values()) if isinstance(d, dict) else d


def agents_by_name():
    return {a["name"]: a for a in list_agents()}


def get_agent(agent_id):
    return get(f"/agents/{agent_id}")


def put_agent(agent_id, agent):
    return put(f"/agents/{agent_id}", agent)


# --- Encoding repair --------------------------------------------------------
# The stored prompts were saved with a UTF-8 BOM and classic "mojibake": UTF-8
# bytes decoded as CP1252 and re-stored. The exact inverse is encode('cp1252')
# then decode('utf-8'). It is guarded (accept only when it removes mojibake) and
# idempotent: clean text with a real special char fails the utf-8 re-decode and
# is returned unchanged.


def _moji_count(s):
    return sum(s.count(m) for m in _MOJI_MARKERS)


def has_mojibake(s):
    if not isinstance(s, str):
        return False
    return s.startswith(BOM) or _moji_count(s) > 0


def _mojibake_of(ch):
    """The corrupted form of a character: its UTF-8 bytes decoded with a *lenient*
    Windows-1252 mapping (undefined bytes 0x81/0x8D/0x8F/0x90/0x9D fall back to the
    matching C1 control code point, which is exactly how the data was mangled)."""
    out = []
    for b in ch.encode("utf-8"):
        try:
            out.append(bytes([b]).decode("cp1252"))
        except UnicodeDecodeError:
            out.append(chr(b))
    return "".join(out)


# Smart punctuation + the handful of accented letters that appear in business text.
# Source stays pure-ASCII: every target is a \u escape, and the mojibake keys are
# derived from them, so the map can never itself be corrupted.
_TARGET_CHARS = [
    "—", "–", "’", "‘", "“", "”", "…",
    "•", "×", " ", "é", "è", "í", "ó",
    "ú", "ñ", "ü", "à",
]
_MOJIBAKE_MAP = {}
for _ch in _TARGET_CHARS:
    _bad = _mojibake_of(_ch)
    if _bad != _ch:
        _MOJIBAKE_MAP[_bad] = " " if _ch == " " else _ch
# Replace longest sequences first so shared prefixes (all begin "â€")
# don't get partially consumed.
_MOJI_KEYS = sorted(_MOJIBAKE_MAP, key=len, reverse=True)


def fix_text(s):
    if not isinstance(s, str):
        return s
    s = s.replace(BOM, "")
    for key in _MOJI_KEYS:
        if key in s:
            s = s.replace(key, _MOJIBAKE_MAP[key])
    return s
