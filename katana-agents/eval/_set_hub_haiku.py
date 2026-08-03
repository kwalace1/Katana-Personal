# -*- coding: utf-8 -*-
"""Hub model change, applied to the live engine (recorded for provenance).

Bake-off (2026-07-08, eval harness vs real DW data) result:
  - Sonnet 4.5 (was): 5/6. Correct, no leak, but priciest ($3/$15 per M).
  - Gemini 2.5 Pro:   5/6 but LEAKED internal reflection JSON into a multi-module
                      answer, and 2-3x slower. Rejected.
  - Haiku 4.5 (now):  5/6 -- matches Sonnet exactly (same single cosmetic
                      restate miss on hub-route-hr, no JSON leak, correct routing
                      + real numbers), at ~1/3 the cost ($1/$5) and faster.

This script sets the Hub (116c3cfa) to Haiku 4.5 and adds an anti-restate clause
to its prompt (Haiku tended to append a duplicated summary line; this cut it from
2/6 cases to the 1 residual case that originates in the HR specialist's own
answer format and is collapsed by the client sanitizer at render). Idempotent.
Run through the office proxy with a valid admin session JWT (EVAL_KATANA_JWT).
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import engine

HUB_ID = "116c3cfa"
MODEL = "anthropic/claude-haiku-4.5"
OLD = "Write the answer exactly ONCE as clean markdown. Never output a code fence"
NEW = (
    "Write the answer exactly ONCE as clean markdown. Do NOT append a restated "
    "summary line, a bolded label, or a heading that repeats a number or status "
    "you already gave (for example, never follow 'We have 5 active employees.' "
    "with a second '**Active Employees:** 5'); state each fact exactly once. "
    "Never output a code fence"
)


def main():
    a = engine._req("GET", f"/agents/{HUB_ID}")
    p = a.get("systemPrompt", "")
    changed = []
    if a.get("model") != MODEL:
        a["model"] = MODEL
        changed.append(f"model -> {MODEL}")
    if "never follow" not in p and OLD in p:
        a["systemPrompt"] = p.replace(OLD, NEW, 1)
        changed.append("added anti-restate clause")
    if not changed:
        print("Hub already on Haiku 4.5 with anti-restate clause (idempotent).")
        return
    engine._req("PUT", f"/agents/{HUB_ID}", a)
    back = engine._req("GET", f"/agents/{HUB_ID}")
    print("Applied:", "; ".join(changed))
    print("Verified: model =", back.get("model"), "| anti-restate =", "never follow" in back.get("systemPrompt", ""))


if __name__ == "__main__":
    main()
