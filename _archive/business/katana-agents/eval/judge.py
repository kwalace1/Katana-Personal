# -*- coding: utf-8 -*-
"""LLM judge (rubric grader) on the cheapest capable model via OpenRouter.

Grades an answer 0-100 against a rubric. Deliberately a SEPARATE model from the
one under test (default google/gemini-2.5-flash-lite) so it is not self-grading.
Deterministic-leaning: temperature 0, strict JSON contract, defensive parsing.
"""
import json
import re
import urllib.request
import urllib.error

import config as C

_SYSTEM = (
    "You are a strict QA grader for an enterprise assistant. Grade the ASSISTANT ANSWER "
    "against the RUBRIC and the user QUESTION. Judge only what the rubric asks for: "
    "correctness, whether it directly answers, and whether it avoids inventing data. "
    "Ignore minor style. Reply with ONLY a JSON object: "
    '{"score": <0-100 integer>, "reasons": "<one sentence>"}.'
)


def grade(question, answer, rubric):
    """Return {score:int, reasons:str}. Raises on transport failure."""
    if not C.OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    user = (
        f"QUESTION:\n{question}\n\n"
        f"RUBRIC (what a good answer must do):\n{rubric}\n\n"
        f"ASSISTANT ANSWER:\n{answer or '(empty)'}\n\n"
        "Grade now. JSON only."
    )
    payload = {
        "model": C.JUDGE_MODEL,
        "temperature": 0,
        "max_tokens": 300,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        f"{C.OPENROUTER_BASE}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {C.OPENROUTER_KEY}",
            "X-Title": "Katana Agent Eval",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
    return _parse(content)


def _parse(content):
    # Strip code fences if the model wrapped the JSON.
    content = content.strip()
    m = re.search(r"\{.*\}", content, re.S)
    if m:
        try:
            obj = json.loads(m.group(0))
            score = int(round(float(obj.get("score", 0))))
            return {"score": max(0, min(100, score)), "reasons": str(obj.get("reasons", ""))[:300]}
        except (ValueError, TypeError):
            pass
    # Last resort: a bare number somewhere in the text.
    m = re.search(r"\b(\d{1,3})\b", content)
    if m:
        return {"score": max(0, min(100, int(m.group(1)))), "reasons": "parsed from non-JSON reply"}
    return {"score": 0, "reasons": "unparseable judge reply"}
