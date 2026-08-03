# Consolidated High-Priority Fixes Overview

> Katana Pilot — PM, HRM, and KYI module fixes completed in the April 2026 development review.

---

## 1. Project Management (PM)

### 1a. Table/Calendar View: HR Roster Integration
**File:** `src/components/projects/table-view.tsx`

- Task assignee dropdown now loads the full HR employee roster via `hrApi.getAllEmployees()` in addition to existing project team members.
- Assignee selection writes `assigneeEmployeeId` to the task payload, linking PM tasks to HR employee records.
- Deduplication ensures employees appearing in both the HR roster and project team aren't listed twice.

---

## 2. Human Resource Management (HRM)

### 2a. Employee Portal: KYI Data Section
**File:** `src/pages/employee/EmployeePortalPage.tsx`

- Added a "KYI Companies" card to the employee portal right sidebar.
- Uses `useModuleAccess` to check if the employee has KYI access; fetches up to 5 KYI companies via `getCompanies()`.
- Card only renders when the employee has KYI module access and companies exist.

### 2b. Recruitment Dashboard: Interview Time Field
**File:** `src/components/hr/recruitment-dashboard.tsx`

- "Schedule Interview" card now includes a separate time input (`<Input type="time">`) alongside the date input.
- `handleScheduleInterview` combines date and time into a full ISO datetime string (`YYYY-MM-DDTHH:mm`).
- Time input is disabled until a date is selected.

### 2c. Employee Goals: Edit/Delete Functionality
**File:** `src/pages/employee/EmployeeGoalsPage.tsx`

- "Edit" button opens a dialog with a progress slider (0–100%) and a status dropdown.
- `handleSaveEdit` calls `hrApi.updateGoal` and refreshes local state.
- "Delete" button prompts for confirmation, then calls `hrApi.deleteGoal`.

---

## 3. Know Your Investor (KYI)

### 3a. Company Overview: Social Links & Tags
**Files:** `src/lib/kyi-api.ts`, `src/pages/KYICompanyPage.tsx`

- Extended `KYICompanyDetail` interface with `linkedin_url`, `twitter_url`, and `tags` fields.
- `getCompany` attempts to fetch extended columns first; if the view doesn't have them, it falls back to base columns. This prevents crashes when the Supabase view hasn't been updated yet.

### 3b. Notes: Timestamp & Author Tracking
**File:** `src/lib/kyi-api.ts`

- Added `updated_at` to the `KYIInvestor` interface.
- `getCompanyNotesHistory` now uses `inv.updated_at` (falling back to `inv.created_at`) for note entry timestamps, so edited notes reflect their true last modification time.

### 3c. Access Map: Meaningful Metrics
**Files:** `src/lib/kyi-api.ts`, `src/components/kyi/AccessMapPage.tsx`

- `getAccessMap` now computes `connection_count` dynamically by querying sibling investors sharing `firm` or `location`.
- `topPeople` (formerly an empty array) now identifies investors with the most shared connections (edges).
- `effectiveNodeCount` defaults to `investors.length` when `nodes.length` is 0.
- KPI labels updated for clarity: "Nodes" → "Investors", "Edges" → "Connections", "Unique People" → "People", "Overlap %" → "Network Density".

### 3d. Suggested Investors: Broken Route Fix
**File:** `src/components/kyi/AccessMapSuggestedView.tsx`

- "Add as Investor" link changed from `/kyi/investors/new?...` (non-existent route) to `/kyi/companies/{companyId}?tab=investors&addName=...`, correctly navigating to the company's investors tab with pre-filled data.

### 3e. Solar Network: Label Correction
**File:** `src/components/kyi/InvestorSolarNetwork.tsx`

- Status bar text changed from "X investors in your geo area" to "X leads in your geo area" to accurately reflect that the count refers to leads, not investors.

### 3f. Geocoding: Complete Overhaul
**Files:** `src/lib/kyi-api.ts`, `src/pages/KYICompanyPage.tsx`

#### Problem 1: Hard-coded batch limit of 100
- Old behavior: processed only 100 leads per click, required repeated manual clicks.
- **Fix:** Geocoder now counts all leads needing geocoding upfront (exact DB count) and processes all of them in a single run using a paginated loop (pages of 500). Progress shows "X / N" with the real total.

#### Problem 2: Open-Meteo "City, ST" format not supported
- Old behavior: queries like `name=BIRMINGHAM, AL` returned empty — Open-Meteo doesn't understand comma-separated city/state.
- **Fix:** `geocodeCityState` now searches the city name only, requests `count=10` results, then picks the US result whose `admin1` matches the state. A `US_STATE_ABBREVS` lookup table converts 2-letter codes (e.g., "AL" → "Alabama") for matching.

#### Problem 3: `count=1` + `countryCode` bug
- Old behavior: requesting `count=1` with `countryCode=US` returned empty when a non-US city (e.g., Birmingham UK, pop. 1.1M) outranked the US city. The country filter applied after the limit.
- **Fix:** `geocodeLocationLabel` now requests `count=10` and filters client-side by `country_code` in the response data. This is more reliable than the server-side filter.

#### Result
- Before: 0% geocode success rate (0 of 100 saved).
- After: 89% geocode success rate (474 of 534 saved). Remaining misses are leads with unresolvable city/state data.

### 3g. Leads by Type: Removed 100-row cap
**File:** `src/lib/kyi-api.ts`

- `getLeadsByInvestorType` no longer applies `.slice(0, 100)` to filtered results. All matching leads are now returned.

---

## 4. CI/CD & Quality

### 4a. GitHub Actions CI Pipeline
**File:** `.github/workflows/ci.yml`

- New workflow runs on `push` to `main` and on `pull_request` targeting `main`.
- **lint-typecheck-build** job: `eslint --max-warnings 0`, `tsc --noEmit`, `npm run build`.
- **test** job: `npm run test:run` (Vitest unit tests).

---

## Files Modified (Summary)

| Module | File | Changes |
|--------|------|---------|
| PM | `src/components/projects/table-view.tsx` | HR roster integration for task assignees |
| HRM | `src/pages/employee/EmployeePortalPage.tsx` | KYI companies card on employee portal |
| HRM | `src/components/hr/recruitment-dashboard.tsx` | Interview time field |
| HRM | `src/pages/employee/EmployeeGoalsPage.tsx` | Goal edit/delete functionality |
| KYI | `src/lib/kyi-api.ts` | Company social links fallback, notes timestamps, access map metrics, geocoding overhaul, leads cap removal |
| KYI | `src/pages/KYICompanyPage.tsx` | Dynamic geocode batch size in UI |
| KYI | `src/components/kyi/AccessMapPage.tsx` | KPI label updates |
| KYI | `src/components/kyi/AccessMapSuggestedView.tsx` | Broken route fix |
| KYI | `src/components/kyi/InvestorSolarNetwork.tsx` | Label correction (investors → leads) |
| CI | `.github/workflows/ci.yml` | New CI pipeline |
