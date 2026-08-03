# Katana Demo Runbook — One Company Perfect for March 15

This checklist gets **one KYI company** (e.g. **DW Griffin Capital**) working end-to-end so the full system can be presented to an investor: **Overview → Investors → Suggested Investors → Localized Leads → Geo targeting → Access Map** (Explore, Overlap, Suggested Investors).

---

## 1. Prerequisites

- **Node.js** (v18+) and `npm install` in the repo root.
- **Supabase project** with the KYI schema applied (see below).
- **Optional but recommended for Suggested Investors + Access Map:** The separate **KYI Flask app** (e.g. in a sibling `KYI` repo) running at `http://localhost:5000`, with the **same company name** and **same investor names** in its database so the app can match by name and show the full graph.

---

## 2. Supabase: Schema + Demo Data

### 2.1 Apply KYI schema

In **Supabase Dashboard → SQL Editor**, run the full contents of:

- **`supabase-kyi-schema.sql`** (from the katana repo root).

This creates `kyi_companies`, `kyi_investors`, `kyi_client_geo_settings`, `kyi_investor_leads`, and related tables/views/RLS.

### 2.2 Seed one demo company (optional)

You can run the ready-made seed script in **Supabase Dashboard → SQL Editor**:

- **`scripts/kyi-seed-demo-company.sql`**

It creates (or updates) the Default Company (id 1), **DW Griffin Capital** (id 2) with two investors (Nicholas Griffin, Seamus Walsh), and geo targeting for Austin, TX. **Use the same company name** in the KYI Flask app so Suggested Investors and Access Map resolve correctly.

Alternatively, create the company and investors from the **Katana UI**: KYI → Companies → Add company, then open the company → Investors → Add Investor, and set **Geo targeting** in the Geo tab.

---

## 3. Environment

In the repo root, ensure **`.env`** has:

```env
# Required for companies, investors, geo, and localized leads
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Required for Suggested Investors + Access Map to show real data (name-based match to Flask app)
VITE_KYI_APP_URL=http://localhost:5000

# Optional: where CSVs live for lead import (default: repo data/kyi)
# KYI_DATA_PATH=/path/to/katana/data
```

Without `VITE_KYI_APP_URL`, the Suggested Investors tab and Access Map (Explore / Overlap / Suggested) will show **only** your Supabase investors and **no** suggestion graph or map data.

---

## 4. Lead data (Localized Leads tab)

Leads are stored in the **platform pool** (`client_id = 1`). Every company sees the same pool, filtered by that company’s geo settings.

1. **Put CSV data** in `data/kyi/` (or `KYI_DATA_PATH`): at least `fec_donors.csv` and/or `sec_13f.csv` (see `scripts/kyi-import-data.mjs` and `docs/kyi-automation.md`).
2. **Import into Supabase:**
   ```bash
   npm run kyi:import-data
   ```
3. **Geocode leads** (so “Localized Leads” and geo filtering work):
   - Open the demo company in Katana → **Localized Leads** tab.
   - Click **Geocode now** and wait until “Need geocoding” goes to 0 (or the progress bar completes).
   - If many leads have no coords, run “Geocode now” multiple times (batch processing).

After this, **Geo targeting** and **Localized Leads** should show numbers and a list of leads in radius.

---

## 5. Legacy KYI app (Suggested Investors + Access Map)

For **Suggested Investors** and **Access Map** (Explore, Overlap, Suggested Investors) to show real data when using Supabase:

1. **Company name must match**  
   The company in the KYI Flask app’s database must have the **exact same name** as in Supabase (e.g. **DW Griffin Capital**). The app resolves the legacy company by name.

2. **Investors should match**  
   Having the same investor names (e.g. Nicholas, Seamus) in the Flask app improves matching and graph quality.

3. **Start the Flask app** (from the KYI repo, or via `npm run dev:all` if you use `scripts/start-dev-with-kyi.mjs`):
   ```bash
   # From KYI repo (example)
   source venv/bin/activate && python app.py
   ```
   Ensure it listens on **port 5000** and that `VITE_KYI_APP_URL=http://localhost:5000` is set in Katana’s `.env`.

4. **Restart the Katana dev server** after changing `.env` so it picks up `VITE_KYI_APP_URL`.

---

## 6. Run Katana and verify

1. **Install and start:**
   ```bash
   npm install
   npm run dev
   ```
2. Open **http://localhost:3001** (Vite is configured for port 3001).
3. Sign in if the app uses auth (e.g. Microsoft via Supabase).
4. Go to **KYI → Companies** and open your demo company (e.g. **DW Griffin Capital**).

### Verification checklist — one company

| Step | Tab / area | What to check |
|------|------------|----------------|
| 1 | **Overview** | Company name, location, industry, website/description. |
| 2 | **Investors** | At least two investors (e.g. Nicholas, Seamus) listed. |
| 3 | **Suggested Investors** | Network graph and list show suggestions; “X suggestions • Y connected to 2+ investors” is non-zero if legacy KYI is running and name matches. |
| 4 | **Localized Leads** | Stats (Total, In radius, Showing) and a list of leads; “Need geocoding” 0 or low after running Geocode now. |
| 5 | **Geo targeting** | Address and radius (e.g. Austin, TX, 50 mi) saved and displayed. |
| 6 | **Access Map** | **Explore:** company center + investor nodes. **Overlap:** overlap metrics/list. **Suggested Investors:** same suggestion graph as on the company tab. |

If Suggested Investors or Access Map are empty but Geo and Localized Leads work, the most likely cause is: legacy KYI app not running, wrong port, or company name mismatch between Supabase and the Flask app.

---

## 7. Day-of (March 15) quick checklist

- [ ] Supabase project is up and KYI schema is applied.
- [ ] Demo company exists in Supabase with 2+ investors and geo settings (Austin, TX or your choice).
- [ ] `npm run kyi:import-data` has been run; “Geocode now” has been run so localized leads show.
- [ ] If you want Suggested Investors + Access Map: KYI Flask app is running on port 5000, same company name (and ideally same investors) in its DB.
- [ ] `.env` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_KYI_APP_URL=http://localhost:5000` (if using Flask).
- [ ] `npm run dev` — open http://localhost:3001, sign in, open the demo company and run through the verification table above.
- [ ] Optional: Use `npm run dev:all` to start both KYI Flask and Katana from one command (if `KYI_PATH` is set and the KYI repo is in place).

---

## 8. Troubleshooting

| Issue | What to do |
|-------|------------|
| **Suggested Investors / Access Map empty** | Legacy KYI app must be running at `http://localhost:5000`; company name in Flask must match Supabase exactly; restart Katana after changing `VITE_KYI_APP_URL`. |
| **Localized Leads empty or “Need geocoding” high** | Run `npm run kyi:import-data`; then in the app use “Geocode now” on the Localized Leads tab until the count drops. |
| **Geo targeting not saving** | Check Supabase RLS and that `kyi_client_geo_settings` exists; ensure the location string is valid (e.g. “Austin, TX”). |
| **CORS errors when calling KYI** | Flask app must allow requests from `http://localhost:3001`; `VITE_KYI_APP_URL` must be exact (no trailing slash). |
| **Build fails before demo** | Run `npm run build`; fix any TypeScript or lint errors reported in the codebase. |

---

Summary: **One company** is ready when it exists in Supabase with investors and geo, leads are imported and geocoded, and (for full impact) the legacy KYI app is running with the same company name so Suggested Investors and Access Map are fully populated for the March 15 investor demo.
