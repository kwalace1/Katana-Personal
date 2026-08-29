# Native mobile milestone (Phase 4)

Katana Personal ships as a **PWA** today. Phase 4 adds the path to a native shell for **HealthKit live sync** and store billing.

## Recommended approach: Capacitor

| Option | Pros | Cons |
|--------|------|------|
| **Capacitor wrapper** (recommended) | Reuse React app, App Store path | HealthKit via community plugin |
| React Native / Expo | Best native UX | Larger rewrite |
| PWA-only + push | Minimal code | No HealthKit background sync |

## Capacitor scaffold (when ready)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Katana Personal" com.katana.personal --web-dir dist
npm run build && npx cap sync
```

Add `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.katana.personal',
  appName: 'Katana Personal',
  webDir: 'dist',
  server: { androidScheme: 'https' },
}

export default config
```

## HealthKit

1. Install `@capacitor-community/health` (or `@perfood/capacitor-healthkit` on iOS).
2. Wire `syncHealthKitLive()` in `src/lib/native/platform.ts` to read sleep + workouts into existing health APIs.
3. Request Health permissions on first Health tab open in native shell.

Until native ships, users import Apple Health `.xml` exports (Settings → Health → Sleep panel).

## Billing on native

- **Web (now):** Stripe Checkout via `/api/billing/checkout` when `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` are set.
- **iOS / Android (later):** RevenueCat or StoreKit 2 / Play Billing — unlock writes to same `katana-personal:plus` local flag + cloud entitlement row.

## Push on native

Web Push (VAPID) works for installed PWAs. Native apps should use APNs/FCM tokens stored in `push_tokens` with `platform: 'ios' | 'android'`.

See [PDF_VISION_ROADMAP.md](./PDF_VISION_ROADMAP.md) Phase 4.
