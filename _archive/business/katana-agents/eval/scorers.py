# -*- coding: utf-8 -*-
"""Deterministic assertions over a TurnResult. These are cheap, exact, and catch
the failure classes that matter most for these agents: leaked internal JSON,
wrong/absent delegation, not querying live data, and numbers that don't match
ground truth. The LLM judge (judge.py) handles the fuzzy "is this a good answer".

Each assertion is a dict in a case's `assert` list, e.g.
    {check: numeric_match, sql_field: n}
    {check: delegated_to, agent: Inventory Agent}
    {check: contains_any, values: [Status, Heatmap]}
run_assertions returns one result dict per assertion: {check, passed, detail}.
"""
import re

import config as C

# Internal-metadata keys that must never appear in a user-facing answer (mirrors
# the client sanitizer's INTERNAL_KEY_RE; if these leak, the answer is polluted).
_LEAK_KEYS = [
    "factsUpsert", "workflowKey", "objectiveSummary", "invariants", "derived",
    "failures", "quality_score", "taskIntent", "isIncomplete", "lessons",
    "reflection", "learnedSkill", "working_state", "workingState",
]
_LEAK_RE = re.compile("|".join(re.escape(k) for k in _LEAK_KEYS))
_FENCE_JSON_RE = re.compile(r"```(?:json)?\s*[\[{]")
_CONTROL_RE = re.compile(r"\b(NO_MESSAGE|HEARTBEAT_OK)\b")
_ERROR_MARK_RE = re.compile(r"\[Error:")

# Other companies' products must NEVER appear in an answer (owner rule: this is
# Katana's internal tool; agents describe Katana purely in its own terms). Word-
# bounded, unambiguous product names only — common words that double as product
# names (monday, notion, linear, gusto, teams) are excluded or need the .com
# form, so answers about the org's own business data can't false-positive.
_COMPETITOR_RE = re.compile(
    r"\b(asana|trello|jira|clickup|basecamp|airtable|hubspot|zendesk|freshdesk"
    r"|quickbooks|xero|netsuite|workday|bamboohr|salesforce|wrike|smartsheet"
    r"|monday\.com|notion\.so|shortcut\.com)\b",
    re.I,
)

# Phrases that indicate an honest "I have no data / handing off" answer.
_REFUSAL_RE = re.compile(
    r"(no (?:facilities |dedicated )?(?:data|records|table|information)"
    r"|do(?:es)?(?:n'?t| not) (?:yet )?(?:have|support|track|store)"  # "does not yet have dedicated data tables"
    r"|no (?:dedicated )?data tables?"
    r"|don'?t have (?:any )?(?:data|access|records)"
    r"|not (?:available|tracked|stored|able to)"
    r"|cannot (?:query|access|pull|retrieve)"
    r"|no (?:such )?(?:data|numbers) (?:to|available)"
    r"|hand(?:ing| it| this)? off"
    r"|ask the \w+ agent"
    r"|isn'?t something (?:this module|I) (?:track|store))",
    re.I,
)


def _norm(s):
    return (s or "").lower()


def _numbers_in(text):
    """All standalone numbers in the text as floats, tolerant of commas, $, and
    decimals. Digits glued to letters or hyphens (SKU-1042, Q4) are ignored so an
    id can't be mistaken for an answer value."""
    out = []
    for m in re.finditer(r"(?<![\w-])\$?\s*\d[\d,]*(?:\.\d+)?(?![\w])", text or ""):
        raw = m.group(0).replace("$", "").replace(",", "").strip()
        try:
            out.append(float(raw))
        except ValueError:
            pass
    return out


def _expected_value(a, gt_row):
    """Resolve the expected value for numeric/equals checks from the ground-truth
    row (by sql_field) or a literal `value`."""
    if "value" in a:
        return a["value"]
    if gt_row is None:
        return None
    field = a.get("sql_field")
    if field is not None:
        return gt_row.get(field) if isinstance(gt_row, dict) else None
    if isinstance(gt_row, dict) and len(gt_row) == 1:
        return next(iter(gt_row.values()))
    return None


