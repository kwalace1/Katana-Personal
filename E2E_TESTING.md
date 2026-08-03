# Katana v2 — End-to-End Testing Guide

## Overview

Katana v2 uses **Playwright** for end-to-end testing. The test suite covers **152 tests** across **14 test files**, validating every route, module, and critical user flow in the application.

Tests authenticate via **Microsoft OAuth** using real credentials stored in `.env`, so they exercise the exact same login flow your users experience.

---

## Quick Start

```bash
# Install dependencies (first time only)
npm install
npx playwright install chromium

# Run all tests (headless — fast, for CI)
npm run test:e2e

# Run all tests with visible browser (watch it work)
npm run test:e2e:headed

# Run with Playwright's interactive UI
npm run test:e2e:ui

# Run only smoke tests (quick sanity check, ~30s)
npm run test:e2e:smoke

# View the HTML report after a run
npm run test:e2e:report
```

---

## Environment Setup

Tests require Microsoft login credentials in your `.env` file:

```env
E2E_USER_EMAIL=your-microsoft-email@company.onmicrosoft.com
E2E_USER_PASSWORD="YourPassword"
```

> **Important:** Wrap the password in quotes if it contains special characters like `#`.

The `.env` file is git-ignored and never committed.

---

## Test Structure

```
e2e/
├── .auth/                  # Saved auth session (git-ignored)
│   └── user.json
├── global-setup.ts         # Microsoft OAuth login — runs once before all tests
├── helpers.ts              # Shared utilities (navigation, waits, viewport sizes)
├── smoke.spec.ts           # Every route loads without crashing + performance
├── landing-page.spec.ts    # Landing page sections, CTAs, dialogs
├── auth.spec.ts            # Auth flows (email, Microsoft, guards, public routes)
├── navigation.spec.ts      # Sidebar links, active states, collapse, header
├── hub.spec.ts             # Hub dashboard rendering
├── projects.spec.ts        # Projects list, detail, 404 handling
├── inventory.spec.ts       # Inventory overview + 5 sub-pages + detail pages
├── modules.spec.ts         # Customer Success, HR, WFM, Z-MO, Automation, KYI
├── employee-portal.spec.ts # Employee portal home + 6 sub-pages + navigation
├── careers.spec.ts         # Public careers page
├── settings.spec.ts        # Organization settings, onboarding, accept-invite
├── responsive.spec.ts      # Mobile vs desktop layouts
└── theme.spec.ts           # Dark/light theme toggle + persistence
```

---

## What's Tested

### Authentication (6 tests)
- Email sign-in dialog opens and validates inputs
- Invalid credentials show error message
- Microsoft OAuth initiates correctly
- "Have an invite?" link navigates to accept-invite
- Unauthenticated users are redirected from protected routes
- Public routes (`/`, `/careers`, `/accept-invite`) are accessible without auth

### Landing Page (11 tests)
- Hero section with headline and CTAs
- Top navigation links (Features, Use Cases, Pricing, FAQ)
- All 6 feature module cards render
- Use case detail dialogs open/close
- 3 pricing tiers (Starter $29, Growth $49, Enterprise Custom)
- FAQ accordion expand/collapse
- Demo booking dialog with calendar, time slots, required fields
- Footer links
- Auth section (sign-in buttons or user avatar)
- Social proof company logos
- Heading hierarchy (single h1, multiple h2s)

### Navigation (7 tests)
- Sidebar visible with module links
- Clicking sidebar links navigates correctly
- Active route is highlighted (bg-primary)
- Sidebar collapse/expand toggle
- Logo links back to landing page
- Header visible on authenticated pages
- Header hidden on landing page

### Hub Dashboard (5 tests)
- Loads without critical console errors
- Renders main content (not blank)
- Accessible at `/hub`
- Has sidebar
- Page has visible content

### Projects (5 tests)
- Projects page loads with content
- No error state
- Sidebar navigation back to hub
- Clicking a project navigates to detail
- Non-existent project ID doesn't crash

### Inventory (14 tests)
- Overview page loads
- 5 sub-pages load and don't error:
  - Check Out (`/inventory/check-out`)
  - Scan In (`/inventory/scan-in`)
  - Purchase Orders (`/inventory/purchase-orders`)
  - Suppliers (`/inventory/suppliers`)
  - Transactions (`/inventory/transactions`)
- Non-existent item detail doesn't crash
- Non-existent PO detail doesn't crash

