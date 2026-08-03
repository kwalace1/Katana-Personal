# -*- coding: utf-8 -*-
"""Step 5 - Runtime settings for the interactive Katana office.

The autonomy *reflection* feature asks the model to emit a
{summary, invariants, derived, failures} block after a turn. A cheap model leaks
that block (or empty ```json fences after it's stripped) into the visible answer,
and it auto-writes low-value notes to memory. It runs on every surface (the Hub's
own chat turn AND each subagent's task turn), so narrowing the scope is not enough
to stop the relayed leak. We disable reflection entirely and also scope the
supervisor's loop-detection to autonomous tasks only.

These are GLOBAL SwarmClaw settings (they affect any other agents on this
instance). Reflection is a learning/polish feature, not core functionality;
re-enable it in Settings if you want autonomous agents to keep auto-learning.

Idempotent.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

DESIRED = {
    "reflectionEnabled": False,        # stop the {summary,invariants,...} block / ```json leak
    "reflectionAutoWriteMemory": False,  # stop auto-writing reflection notes to memory
    # Subagent delegation is classified as the 'task' surface, so 'task'/'both' let the
    # supervisor/reflection machinery run on relayed answers and leak a trailing ```json
    # fence. Scope to 'chat' only so delegated answers stay clean.
    "supervisorRuntimeScope": "chat",
    "supervisorEnabled": False,        # belt-and-suspenders: no supervisor pass on any surface
}


def main():
    before = c.get("/settings") or {}
    print("before:", {k: before.get(k) for k in DESIRED})
    if all(before.get(k) == v for k, v in DESIRED.items()):
        print("Already set - nothing to do.")
        return
    c.put("/settings", dict(DESIRED))
    after = c.get("/settings") or {}
    print("after: ", {k: after.get(k) for k in DESIRED})
    print("Interactive answers will no longer carry reflection JSON / empty code fences.")


if __name__ == "__main__":
    main()
