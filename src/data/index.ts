import { DexieStore } from './dexieStore'
import type { DataStore } from './store'

// Local-first: the UI always reads/writes IndexedDB; src/sync/ syncs it with Supabase in the background.
export const localStore = new DexieStore()
export const store: DataStore = localStore

export type { DataStore } from './store'
export * from './types'