def _check_numeric_match(a, result, gt_row):
    expected = _expected_value(a, gt_row)
    if expected is None:
        return False, "no ground-truth value resolved"
    try:
        exp = float(str(expected).replace(",", "").replace("$", ""))
    except ValueError:
        # non-numeric expected -> fall back to substring
        return (str(expected).lower() in _norm(result.answer),
                f"expected substring {expected!r}")
    tol = float(a.get("tolerance", 0.5 if exp != int(exp) else 0.0))
    nums = _numbers_in(result.answer)
    # exact/near match, or (for money) rounded to the nearest whole unit
    hit = any(abs(n - exp) <= tol for n in nums) or any(round(n) == round(exp) for n in nums)
    return hit, f"expected {exp:g}; found {', '.join(f'{n:g}' for n in nums[:8]) or 'none'}"


def _check_delegated(a, result, agents):
    ids = {result_id for result_id in result.delegated_to}
    names = set(result.delegated_names)
    ok = all((C.AGENTS.get(x, x) in ids) or (x in names) for x in agents)
    return ok, f"expected delegation to {agents}; actual {result.delegated_names or 'none'}"


def run_assertions(case, result, gt_row=None):
    out = []
    for a in case.get("assert", []):
        check = a.get("check")
        passed, detail = False, ""

        if check == "used_sql":
            passed = result.used_sql
            detail = f"sql calls: {len(result.sql_queries)}"
        elif check == "no_leak":
            leaks = []
            if _LEAK_RE.search(result.answer):
                leaks.append("internal-key")
            if _FENCE_JSON_RE.search(result.answer):
                leaks.append("json-fence")
            if _CONTROL_RE.search(result.answer):
                leaks.append("control-token")
            if _ERROR_MARK_RE.search(result.answer):
                leaks.append("error-marker")
            passed = not leaks
            detail = "clean" if passed else "leaked: " + ",".join(leaks)
        elif check == "contains":
            passed = _norm(a.get("value")) in _norm(result.answer)
            detail = f"contains {a.get('value')!r}"
        elif check == "contains_any":
            vals = a.get("values", [])
            passed = any(_norm(v) in _norm(result.answer) for v in vals)
            detail = f"any of {vals}"
        elif check == "contains_all":
            vals = a.get("values", [])
            missing = [v for v in vals if _norm(v) not in _norm(result.answer)]
            passed = not missing
            detail = "all present" if passed else f"missing {missing}"
        elif check == "not_contains":
            passed = _norm(a.get("value")) not in _norm(result.answer)
            detail = f"absent {a.get('value')!r}"
        elif check == "regex":
            passed = bool(re.search(a.get("pattern", ""), result.answer, re.I | re.S))
            detail = f"/{a.get('pattern')}/"
        elif check == "numeric_match":
            passed, detail = _check_numeric_match(a, result, gt_row)
        elif check == "delegated_to":
            passed, detail = _check_delegated(a, result, [a.get("agent")])
        elif check == "delegated_to_all":
            passed, detail = _check_delegated(a, result, a.get("agents", []))
        elif check == "no_delegation":
            passed = not result.delegated_to
            detail = f"delegated_to {result.delegated_names or 'none'}"
        elif check == "refusal":
            passed = bool(_REFUSAL_RE.search(result.answer))
            detail = "honest no-data/handoff" if passed else "did NOT refuse/handoff"
        else:
            detail = f"unknown check {check!r}"

        out.append({"check": check, "passed": bool(passed), "detail": detail})

    # Implicit global assertion (owner rule): no answer may name another
    # company's product, ever. Runs on EVERY case without per-case yaml.
    hits = sorted({m.group(0) for m in _COMPETITOR_RE.finditer(result.answer or "")})
    out.append({
        "check": "no_competitors",
        "passed": not hits,
        "detail": "clean" if not hits else "mentioned: " + ", ".join(hits),
    })
    return out
