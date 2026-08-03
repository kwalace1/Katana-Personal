# -*- coding: utf-8 -*-
"""Fix the Hub's one residual miss (hub-route-hr): it appended a redundant
'**Active Employees:** 5' label after relaying the specialist's clean sentence.

Root cause (verified via execution log): the specialist returns a clean sentence
('We currently have **5** active employees.'), but the Hub prompt's "#1 RULE"
demanded the reply BEGIN with a bold section header, so the model bolted on a
'**Label:** value' header that restated the same number. The two instructions
contradicted for a single-module answer.

Fix: rewrite the #1 RULE so a single-module answer is relayed as the specialist's
clean sentence with the figure bolded inline (no extra label header); bold section
headers are reserved for multi-module answers. Idempotent. Applied via the office
proxy (needs a valid session JWT)."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import engine

HUB_ID = "116c3cfa"

OLD = (
    "THE #1 RULE: Your reply MUST begin with a bold section header (the characters "
    "`**`). There must be ZERO characters before the first `**`. Any intro sentence, "
    'lead-in summary, partial list, or "Here\'s an overview:" line before the first '
    "`**` is a BUG - do not write one. Likewise, write NO closing/recap sentence "
    "after the final section."
)
NEW = (
    "THE #1 RULE: Begin directly with the answer - no preamble, no lead-in, no "
    '"Here\'s an overview:" line, and no acknowledgement. For a SINGLE-module '
    "question, relay the specialist's answer as ONE clean sentence or short "
    "paragraph with the key figure already bolded INLINE (e.g. `We currently have "
    "**5** active employees.`). Do NOT also add a separate `**Label:** value` header "
    "or summary line that repeats a figure you already stated inline - the inline "
    "bold IS the formatting, and repeating it is a BUG. For a MULTI-module question, "
    "use one bold section header per module. Either way write NO closing/recap "
    "sentence, and never state the same number twice."
)


def main():
    a = engine._req("GET", f"/agents/{HUB_ID}")
    p = a.get("systemPrompt", "")
    if "the inline\nbold IS the formatting" in p or "the inline bold IS the formatting" in p:
        print("Hub relay rule already fixed (idempotent).")
        return
    if OLD not in p:
        print("ANCHOR NOT FOUND - the #1 RULE text differs; aborting without change.")
        return
    a["systemPrompt"] = p.replace(OLD, NEW, 1)
    engine._req("PUT", f"/agents/{HUB_ID}", a)
    ok = "inline bold IS the formatting" in engine._req("GET", f"/agents/{HUB_ID}").get("systemPrompt", "")
    print("Applied #1 RULE rewrite (single-module = inline-bold sentence, no restated label).")
    print("Verified on engine:", "YES" if ok else "NO")


if __name__ == "__main__":
    main()
