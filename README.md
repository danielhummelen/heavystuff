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
- **Profiles**: local profiles (stand-in for real auth).
- **Data**: JSON backup export/import, CSV export of all sets. Installable & offline (PWA).

## Development
```bash
npm install
npm run dev        # http://localhost:5173 (add --host to test on your phone)
npm test           # unit tests
npm run build      # production build in dist/ (static, deploy anywhere)
```

## Architecture
- React + TypeScript + Vite, `vite-plugin-pwa`, Recharts, HashRouter (works on any static host).
- `src/data/store.ts` – `DataStore` interface. **All UI data access goes through it.**
- `src/data/dexieStore.ts` – IndexedDB implementation (Dexie). Notifies subscribers on change (also across tabs).
- `src/data/index.ts` – picks the implementation. `src/data/useQuery.ts` – reactive hook re-running queries on change.
- IDs are UUIDs and every record has `createdAt`/`updatedAt`/`profileId`, so data can be synced to a hosted DB as-is.

### Moving to a hosted database later
1. Implement `DataStore` (e.g. `SupabaseStore`) with tables mirroring `src/data/types.ts`; call subscribers on
   writes / realtime events.
2. Swap the instance in `src/data/index.ts`.
3. Replace `ProfileProvider` (`src/state/ProfileContext.tsx`) with one backed by the auth session (profile = user).
4. Migrate existing local data via the JSON export → `importInto`.
