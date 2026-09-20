# Ship Katana to the App Store (Apple Developer + RevenueCat)

Enrollment is approved. Do this **in order**. The Mac steps need Xcode; dashboard steps work on any computer.

Canonical ids (already wired in the app — do not rename):

| What | Value |
|------|--------|
| Bundle ID | `com.katana.personal` |
| App name (Xcode) | Katana Personal |
| Plus entitlement | `plus` |
| Monthly product | `katana_plus_monthly` |
| Yearly product | `katana_plus_yearly` |
| Subscription group | Katana Plus |
| Privacy / Terms | `https://katana-personal.vercel.app/privacy` · `/terms` |
| Support email | katanatechnologysystems@gmail.com |

Suggested starting prices (you can change them in App Store Connect; the app shows whatever Apple returns): **$4.99 / month** and **$39.99 / year**.

---

## 0. What you need

- An **Apple Developer Program** membership that shows Active (you have this).
- A **Mac** with current **Xcode** (App Store → Xcode → open once to accept the license).
- This repo on that Mac.
- A **RevenueCat** account (free): [app.revenuecat.com](https://app.revenuecat.com)
- Production web app live (Ask / food / account delete): `https://katana-personal.vercel.app`

You cannot finish TestFlight or IAP from Linux. Simulator + archive happen on the Mac.

---

## 1. Apple Developer — finish the account (30–60 min)

1. Open [developer.apple.com/account](https://developer.apple.com/account) and confirm **Membership** is Active.
2. Open [App Store Connect](https://appstoreconnect.apple.com) → **Agreements, Tax, and Banking**.
3. Accept the **Paid Applications** agreement. Plus cannot exist until this is Active.
4. Complete **Bank Account**, **Tax**, and **Contact** forms. US accounts usually need W-9. Apple will not sell subscriptions until banking/tax are cleared (often a day).
5. **Users and Access** → your Apple ID should be **Account Holder** or **Admin**.

---

## 2. Register the App ID

1. [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. **+** → **App IDs** → **App**.
3. Description: `Katana Personal`.
4. Bundle ID → **Explicit** → `com.katana.personal`.
5. Capabilities: enable **In-App Purchase** (Sign In with Apple later if you turn on Apple login).
6. Register.

If Xcode already created `com.katana.personal` under your team, skip this.

---

## 3. Create the app in App Store Connect

1. App Store Connect → **Apps** → **+** → **New App**.
2. Platforms: **iOS**.
3. Name: `Katana` (or `Katana Personal` if Katana is taken).
4. Primary language: English (US).
5. Bundle ID: **com.katana.personal**.
6. SKU: `katana-personal` (internal; never shown to users).
7. User access: Full Access.

Then fill **App Information**:

- Privacy Policy URL: `https://katana-personal.vercel.app/privacy`
- Category: **Productivity** (secondary **Health & Fitness** if offered)
- Content rights: you own the content
- Age rating questionnaire: no unrestricted web, no medical claims. Health logging is self-tracking — do not call it medical advice (Terms already say this).

Leave **Pricing** as Free (Plus is an IAP, not a paid download).

---

## 4. Create Katana Plus subscriptions

Wait until **Paid Applications** is Active.

1. Your app → **Monetization** → **Subscriptions**.
2. Create a **Subscription Group** named `Katana Plus`.
3. Add **two** auto-renewable subscriptions:

### Monthly

- Reference name: `Plus Monthly`
- Product ID: **`katana_plus_monthly`** (must match exactly)
- Duration: 1 month
- Price: $4.99 (or your pick)
- Localization (English):  
  Display name `Katana Plus Monthly`  
  Description `Accountability pack: deeper Ask, Circle challenges, meal AI, and proactive nudges.`

### Yearly

- Reference name: `Plus Yearly`
- Product ID: **`katana_plus_yearly`**
- Duration: 1 year
- Price: $39.99
- Localization: `Katana Plus Yearly` + the same description

4. For **each** product, add a **review screenshot** of Settings → Katana Plus (any 1242×2688-ish PNG is fine) and a review note:  
   `Optional auto-renewable unlock for Ask depth, challenges, meal AI, and nudges. Restore Purchases is on the same screen.`
5. Subscription group localization: Display name `Katana Plus`.
6. Leave them **Ready to Submit**. They go out **with the first binary**, not before.

Apple also requires the binary to show:

- Price and duration (the app loads these from StoreKit)
- Auto-renew legal copy (already on Settings → Katana Plus)
- Privacy Policy + Terms links (already there)
- **Restore purchases** (already there)

---

## 5. Keys Apple needs for RevenueCat

Do this **once** for the whole developer account.

### A. In-App Purchase key (required for StoreKit 2)

1. App Store Connect → **Users and Access** → **Integrations** → **In-App Purchase**.
2. **Generate In-App Purchase Key**. Name: `RevenueCat IAP`.
3. Download the `.p8` — Apple shows it **once**. Store it somewhere safe (not in git).
4. Copy **Key ID** and **Issuer ID** from that page.  
   If Issuer ID is missing, generate any **App Store Connect API** key first; the issuer then appears.

### B. App Store Connect API key (lets RevenueCat import prices)

1. Same **Integrations** page → **App Store Connect API**.
2. **Generate** a key with **App Manager** access. Name: `RevenueCat ASC`.
3. Download the `.p8`. Copy **Key ID** + **Issuer ID**.
4. Vendor number: App Store Connect → **Payments and Financial Reports** (top left), e.g. `8xxxxxxx`.

---

## 6. RevenueCat project

1. Sign up at [app.revenuecat.com](https://app.revenuecat.com).
2. **Create project**: `Katana Personal`.
3. **Add app** → Apple App Store.
   - App name: Katana Personal
   - Bundle ID: `com.katana.personal`
4. Open the Apple app in RevenueCat:
   - Upload the **In-App Purchase** `.p8` + Key ID + Issuer ID.
   - (Optional but useful) Upload the **App Store Connect API** `.p8` + Issuer ID + Vendor number.
5. Copy the **public Apple API key** (`appl_…`). This is safe in the iOS binary.

### Products → entitlement → offering

1. **Product catalog → Products** → add (or import):
   - `katana_plus_monthly`
   - `katana_plus_yearly`
2. **Entitlements** → **+ New**
   - Identifier: **`plus`** (must match the app)
   - Attach **both** products.
3. **Offerings** → current offering (usually `default`)
   - Add package **Monthly** (`$rc_monthly`) → `katana_plus_monthly`
   - Add package **Annual** (`$rc_annual`) → `katana_plus_yearly`
   - Make this the **current** offering.

Until products exist in App Store Connect, RevenueCat may show “no products”. That’s expected; finish step 4 first.

---

## 7. Mac: env + build

On the Mac, in the repo (this branch):

```bash
npm install
```

Create `.env` (do **not** commit) with production values:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://katana-personal.vercel.app
VITE_REVENUECAT_APPLE_API_KEY=appl_YOUR_PUBLIC_KEY
```

Build the iOS shell (bundles `dist` + syncs plugins, including RevenueCat):

```bash
npm run build:ios
npx cap open ios
```

In **Xcode**:

1. Select the **App** target → **Signing & Capabilities**.
2. Team: your **paid** Apple Developer team (not Personal Team).
3. Bundle Identifier: `com.katana.personal`.
4. **+ Capability** → **In-App Purchase**.
5. For Simulator-only price UI: **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration** → `KatanaPlus.storekit` (in `ios/App/`). Real Apple charges still need TestFlight + a Sandbox Apple ID.
6. **Product → Destination** → iPhone simulator → **Run**. Smoke Today + Settings.

Native `/api/*` calls (Ask, food, account delete) go to `VITE_APP_URL` so the store binary is not a dead local file.

---

## 8. Archive → TestFlight

1. Xcode: destination **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. Organizer → **Distribute App** → **App Store Connect** → **Upload**.
4. App Store Connect → **TestFlight**. After processing (10–30 min), add yourself as an **Internal Tester**.
5. Install from TestFlight on a real iPhone.

### What to verify on this build (safe area + Together alerts)

1. **No black bar** under the status bar on Today / Social / Settings — content should sit under the notch with the soft gradient visible behind the clock.
2. Settings → **Notifications** → turn on **Together & Social alerts** (allow the iOS permission sheet).
3. With a second cloud account: like a post, comment, repost, share a win to a circle, or post in a circle — the other account should get an in-app bell item, an in-app toast, and a device notification when permission is granted.
4. Tap a notification — it should open Social / Circles.
5. **Keyboard** — tap into Ask, Notes, Social comments, or any text field. Content should lift **with** the keyboard (no cover-then-jump, no leftover blank band when it dismisses).

### Sandbox purchase test

1. iPhone Settings → **Developer** (or App Store → Sandbox) → **Sandbox Account** → sign in with a [Sandbox Apple ID](https://appstoreconnect.apple.com) (**Users and Access** → **Sandbox** → **Testers**). Do **not** use your real Apple ID.
2. Open Katana → Settings → **Katana Plus** → Subscribe. Confirm the Apple sheet, then Plus unlocks.
3. Kill the app, reopen — Plus should stay on (RevenueCat customer info).
4. Tap **Restore purchases** on a second device/install.

If the sheet never appears: products not Ready to Submit, bundle ID mismatch, missing IAP key in RevenueCat, or you aren’t using a Sandbox Apple ID.

---

## 9. App Store listing (copy you can paste)

**Subtitle** (30 characters):  
`Plan the day. Do the next.`

**Promotional text** (optional):  
`A calm daily OS: one next step, Ask that can act, Together only if you want it.`

**Description:**

```
Katana is a calm daily OS. Plan the day. Do the next thing. Share your wins — only if you want to.

TODAY
One next step, capture, evening close, and a weekly review. Your day stays on this iPhone unless you choose Together.

ASK
A day guide that knows your plate and can draft actions. Free includes the loop. Katana Plus adds extra Ask depth.

TOGETHER (optional)
Friends, a feed, shared plans, and Circles. Local-first: private life stays on the device.

PLUS (optional)
Accountability pack: deeper Ask, Circle challenges, meal AI, extra templates, and proactive nudges. Auto-renewable. Manage in iPhone Settings → Apple ID → Subscriptions.

Katana is not medical advice. Health logging is for your own tracking.
```

**Keywords** (100 characters, commas, no spaces after commas):  
`planner,habits,tasks,calendar,journal,health,focus,accountability,circles,daily`

**Support URL:** `https://katana-personal.vercel.app`  
**Marketing URL:** same  
**Privacy:** `https://katana-personal.vercel.app/privacy`

### Screenshots

You need iPhone 6.7" (and usually 6.1") screenshots. On a simulator or device:

1. Today with “Do this next”
2. Ask
3. Together / Circles
4. Settings → Katana Plus (shows prices)

No iPad-only listing unless you want iPad screenshots too (`TARGETED_DEVICE_FAMILY` is currently iPhone + iPad). Easiest first submission: in App Store Connect set **iPhone only**, or supply iPad shots.

### App Privacy (nutrition labels)

Declare (linked to identity, not used for tracking):

- **Purchase History** — App Functionality (RevenueCat / Apple)
- **Email Address** — App Functionality (Together sign-in, optional)
- **User Content** — App Functionality (Together posts you choose to share)
- **Location** — App Functionality (weather / cardio GPS, precise, on device / Open-Meteo)
- **Photos** — App Functionality (meal photos, feed)

Tracking: **No**.

---

## 10. Submit for review

1. App Store Connect → app → **+ Version** `1.0` (matches Xcode `MARKETING_VERSION`).
2. Select the TestFlight build.
3. Attach **both** subscriptions to the version (Monetization → they should appear as “Ready to Submit”).
4. **App Review Information**:
   - Contact: you + `katanatechnologysystems@gmail.com`
   - Demo account: a Together email/password if reviewers need cloud (or note “app works fully without an account”).
   - Notes:

```
Katana is local-first. Skip sign-in to use Today.

Katana Plus is optional. Settings → Katana Plus. Use a Sandbox Apple ID to subscribe. Restore Purchases is on that screen.

Account deletion: Settings → Privacy & data (Together accounts).

No medical claims. Health logging is self-tracking.
```

5. **Add for Review** → **Submit**.

Typical first review is 24–48 hours. Common rejects: missing restore, missing subscription legal copy (we added both), missing privacy URL, IAP products not attached to the version, or “app is just a website” (we ship bundled `dist`, not a WKWebView pointed at Vercel).

---

## 11. After approval

- Plus purchases flow through Apple (30% / 15% after year one). RevenueCat shows MRR.
- To change price: App Store Connect → subscription → price. No app update needed; offerings are remote.
- Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode for the next binary (`1.0.1` / `2`, etc.).
- Keep `VITE_REVENUECAT_APPLE_API_KEY` in the Mac `.env` for every `npm run build:ios`.

Web Stripe remains a separate path for the PWA. iPhone store builds never use Stripe for Plus (Apple Guideline 3.1.1).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “No Plus products are live” | Product IDs mismatch, offering not current, or IAP not Ready to Submit |
| Purchase succeeds but Plus stays off | Entitlement id isn’t `plus`, or IAP key missing in RevenueCat |
| Signing error | Team isn’t the paid org; bundle id not in that team |
| `/api/ask-llm` fails on device | `.env` missing `VITE_APP_URL`; rebuild so CapacitorHttp hits Vercel |
| Reviewer can’t subscribe | Attach IAPs to the version; give Sandbox notes |
| Apple Sign In missing | Only required if you add Google/Facebook login. Email/password is fine. Enable later via `VITE_SUPABASE_APPLE_AUTH` — see `SUPABASE_SETUP.md` |

Build details: [NATIVE_MOBILE.md](./NATIVE_MOBILE.md).
