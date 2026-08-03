# -*- coding: utf-8 -*-
"""Step 8 - Wire the org-chart hierarchy so delegation is VISIBLE.

The Org Chart view builds its tree (and the live delegation edges/bubbles) from
each agent's `orgChart.parentId` plus the Hub's `role: coordinator`. Our agents
had neither, so the chart rendered them as disconnected nodes with no edges -
delegation worked but you couldn't see the Hub talking to specialists.

This sets:
  - Hub: role=coordinator, delegationEnabled, delegationTargetMode=selected,
    delegationTargetAgentIds=[all specialists]
  - every specialist: orgChart.parentId = Hub  (so an edge Hub -> specialist is drawn)

These fields are stripped by the normal PUT /agents schema, so we use the
PATCH /agents/bulk endpoint (the same one the org-chart drag-and-drop uses),
which patches arbitrary fields. Idempotent.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

HUB_NAME = "Hub Agent"


def main():
    by_name = c.agents_by_name()
    if HUB_NAME not in by_name:
        raise RuntimeError("Hub Agent not found.")
    hub_id = by_name[HUB_NAME]["id"]
    specialists = [a for a in c.list_agents() if a["name"] != HUB_NAME]
    specialist_ids = [a["id"] for a in specialists]

    patches = []

    # Hub becomes the coordinator/root pointing at every specialist.
    patches.append({
        "id": hub_id,
        "patch": {
            "role": "coordinator",
            "delegationEnabled": True,
            "delegationTargetMode": "selected",
            "delegationTargetAgentIds": specialist_ids,
        },
    })

    # Each specialist is parented under the Hub so an edge is drawn. Preserve any
    # existing orgChart fields (saved positions, etc.) by merging.
    for a in specialists:
        full = c.get_agent(a["id"])
        org = dict(full.get("orgChart") or {})
        org["parentId"] = hub_id
        patches.append({
            "id": a["id"],
            "patch": {"role": "worker", "orgChart": org},
        })

    res = c._req("PATCH", "/agents/bulk", {"patches": patches})
    updated = (res or {}).get("updated") if isinstance(res, dict) else None
    errors = (res or {}).get("errors") if isinstance(res, dict) else None
    print(f"Org chart wired: Hub={hub_id} coordinator -> {len(specialist_ids)} specialists parented.")
    print(f"  bulk patch updated={updated}, errors={errors}")


if __name__ == "__main__":
    main()