### Modules (27 tests)
Each of these 6 modules is tested for: page loads, renders content, doesn't crash, has sidebar:
- **Customer Success** (`/customer-success`)
- **Workforce Management** (`/workforce`)
- **HR** (`/hr`)
- **Manufacturing / Z-MO** (`/manufacturing`)
- **Automation** (`/automation`)
- **Know Your Investor** (`/kyi`)

Plus KYI sub-page tests:
- Company detail with non-existent ID
- Investor detail with non-existent ID
- Cross-reference page loads

### Employee Portal (15 tests)
- Portal home loads at `/employee`
- Does not show main app sidebar
- Does not crash
- 6 sub-pages load and don't crash:
  - Directory (`/employee/directory`)
  - Performance (`/employee/performance`)
  - Goals (`/employee/goals`)
  - Development (`/employee/development`)
  - Profile (`/employee/profile`)
  - Job Applications (`/employee/jobs`)
- Navigation between portal pages

### Careers (4 tests)
- Page loads
- Accessible without authentication
- Does not crash
- Renders content

### Settings, Onboarding, Invite (8 tests)
- Organization settings page loads
- Onboarding page loads
- Accept-invite page loads and is accessible without auth
- None of these pages crash

### Smoke Tests (31 tests)
- **All 27 routes** render without crashing or showing React error boundaries
- Landing page loads within 5 seconds
- Hub page loads within 8 seconds
- No uncaught JavaScript errors on landing page
- No uncaught JavaScript errors on hub page

### Responsive Layout (7 tests)
- Landing page renders on mobile (hero + CTA visible)
- Nav links hidden on mobile (responsive design)
- Sidebar hidden on mobile
- Landing page renders on desktop (full nav visible)
- Sidebar visible on desktop
- Feature cards stack on mobile
- Pricing cards stack on mobile

### Theme (3 tests)
- Theme toggle button exists
- Clicking toggle changes theme class on `<html>`
- Theme persists after page reload

---

## Test Projects (Playwright Config)

| Project | Description |
|---------|-------------|
| `setup` | Runs Microsoft OAuth login once, saves session to `e2e/.auth/user.json` |
| `chromium` | All tests (except auth) run as authenticated user using saved session |
| `chromium-no-auth` | Auth tests run without pre-saved session |
| `mobile` | Responsive tests run on Pixel 5 viewport |

---

## Configuration

**File:** `playwright.config.ts`

- **Base URL:** `http://localhost:3001` (Vite dev server)
- **Browser:** Chromium
- **Timeout:** 30s per test, 60s for auth setup
- **Retries:** 2 on CI, 0 locally
- **Artifacts on failure:** Screenshots, traces, videos

---

## CI Integration

To run in CI, set these environment variables:

```yaml
env:
  E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
  E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
  CI: true
```

Example GitHub Actions step:

```yaml
- name: Run E2E tests
  run: |
    npm ci
    npx playwright install chromium
    npm run test:e2e
```

---

## Viewing Results

After running tests, view the detailed HTML report:

```bash
npm run test:e2e:report
```

This opens a browser with:
- Pass/fail status for every test
- Duration per test
- Screenshots for any failures
- Trace viewer for debugging failed tests

---

## Adding New Tests

1. Create a new `.spec.ts` file in `e2e/`
2. Import helpers: `import { navigateTo } from './helpers'`
3. Tests automatically use the saved auth session (logged-in user)
4. For tests that need no auth, add them to a file matching `auth.spec.ts` pattern

Example:

```typescript
import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('My New Module', () => {
  test('page loads', async ({ page }) => {
    await navigateTo(page, '/my-module')
    await expect(page).toHaveURL(/\/my-module/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })
})
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests fail at Microsoft login | Check `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` in `.env` |
| Password has `#` and is truncated | Wrap password in double quotes: `"Pass#123"` |
| Tests time out waiting for pages | Ensure `npm run dev` is running on port 3001 |
| "Stay signed in?" blocks login | The setup handles this automatically via `#idSIButton9` |
| Module page redirects to `/employee` | Normal — user may lack module access (ModuleRouteGuard) |
| Want to skip auth in dev | Unset `VITE_SUPABASE_URL` to disable auth entirely |

---

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run test:e2e` | Run all tests headless |
| `npm run test:e2e:headed` | Run all tests with visible browser |
| `npm run test:e2e:ui` | Open Playwright interactive UI |
| `npm run test:e2e:smoke` | Run only smoke tests (fast) |
| `npm run test:e2e:report` | Open HTML report from last run |
