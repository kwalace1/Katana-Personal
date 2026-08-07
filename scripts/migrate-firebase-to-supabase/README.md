# Firebase → Supabase data migration

One-shot import of Auth users, Firestore collections, Storage objects, and **password hashes** (same logins).

## Before you run

1. Create a Supabase project and run the SQL migrations in `supabase/migrations/`.
2. Download a Firebase **service account** JSON.
3. Copy env and fill values:

```bash
cp .env.example .env
```

4. From Firebase Console → Authentication → Users → ⋮ → **Password hash parameters**, set:
   - `FIREBASE_HASH_SIGNER_KEY`
   - `FIREBASE_HASH_SALT_SEPARATOR`
   - `FIREBASE_HASH_ROUNDS`
   - `FIREBASE_HASH_MEM_COST`
5. Freeze Firebase writes briefly.

## Run

```bash
npm install

# 1) Export Firebase users (includes passwordHash + salt)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  npx firebase-tools auth:export ./firebase-users.json \
  --project YOUR_FIREBASE_PROJECT_ID --format=json

# 2) Migrate Auth + Firestore (+ Storage)
DRY_RUN=1 node migrate.mjs
node migrate.mjs

# 3) Attach Firebase password hashes to Supabase users
node import-firebase-passwords.mjs
```

## UID mapping

Firebase Auth UIDs are not UUIDs. Each Firebase UID becomes a **deterministic UUID v5**. Social graph FKs are rewritten with the same map.

## Passwords

After `import-firebase-passwords.mjs`, users sign in with their **original Firebase email + password**. Apple-only accounts have no password hash and need Apple provider on Supabase.
