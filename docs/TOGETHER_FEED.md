# Together Feed

X-style feed for **friends** and **circles**. Circles rank first in a continuous timeline (no section labels). Private life stays on-device; you only post what you choose.

## What you can post

- Text (up to 500 characters)
- Photos (jpeg/png/webp/gif, ≤5 MB each, up to 4 media)
- Short videos (mp4/webm, ≤25 MB)
- Optional **cards**: goal / habit / workout summaries (requires Settings → **Feed cards**)

Audience picker: **Friends** or a specific **Circle**.

## Deploy checklist

After shipping client code:

1. Run [`supabase/migrations/20260328000000_init_social.sql`](../supabase/migrations/20260328000000_init_social.sql) (tables, RLS, `together` bucket, Realtime)
2. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel
3. Confirm Storage bucket `together` exists (created by the migration)

See [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).

## Ranking

Score = `createdAt + 12h` for circle posts, else `createdAt`. Sorted high → low. “Load earlier” pages older posts. No suggested/discovery tier.

## Privacy

- Default share prefs stay off for cards
- Full goals/habits/workouts remain local; cards are summaries only
- `viewer_ids` on each post gates Postgres RLS + Storage reads
