# Module conventions

Each feature lives under `src/modules/<name>/`:

```
types.ts   # domain types (portable to Apple later)
api.ts     # localDb data access only
pages/     # route screens
```

- Modules do not import each other’s pages/components; cross-reads go through `api.ts`.
- Persistence is local-first via `@/lib/local-db`.
- Optional social layer uses Firebase (Auth + Firestore) — see `FIREBASE_SETUP.md`.
- Workspace backup covers all collections listed in `WORKSPACE_COLLECTIONS`.
