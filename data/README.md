# KYI data

CSV files in this folder (or in `data/kyi/` if you set `KYI_DATA_PATH`) are imported into the **platform lead pool**. Any company using KYI sees the same leads, filtered by **their** target location and radius (investors in that area), regardless of where the company is.

## Sources used by the import script

| File | Description |
|------|-------------|
| `fec_donors.csv` | FEC donor names, city/state (incl. without location for later geocoding) |
| `sec_13f.csv` | SEC 13F filers (institutional investors) |
| `sec_form_d.csv` | SEC Form D filers |
| `wikidata_investors.csv` | Investor entities from Wikidata (US) |
| `github_users.csv` | GitHub users (name, location) |
| `mastodon_users.csv` | Mastodon users |
| `news_funding.csv` | Funding news / firms |
| `reddit_posts.csv` | Reddit authors as leads |
| `kyi_nodes.csv` | Nodes (label → display_name, organization → firm) |
| `kyi_edges.csv` | Edges (from_node → person leads) |

## Refresh / new data

- **Manual:** Re-run **`npm run kyi:import-data`** anytime. New rows are added; existing names are skipped (append-only).
- **Automated:** Use **`npm run kyi:refresh`** to fetch from URLs (if configured) then import. See **docs/kyi-automation.md** for cron and scheduling.
- Add or update CSVs in this folder, then run the script again to pull in new leads.
- Geocode from the app: set a company’s geo target, then use **“Geocode now”** to fill lat/lng for leads that have city/state but no coordinates.
