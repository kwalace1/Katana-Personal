# Suggested Investors View — Single Source of Truth

This file is the **exact** implementation of the Suggested Investors part of the Access Map orbit in KYI. Use it as the only source when reimplementing in another system. Do not improvise; match the API contract, layout math, and UI below.

---

## 1. API Contract

**Endpoint:** `GET /api/companies/<company_id>/suggested-investors`

**Response JSON (exact shape):**

```json
{
  "company_name": "string",
  "existing_investors": [
    { "id": 1, "full_name": "string", "firm": "string", "title": "string", "location": "string", "industry": "string" }
  ],
  "suggested_count": 0,
  "multi_investor_count": 0,
  "firms": { "Firm Name": [ /* suggestion objects */ ] },
  "suggestions": [
    {
      "name": "string",
      "position": "string",
      "location": "string",
      "score": 0,
      "source": "string",
      "sources": [],
      "signals": [],
      "reasons": ["string"],
      "profile_url": "",
      "firm": "string",
      "related_investors": [
        { "id": 1, "name": "Investor Full Name", "firm": "string", "reasons": ["string"] }
      ]
    }
  ]
}
```

- **related_investors**: Every investor whose profile produced this suggestion. Order matters: **related_investors[0]** is the **primary** investor used for grouping suggestions in arcs on the graph.
- **multi_investor_count**: Number of suggestions with `related_investors.length >= 2`.
- **suggestions**: Sorted by (1) `related_investors.length` desc, (2) `score` desc, (3) `name` asc.

---

## 2. Frontend — Layout constants

| Constant | Value |
|----------|--------|
| Inner ring radius (investors) | `Math.min(dim.width, dim.height) * 0.15` |
| Base radius for suggestion arcs | `Math.min(dim.width, dim.height) * 0.28` |
| Max radius | `Math.min(dim.width, dim.height) * 0.45` |
| Arc spread per investor | `(2 * Math.PI / invCount) * 0.85` |
| Ring spacing (suggestions) | 35 |
| Suggestions per ring | `Math.min(12, Math.ceil(invSuggs.length / 3))` |
| Company center circle r | 28, fill #1a1f2e, stroke #3a4a66 |
| Investor node r (normal) | 18; when selected 22; stroke #0c1322 or #fff when selected |
| Suggestion node radius | `6 + Math.min(1, (score || 0) / 30) * 8` (6–14) |
| Investor colors (in order) | #7c5cff, #3b82f6, #22c55e, #f59e0b, #ec4899, #14b8a6, #ef4444, #8b5cf6 |
| Investor→center line | stroke investor color, stroke-opacity 0.25 |
| Relation edge (suggestion↔investor) | stroke investor color; default opacity 0; on hover 0.6 (investor) or 0.8 (suggestion) |
| Zoom scale extent | [0.3, 3] |
| Legend position | translate(-dim.width/2 + 15, -dim.height/2 + 15) |
| Status bar position | y = dim.height/2 - 12 |

---

## 3. Frontend — Graph logic (summary)

1. **Fetch:** `GET /api/companies/${COMPANY_ID}/suggested-investors` → `data`.
2. **Filter:** If `filterByInvestor` is set, keep only suggestions where `related_investors.some(r => r.name === filterByInvestor)`.
3. **Investor positions:** `angle = 2*PI*i/invCount - PI/2`; `x = invRadius*cos(angle)`, `y = invRadius*sin(angle)`; `invRadius = min(w,h)*0.15`.
4. **Primary investor per suggestion:** Use `related_investors[0].name`; group suggestions by that name into `suggByInvestor[inv.full_name]`. When building positions, pass `related` (same as `related_investors`) so each suggestion has `.related` for tooltips and `.relatedInvs` = array of investor position objects for drawing edges.
5. **Suggestion positions (arcs):** For each investor, `startAngle = inv.angle - arcSpread/2`. For each suggestion in `suggByInvestor[inv.full_name]`, ring index = floor(i / perRing), posInRing = i % perRing; `radius = baseRadius + ringNum*35`; `angle = startAngle + (arcSpread * (posInRing + 0.5) / ringTotal)`. Then `x = radius*cos(angle)`, `y = radius*sin(angle)`.
6. **Zoom/pan:** Apply same transform to both edges group and nodes group. Double-click: reset transform to identity (duration 500).
7. **Click investor:** If same as current filter → clear filter. Else → set filter to that investor.
8. **Hover investor:** Set relation edges where investor matches to opacity 0.6; others 0. Show info panel (label, firm, "N suggestions").
9. **Hover suggestion:** Set relation edges where suggestion matches to opacity 0.8; others 0. Show info (name, firm, position, score, "Via: FirstName1, FirstName2").
10. **Click suggestion:** Open detail panel.

---

## 4. Frontend — List panel

- **Stats line:** `${allSuggestions.length} suggestions • ${multi_investor_count} connected to 2+ investors` (use `data.multi_investor_count`).
- **Filter buttons:** "Filter by:" then "All" then one button per `existing_investors` with `inv.full_name.split(' ')[0]`. Active = `filterByInvestor === inv.full_name` or empty for All.
- **Search:** Filter `displaySuggestions` by query on `name + position + firm + location + reasons.join(' ') + related_investors.map(r=>r.name).join(' ')` (all lowercased).
- **List sort:** Same as API: by `related_investors.length` desc, then `score` desc.
- **List item:** Connection badge, name, position, firm, location, score, signal pills, related pills; card border #f59e0b40 if 2+ connections else #1f2937. Click → open detail panel.

---

## 5. Frontend — Detail panel (suggestion)

- **Title:** Blue dot + person name.
- **Block 1:** Position, Firm, Location, Source, Match Score; if `profile_url` add "View Profile" link.
- **"Why Suggested:"** reasons as pills.
- **"Related to Your Investors:"** For each `related_investors`: card with `rel.name` and `(rel.reasons || []).join(' • ')`.
- **"+ Add as Investor"** link with name, firm, location query params.

---

## 6. Helper functions

- **truncateLabel(label, maxLen)** — Return label.substring(0, maxLen) + '..' if length > maxLen, else label; default maxLen 10.
- **getDimensions()** — Return { width, height, centerX, centerY }. SVG main group translated to (centerX, centerY).
