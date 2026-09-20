# Native mobile (Capacitor)

Katana Personal ships as a **PWA** on the web. Capacitor wraps the same React app for the **App Store**. Plus on iOS is **RevenueCat / StoreKit**.

**Ship checklist (Apple Developer is approved):** [APP_STORE.md](./APP_STORE.md) — App Store Connect, IAP products, RevenueCat keys, TestFlight, review.

## What’s in the repo now

- `capacitor.config.ts` — app id `com.katana.personal`, webDir `dist`, CapacitorHttp so `/api/*` reaches production
- `@capacitor/core` + App / StatusBar / SplashScreen / Keyboard / LocalNotifications
- iOS `contentInset: never` + StatusBar overlays WebView (no black status-bar gap)
- Keyboard `resize: native` so the WebView shrinks with the soft keyboard (fields stay visible)
- `@revenuecat/purchases-capacitor` — Plus entitlement `plus` (`katana_plus_monthly` / `katana_plus_yearly`)
- `npm run build:ios` — Vite build with relative asset paths + `cap sync ios`
- Native shell skips the PWA service worker and the “Add to Home Screen” nudge
- Platform helpers in `src/lib/native/`
- StoreKit test file: `ios/App/KatanaPlus.storekit`

## First-time Mac setup

```bash
# On a Mac with Xcode + this repo
npm install
# .env must include VITE_REVENUECAT_APPLE_API_KEY + VITE_APP_URL + VITE_SUPABASE_*
npm run build:ios
npx cap open ios
```

If `ios/` is missing (Linux CI can’t generate it):

```bash
npx cap add ios
npm run build:ios
npx cap open ios
```

In Xcode:

1. Select the **App** target → Signing & Capabilities.
2. Team: paid Apple Developer org. Bundle ID `com.katana.personal` must match App Store Connect.
3. Add capability **In-App Purchase**.
4. Product → Destination → iPhone simulator or device → Run.

## API / cloud from the native binary

The app loads static files from `dist`. `/api/*` is rewritten to `VITE_APP_URL` (default `https://katana-personal.vercel.app`) so Ask, food estimates, and account deletion work offline-of-Vite.

Set at **build** time:

```bash
VITE_APP_URL=https://katana-personal.vercel.app
VITE_REVENUECAT_APPLE_API_KEY=appl_…
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

## Billing

- **Web / PWA:** Stripe Checkout when `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` are set.
- **iOS:** RevenueCat. Settings → Katana Plus purchases StoreKit packages and unlocks the same Plus entitlement the paywall already gates. Restore purchases is on that screen.

Do not use Stripe inside the iOS binary (App Store Guideline 3.1.1).

## HealthKit / Android / Push

### HealthKit (later)

1. Install `@capacitor-community/health` (or similar).
2. Wire `syncHealthKitLive()` in `src/lib/native/platform.ts`.
3. Until then: Apple Health `.xml` import stays available.

### Push

- **Web / PWA:** Web Push (VAPID) via `/api/push/*`. Social/Together events call `/api/push/notify` so likes, comments, wins, and circle posts reach friends who enabled notifications.
- **Native iOS:** Capacitor Local Notifications for device banners (reminders + social toasts while the app can schedule them). Full APNs remote push is still later (`platform: 'ios'` tokens).
