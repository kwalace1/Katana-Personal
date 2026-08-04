# Firebase setup for Katana Personal (free)

You do **not** run a database yourself. Google hosts Auth + Firestore on the free Spark plan.

## 1. Create a project (≈3 minutes)

1. Open [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Disable Google Analytics if you want (optional)
3. Create the project

## 2. Enable Email/Password auth

1. **Build → Authentication → Get started**
2. **Sign-in method → Email/Password → Enable → Save**

## 3. Apple Sign In (App Store / Sign in with Apple)

1. Apple Developer → **Certificates, Identifiers & Profiles → Identifiers** → enable **Sign In with Apple** on your App ID
2. Create a **Services ID** (web) and configure domains/return URLs for your Firebase auth domain (`https://YOUR_PROJECT.firebaseapp.com/__/auth/handler`)
3. Create a Sign in with Apple **key**, note Key ID + Team ID
4. Firebase Console → **Authentication → Sign-in method → Apple → Enable**
5. Paste Services ID, Apple Team ID, Key ID, and the `.p8` private key
6. In Katana Settings, use **Continue with Apple**

## 4. Create Firestore

1. **Build → Firestore Database → Create database**
2. Start in **test mode** for local development (replace rules before production — see `firestore.rules`)
3. Pick a region close to you

## 5. Register a web app

1. Project overview → **</> Web**
2. Nickname: `katana-personal`
3. Copy the config values into `.env` (from `.env.example`)

```bash
cp .env.example .env
# paste values, then:
npm run dev
```

## 6. Deploy security rules (required when rules change)

In Firebase Console → Firestore → Rules, paste `firestore.rules` and **Publish**.

Republish whenever we add collections (friends, circles, **circleInvites**, **notifications**, **blocks**, **pushTokens**).

Also deploy indexes from `firestore.indexes.json` (Firebase CLI: `firebase deploy --only firestore:indexes`) — needed for circle invite inbox queries. When the console prompts for a composite index (e.g. notifications `uid` + `createdAt`, or circleInvites `inviteeUid` + `status`), click the link to create it.

## 7. Web push (optional)

1. Firebase Console → Project settings → **Cloud Messaging** → Web Push certificates → generate a key pair
2. Put the key in `.env` as `VITE_FIREBASE_VAPID_KEY=`
3. Paste the same web app config into `public/firebase-messaging-sw.js` (`firebaseConfig`)
4. In Settings → **Enable browser notifications**

In-app notification bell works without VAPID. Browser push needs VAPID + the messaging SW config.

Restart the Vite server after changing `.env`.
