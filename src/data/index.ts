import { DexieStore } from './dexieStore'
import type { DataStore } from './store'

// Swap this for a hosted implementation (e.g. `new SupabaseStore(...)`) later.
export const store: DataStore = new DexieStore()

export type { DataStore } from './store'
export * from './types'
