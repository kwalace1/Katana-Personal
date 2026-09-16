# Native mobile (Capacitor)

Katana Personal ships as a **PWA** on the web. Capacitor wraps the same React app for the **App Store** (Shipaton / RevenueCat).

## What’s in the repo now

- `capacitor.config.ts` — app id `com.katana.personal`, webDir `dist`
- `@capacitor/core` + App / StatusBar / SplashScreen / Keyboard plugins
- `npm run build:ios` — Vite build with relative asset paths + `cap sync ios`
- Native shell skips the PWA service worker and the “Add to Home Screen” nudge
- Platform helpers in `src/lib/native/`

## What you can do before Apple Developer approval

Enrollment “being processed” blocks **TestFlight** and **App Store** signing. You can still:

| Step | Needs paid Apple Developer? |
|------|-----------------------------|
| Pull this branch on a **Mac** with Xcode | No |
| `npm install && npm run build:ios` | No |
| `npx cap add ios` (first time, creates `ios/`) | No (Mac only) |
| Run in the **iOS Simulator** (`npx cap open ios` → Run) | No |
| Install on a physical iPhone via TestFlight | **Yes** — wait for enrollment |
| App Store / Shipaton release | **Yes** |

Until enrollment clears: develop and demo on the **Simulator**. When Apple emails that you’re active, create the App Store Connect app, signing certificates, then TestFlight.

## First-time Mac setup

```bash
# On a Mac with Xcode + CocoaPods
npm install
npm run build:ios          # creates/syncs ios/ from the Capacitor template
npx cap open ios           # opens Xcode
```

If `ios/` is missing (Linux CI can’t generate it):

```bash
npx cap add ios
npm run build:ios
npx cap open ios
```

In Xcode:

1. Select the **App** target → Signing & Capabilities.
2. Before enrollment is approved, use your personal team for **Simulator** only.
3. After enrollment: set Team to your paid org, confirm Bundle ID `com.katana.personal` matches App Store Connect.
4. Product → Destination → iPhone simulator → Run.

## API / cloud from the simulator

The native app loads static files from `dist`. Calls to `/api/*` and Supabase need a real host:

- Point Capacitor at your Vercel URL for live reload during dev, **or**
- Keep using production `https://katana-personal.vercel.app` APIs via absolute URLs (preferred for Shipaton builds).

For a Shipaton store build, the web assets are bundled; configure `VITE_*` env vars at **build** time so the binary talks to production Supabase / APIs.

## After Apple enrollment + before RevenueCat

1. App Store Connect → new app with bundle id `com.katana.personal`
2. Archive → upload → TestFlight internal testing
3. Then wire **RevenueCat** (SDK + products + replace local Plus unlock on iOS)

## HealthKit / Android

Still later. See roadmap notes below — not required to enter Shipaton.

### HealthKit (later)

1. Install `@capacitor-community/health` (or similar).
2. Wire `syncHealthKitLive()` in `src/lib/native/platform.ts`.
3. Until then: Apple Health `.xml` import stays available.

### Billing

- **Web:** Stripe Checkout when keys are set.
- **iOS (Shipaton):** RevenueCat / StoreKit — unlock the same Plus entitlement the paywall already gates.

### Push

Web Push (VAPID) for PWA. Native later: APNs tokens with `platform: 'ios'`.
