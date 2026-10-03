import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncRecord, SyncTable } from '../data/dexieStore'

/** Server side of the sync. Implemented by Supabase in the app and by an in-memory fake in tests. */
export interface Remote {
  /** Rows of `table` with rev > `since`, ordered by rev, at most PAGE_SIZE per call. */
  pull(table: SyncTable, since: number): Promise<{ rows: SyncRecord[]; revs: number[] }>
  /** Tombstones with rev > `since`, ordered by rev, at most PAGE_SIZE per call. */
  pullDeletions(since: number): Promise<{ table: SyncTable | null; id: string; rev: number }[]>
  upsert(table: SyncTable, rows: SyncRecord[]): Promise<void>
  delete(table: SyncTable, ids: string[]): Promise<void>
  /** The signed-in user's profile id, if they already have one in the cloud. */
  getOwnProfileId(): Promise<string | undefined>
  /** Calls `onChange` when the server reports changes; returns an unsubscribe function. */
  listen(onChange: () => void): () => void
}

export const PAGE_SIZE = 1000

export const REMOTE_TABLES: Record<SyncTable, string> = {
  profiles: 'profiles',
  exercises: 'exercises',
  templates: 'templates',
  sessions: 'sessions',
  sessionExercises: 'session_exercises',
  sets: 'workout_sets',
}
const LOCAL_TABLES = Object.fromEntries(Object.entries(REMOTE_TABLES).map(([l, r]) => [r, l])) as Record<string, SyncTable>

// Fields synced per table (mirrors src/data/types.ts and supabase/migrations).
const FIELDS: Record<SyncTable, string[]> = {
  profiles: ['id', 'name', 'settings', 'createdAt', 'updatedAt'],
  exercises: ['id', 'profileId', 'name', 'category', 'equipment', 'isBodyweight', 'defaultRestSec', 'isPreset', 'archived', 'createdAt', 'updatedAt'],
  templates: ['id', 'profileId', 'name', 'exerciseIds', 'createdAt', 'updatedAt'],
  sessions: ['id', 'profileId', 'name', 'notes', 'status', 'startedAt', 'endedAt', 'templateId', 'createdAt', 'updatedAt'],
  sessionExercises: ['id', 'profileId', 'sessionId', 'exerciseId', 'order', 'createdAt', 'updatedAt'],
  sets: [
    'id', 'profileId', 'sessionId', 'sessionExerciseId', 'exerciseId', 'order', 'weight', 'reps', 'rpe', 'rir',
    'isWarmup', 'isDropSet', 'toFailure', 'notes', 'completedAt', 'createdAt', 'updatedAt',
  ],
}

const toColumn = (key: string) => (key === 'order' ? 'sort_order' : key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))

export function toRow(table: SyncTable, record: SyncRecord): Record<string, unknown> {
  const r = record as unknown as Record<string, unknown>
  return Object.fromEntries(FIELDS[table].filter((f) => r[f] !== undefined).map((f) => [toColumn(f), r[f]]))
}

export function fromRow(table: SyncTable, row: Record<string, unknown>): SyncRecord {
  return Object.fromEntries(FIELDS[table].map((f) => [f, row[toColumn(f)]])) as unknown as SyncRecord
}

const CHUNK = 500
function chunks<T>(items: T[]) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK))
  return out
}

export class SupabaseRemote implements Remote {
  private client: SupabaseClient
  constructor(client: SupabaseClient) {
    this.client = client
  }

  async pull(table: SyncTable, since: number) {
    const { data, error } = await this.client
      .from(REMOTE_TABLES[table])
      .select('*')
      .gt('rev', since)
      .order('rev')
      .limit(PAGE_SIZE)
    if (error) throw error
    return { rows: data.map((r) => fromRow(table, r)), revs: data.map((r) => Number(r.rev)) }
  }

  async pullDeletions(since: number) {
    const { data, error } = await this.client
      .from('deletions')
      .select('table_name, row_id, rev')
      .gt('rev', since)
      .order('rev')
      .limit(PAGE_SIZE)
    if (error) throw error
    return data.map((d) => ({ table: LOCAL_TABLES[d.table_name] ?? null, id: d.row_id as string, rev: Number(d.rev) }))
  }

  async upsert(table: SyncTable, rows: SyncRecord[]) {
    for (const part of chunks(rows)) {
      const { error } = await this.client
        .from(REMOTE_TABLES[table])
        .upsert(part.map((r) => toRow(table, r)), { defaultToNull: false })
      if (error) throw error
    }
  }

  async delete(table: SyncTable, ids: string[]) {
    for (const part of chunks(ids)) {
      const { error } = await this.client.from(REMOTE_TABLES[table]).delete().in('id', part)
      if (error) throw error
    }
  }

  async getOwnProfileId() {
    const { data, error } = await this.client.from('profiles').select('id').limit(1)
    if (error) throw error
    return data[0]?.id as string | undefined
  }

  listen(onChange: () => void) {
    const channel = this.client
      .channel(`sync-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
      .subscribe()
    return () => {
      void this.client.removeChannel(channel)
    }
  }
}
