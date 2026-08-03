# -*- coding: utf-8 -*-
"""Compute the true answer for a data case by running read-only SQL against
Supabase -- through the SAME ai_query RPC and the SAME user JWT the agent uses,
so 'expected' is scoped to exactly the org the agent can see.

ai_query(q) accepts a single read-only SELECT/WITH and returns a jsonb array of
rows. We reuse it (instead of a service-role connection) precisely so RLS shapes
the ground truth identically to the agent's view of the data.
"""
import json
import urllib.request
import urllib.error

import config as C


class GroundTruthError(RuntimeError):
    pass


def query(sql):
    """Run a read-only SELECT/WITH via ai_query; return a list of row dicts."""
    if not (C.SUPABASE_ANON and C.KATANA_JWT):
        raise GroundTruthError(
            "Ground truth needs VITE_SUPABASE_ANON_KEY + EVAL_KATANA_JWT (org-scoped)."
        )
    url = f"{C.SUPABASE_URL}/rest/v1/rpc/ai_query"
    body = json.dumps({"q": sql}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": C.SUPABASE_ANON,
            "Authorization": f"Bearer {C.KATANA_JWT}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        raise GroundTruthError(f"ai_query HTTP {e.code}: {detail}") from None
    # ai_query returns a jsonb array directly.
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


def scalar(sql, field=None):
    """First row's value: the named field, or the sole column if field is None."""
    rows = query(sql)
    if not rows:
        return None
    row = rows[0]
    if field is not None:
        return row.get(field)
    # sole column
    if isinstance(row, dict) and len(row) == 1:
        return next(iter(row.values()))
    return row
