# AGENTS.md

Guidance for AI coding agents working on Heavystuff. Read `README.md` for features and architecture details.

## What this is
Mobile-first, offline-capable PWA for logging weightlifting sessions. React 19 + TypeScript + Vite, Dexie (IndexedDB),
Recharts, `vite-plugin-pwa`. Cloud sync + Google sign-in via Supabase. Hosted on Vercel (auto-deploys `main`).

## Commands
```bash
npm install
npm run dev      # http://localhost:5173 (needs .env.local, see .env.example)
npm test         # vitest (fake-indexeddb, no network)
npm run lint     # oxlint
npm run build    # tsc -b && vite build – must pass before committing
```
Run `npm run build && npm test && npm run lint` after changes. Existing lint warnings (react purity / only-export-components)
are known; don't add new ones.

## Layout
```
src/data/types.ts        Entity types (single source of truth for fields)
src/data/store.ts        DataStore interface – the only data API the UI uses
src/data/dexieStore.ts   IndexedDB implementation + outbox/sync helpers
src/data/useQuery.ts     Reactive query hook (re-runs on store changes)
src/sync/syncEngine.ts   Push outbox / pull by rev / tombstones
src/sync/remote.ts       Supabase table + field mapping (FIELDS, REMOTE_TABLES)
src/sync/supabase.ts     Supabase client, Google sign-in
src/state/ProfileContext.tsx  Auth session ↔ profile, sync engine lifecycle
src/pages/, src/components/   UI
supabase/migrations/     Postgres schema, RLS, sync triggers
```

## Rules
- **Local-first.** UI reads/writes only through `store` (`src/data`). Never call Supabase from UI components; the sync
  engine handles the server.
- **Every write must be tracked.** New write methods in `DexieStore` go through `this.write(...)` + `putTracked` /
  `deleteTracked`, otherwise the change never reaches the cloud. Always bump `updatedAt` (last write wins).
- **IDs** are client-generated UUIDs (`src/lib/id.ts`); timestamps are epoch ms.
- **Adding/changing a field or entity** touches all of these:
  1. `src/data/types.ts`
  2. `src/data/dexieStore.ts` (new Dexie `version(n)` only if indexes change; never edit old versions)
  3. `src/sync/remote.ts` `FIELDS` (and `REMOTE_TABLES`/`SYNC_TABLES` for new tables)
  4. A **new** file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` – never edit applied migrations. New tables need
     `user_id`, `rev`, the three sync triggers, RLS policy, grants and realtime publication (copy the pattern from
     `20261003090000_init.sql`). New columns need a default or be nullable (old clients don't send them).
  5. Export/import (`ExportData`) if the data should be in backups.
- **Security:** only the publishable key belongs in the client/env. Never commit `.env.local` or the service_role key.
  RLS must stay enabled on every table.
- Keep it mobile-first and offline-safe; no new runtime dependencies without a good reason.
- Routing uses `HashRouter` and `base: './'` – keep paths relative.

## Testing
- Unit tests live next to code (`*.test.ts`). `src/sync/syncEngine.test.ts` has a `FakeRemote` mimicking the SQL
  semantics – extend it when changing sync behaviour.
- SQL can be sanity-checked locally with PGlite (`@electric-sql/pglite`) by stubbing `auth.uid()`, roles and `auth.users`.

## Deploying
- Push to `main` → Vercel builds and deploys (env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- Migrations are **not** applied automatically: run new migration files in the Supabase SQL editor (before deploying
  code that depends on them).
