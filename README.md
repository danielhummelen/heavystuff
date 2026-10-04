# Heavystuff 🏋️

A mobile-first PWA for tracking weightlifting sessions.

## Features
- **Sessions**: start/time a workout (survives reloads), name + notes, finish/discard, log/edit past workouts.
- **Exercises & sets**: preset library (grouped by muscle group) + custom exercises; record sets with weight (kg) and reps,
  prefilled from your last set; optional RPE, RIR, warm-up, drop set, to-failure and notes. Tap a set to edit/delete.
- **Rest timer**: count-up with optional target (per-exercise or profile default), ±15s, optional sound/vibration (off by default).
- **History**: previous session's sets shown inline per exercise; full history per exercise with PR badges.
- **Stats**: charts for estimated 1RM (Epley), max weight and volume; personal records.
- **Templates**: create routines or save a workout as a template.
- **Account & cloud sync**: sign in with Google; data is stored on the device (works offline) and synced to Supabase.
- **Data**: JSON backup export/import, CSV export of all sets. Installable & offline (PWA).

## Development
```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev        # http://localhost:5173 (add --host to test on your phone)
npm test           # unit tests
npm run build      # production build in dist/ (static, deploy anywhere)
```

## Workflow for changes
1. **Branch**: `git switch -c feature/<name>` (optional for small fixes, but gives you a Vercel preview URL).
2. **Develop**: `npm run dev`, make the change. AI agents: see [`AGENTS.md`](AGENTS.md).
3. **Database changes**: add a *new* file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` (never edit applied ones)
   and update `src/data/types.ts` + `src/sync/remote.ts`. Keep new columns nullable or defaulted.
4. **Check**: `npm run build && npm test && npm run lint`.
5. **Commit & push**; check the Vercel preview deployment if on a branch.
6. **Apply migrations** in the Supabase SQL editor *before* merging code that needs them.
7. **Merge to `main`** → Vercel deploys to https://heavystuff.vercel.app automatically.

## Architecture
- React + TypeScript + Vite, `vite-plugin-pwa`, HashRouter, hand-rolled SVG charts (works on any static host).
- `src/data/store.ts` – `DataStore` interface. **All UI data access goes through it.**
- `src/data/dexieStore.ts` – IndexedDB implementation (Dexie). Notifies subscribers on change (also across tabs) and
  records every write in an `outbox` table for syncing.
- `src/data/index.ts` – the store instance. `src/data/useQuery.ts` – reactive hook re-running queries on change.
- IDs are UUIDs and every record has `createdAt`/`updatedAt`/`profileId`.

### Cloud sync (Supabase)
Local-first: the UI only talks to IndexedDB; `src/sync/syncEngine.ts` syncs in the background (after local changes,
on Supabase realtime events, when coming back online / to the foreground, and every 5 minutes).
- **Push**: outbox entries are upserted (or deleted) on the server. Updates older than the server's `updated_at` are
  ignored, so the latest write wins.
- **Pull**: every server write gets a `rev` from a global sequence; the client fetches rows with `rev` > its cursor per
  table. Deletes leave tombstones in `deletions`. Rows with unpushed local changes are not overwritten.
- `src/sync/remote.ts` maps records to tables (camelCase → snake_case, `order` → `sort_order`, sets → `workout_sets`).
- `src/state/ProfileContext.tsx` – Google sign-in (Supabase Auth, PKCE). One profile per account. On first sign-in on
  a device the cloud profile is downloaded, or an existing local profile can be uploaded.
- Schema, row-level security (users only access their own rows) and sync triggers: `supabase/migrations/`.

### Supabase setup
1. **Schema**: the GitHub integration (Project Settings → Integrations, working directory `.`, *Deploy to production*
   on) applies `supabase/migrations/` when pushed to the production branch. Alternatively paste the migration into
   the SQL editor.
2. **Google sign-in**: create an OAuth client (type *Web application*) in Google Cloud Console with the authorized
   redirect URI `https://<project>.supabase.co/auth/v1/callback`, then enable Google in Supabase → Authentication →
   Sign In / Providers with its client ID and secret.
3. **Redirect URLs**: Supabase → Authentication → URL Configuration: set the Site URL to where the app is hosted and
   add `http://localhost:5173/**` (and your LAN/host URLs) to the redirect allow list.
4. Builds need `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable key is public by design;
   never use the secret/service_role key in the app).
