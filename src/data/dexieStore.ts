import Dexie, { type Table } from 'dexie'
import { PRESET_EXERCISES } from './presets'
import type { DataStore } from './store'
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type ExportData,
  type Profile,
  type Session,
  type SessionExercise,
  type Template,
  type WorkoutSet,
} from './types'
import { newId } from '../lib/id'

export const SYNC_TABLES = ['profiles', 'exercises', 'templates', 'sessions', 'sessionExercises', 'sets'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]
export type SyncRecord = Profile | Exercise | Template | Session | SessionExercise | WorkoutSet

/** A locally changed record that still has to be pushed. The row's current state is read at push time. */
export interface OutboxEntry {
  key: string
  table: SyncTable
  id: string
  profileId: string
  token: string
}

class HeavyDB extends Dexie {
  profiles!: Table<Profile, string>
  exercises!: Table<Exercise, string>
  templates!: Table<Template, string>
  sessions!: Table<Session, string>
  sessionExercises!: Table<SessionExercise, string>
  sets!: Table<WorkoutSet, string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<{ key: string; value: unknown }, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      profiles: 'id',
      exercises: 'id, profileId',
      templates: 'id, profileId',
      sessions: 'id, profileId, [profileId+status]',
      sessionExercises: 'id, sessionId, profileId',
      sets: 'id, sessionId, sessionExerciseId, exerciseId, profileId, [profileId+exerciseId]',
    })
    this.version(2).stores({
      outbox: 'key, profileId',
      meta: 'key',
    })
  }
}

export class DexieStore implements DataStore {
  private db: HeavyDB
  private listeners = new Set<() => void>()
  private channel: BroadcastChannel | null = null

  constructor(dbName = 'heavystuff') {
    this.db = new HeavyDB(dbName)
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`${dbName}-changes`)
      this.channel.onmessage = () => this.notifyLocal()
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyLocal() {
    this.listeners.forEach((l) => l())
  }

  private changed() {
    this.notifyLocal()
    this.channel?.postMessage('changed')
  }

  /** Runs `fn` in a read-write transaction that also covers the outbox. */
  private write<T>(tables: SyncTable[], fn: () => Promise<T>) {
    return this.db.transaction('rw', [...tables.map((t) => this.db[t]), this.db.outbox], fn)
  }

  /** Records changed (or deleted) rows so the sync engine pushes them. Must run inside `write`. */
  private track(table: SyncTable, rows: { id: string; profileId?: string }[]) {
    if (!rows.length) return Promise.resolve()
    return this.db.outbox.bulkPut(
      rows.map((r) => ({ key: `${table}:${r.id}`, table, id: r.id, profileId: r.profileId ?? r.id, token: newId() })),
    )
  }

  private async putTracked<T extends SyncRecord>(table: SyncTable, rows: T[]) {
    await (this.db[table] as Table<T, string>).bulkPut(rows)
    await this.track(table, rows)
  }

  private async deleteTracked(table: SyncTable, rows: { id: string; profileId?: string }[]) {
    await this.db[table].bulkDelete(rows.map((r) => r.id))
    await this.track(table, rows)
  }

  // Profiles
  listProfiles() {
    return this.db.profiles.toArray().then((p) => p.sort((a, b) => a.createdAt - b.createdAt))
  }
  getProfile(id: string) {
    return this.db.profiles.get(id)
  }
  async createProfile(name: string) {
    const now = Date.now()
    const profile: Profile = {
      id: newId(),
      name,
      createdAt: now,
      updatedAt: now,
      settings: { ...DEFAULT_SETTINGS },
    }
    const exercises: Exercise[] = PRESET_EXERCISES.map(([n, category, equipment, bw]) => ({
      id: newId(),
      profileId: profile.id,
      name: n,
      category,
      equipment,
      isBodyweight: !!bw,
      defaultRestSec: null,
      isPreset: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }))
    await this.write(['profiles', 'exercises'], async () => {
      await this.putTracked('profiles', [profile])
      await this.putTracked('exercises', exercises)
    })
    this.changed()
    return profile
  }
  async saveProfile(profile: Profile) {
    await this.write(['profiles'], () => this.putTracked('profiles', [{ ...profile, updatedAt: Date.now() }]))
    this.changed()
  }
  async deleteProfile(id: string) {
    const d = this.db
    await this.write(['profiles', 'exercises', 'templates', 'sessions', 'sessionExercises', 'sets'], async () => {
      for (const t of ['sets', 'sessionExercises', 'sessions', 'templates', 'exercises'] as const) {
        await this.deleteTracked(t, await d[t].where('profileId').equals(id).toArray())
      }
      await this.deleteTracked('profiles', [{ id }])
    })
    this.changed()
  }

  // Exercises
  async listExercises(profileId: string) {
    const list = await this.db.exercises.where('profileId').equals(profileId).toArray()
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }
  getExercise(id: string) {
    return this.db.exercises.get(id)
  }
  async saveExercise(exercise: Exercise) {
    await this.write(['exercises'], () => this.putTracked('exercises', [{ ...exercise, updatedAt: Date.now() }]))
    this.changed()
  }
  async deleteExercise(id: string) {
    await this.write(['exercises'], async () => this.deleteTracked('exercises', await this.db.exercises.where('id').equals(id).toArray()))
    this.changed()
  }
  countSetsForExercise(exerciseId: string) {
    return this.db.sets.where('exerciseId').equals(exerciseId).count()
  }

  // Templates
  async listTemplates(profileId: string) {
    const list = await this.db.templates.where('profileId').equals(profileId).toArray()
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }
  getTemplate(id: string) {
    return this.db.templates.get(id)
  }
  async saveTemplate(template: Template) {
    await this.write(['templates'], () => this.putTracked('templates', [{ ...template, updatedAt: Date.now() }]))
    this.changed()
  }
  async deleteTemplate(id: string) {
    await this.write(['templates'], async () => this.deleteTracked('templates', await this.db.templates.where('id').equals(id).toArray()))
    this.changed()
  }

  // Sessions
  getActiveSession(profileId: string) {
    return this.db.sessions.where('[profileId+status]').equals([profileId, 'active']).first()
  }
  async listSessions(profileId: string) {
    const list = await this.db.sessions.where('profileId').equals(profileId).toArray()
    return list.sort((a, b) => b.startedAt - a.startedAt)
  }
  getSession(id: string) {
    return this.db.sessions.get(id)
  }
  async saveSession(session: Session) {
    await this.write(['sessions'], () => this.putTracked('sessions', [{ ...session, updatedAt: Date.now() }]))
    this.changed()
  }
  async deleteSession(id: string) {
    const d = this.db
    await this.write(['sessions', 'sessionExercises', 'sets'], async () => {
      await this.deleteTracked('sets', await d.sets.where('sessionId').equals(id).toArray())
      await this.deleteTracked('sessionExercises', await d.sessionExercises.where('sessionId').equals(id).toArray())
      await this.deleteTracked('sessions', await d.sessions.where('id').equals(id).toArray())
    })
    this.changed()
  }

  // Session exercises
  async listSessionExercises(sessionId: string) {
    const list = await this.db.sessionExercises.where('sessionId').equals(sessionId).toArray()
    return list.sort((a, b) => a.order - b.order)
  }
  async saveSessionExercises(items: SessionExercise[]) {
    const now = Date.now()
    await this.write(['sessionExercises'], () => this.putTracked('sessionExercises', items.map((i) => ({ ...i, updatedAt: now }))))
    this.changed()
  }
  async deleteSessionExercise(id: string) {
    const d = this.db
    await this.write(['sessionExercises', 'sets'], async () => {
      await this.deleteTracked('sets', await d.sets.where('sessionExerciseId').equals(id).toArray())
      await this.deleteTracked('sessionExercises', await d.sessionExercises.where('id').equals(id).toArray())
    })
    this.changed()
  }

  // Sets
  async listSetsForSession(sessionId: string) {
    const list = await this.db.sets.where('sessionId').equals(sessionId).toArray()
    return list.sort((a, b) => a.order - b.order)
  }
  async listSetsForExercise(profileId: string, exerciseId: string) {
    const list = await this.db.sets.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray()
    return list.sort((a, b) => a.completedAt - b.completedAt || a.order - b.order)
  }
  listSetsForProfile(profileId: string) {
    return this.db.sets.where('profileId').equals(profileId).toArray()
  }
  async saveSet(set: WorkoutSet) {
    await this.write(['sets'], () => this.putTracked('sets', [{ ...set, updatedAt: Date.now() }]))
    this.changed()
  }
  async deleteSet(id: string) {
    await this.write(['sets'], async () => this.deleteTracked('sets', await this.db.sets.where('id').equals(id).toArray()))
    this.changed()
  }

  // Import / export
  async exportProfile(profileId: string): Promise<ExportData> {
    const d = this.db
    const profile = await d.profiles.get(profileId)
    if (!profile) throw new Error('Profile not found')
    const [exercises, templates, sessions, sessionExercises, sets] = await Promise.all([
      d.exercises.where('profileId').equals(profileId).toArray(),
      d.templates.where('profileId').equals(profileId).toArray(),
      d.sessions.where('profileId').equals(profileId).toArray(),
      d.sessionExercises.where('profileId').equals(profileId).toArray(),
      d.sets.where('profileId').equals(profileId).toArray(),
    ])
    return {
      app: 'heavystuff',
      version: 1,
      exportedAt: Date.now(),
      profile,
      exercises,
      templates,
      sessions,
      sessionExercises,
      sets,
    }
  }

  /**
   * Merges exported data into the given profile. Restoring into the same profile
   * overwrites records with matching ids; importing into another profile gets fresh ids
   * so the source profile's data is never touched.
   */
  async importInto(profileId: string, input: ExportData) {
    if (input?.app !== 'heavystuff' || input.version !== 1) throw new Error('Not a valid Heavystuff backup file')
    const d = this.db
    let data = input
    if (input.profile.id !== profileId) {
      const existing = await d.exercises.where('profileId').equals(profileId).toArray()
      data = remapIds(input, new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id])))
    }
    // Bump updatedAt so restored rows win over older copies on the server.
    const now = Date.now()
    const own = <T extends { profileId: string }>(rows: T[]) => rows.map((r) => ({ ...r, profileId, updatedAt: now }))
    // Avoid two active sessions after import.
    const hasActive = await this.getActiveSession(profileId)
    const sessions = own(data.sessions).map((s) =>
      s.status === 'active' && hasActive && hasActive.id !== s.id
        ? { ...s, status: 'done' as const, endedAt: s.endedAt ?? s.startedAt }
        : s,
    )
    await this.write(['exercises', 'templates', 'sessions', 'sessionExercises', 'sets'], async () => {
      await this.putTracked('exercises', own(data.exercises))
      await this.putTracked('templates', own(data.templates))
      await this.putTracked('sessions', sessions)
      await this.putTracked('sessionExercises', own(data.sessionExercises))
      await this.putTracked('sets', own(data.sets))
    })
    this.changed()
  }

  // Sync support (used by src/sync/syncEngine.ts, not part of the UI-facing DataStore contract)

  listOutbox(profileId: string) {
    return this.db.outbox.where('profileId').equals(profileId).toArray()
  }
  countOutbox(profileId: string) {
    return this.db.outbox.where('profileId').equals(profileId).count()
  }
  getRows(table: SyncTable, ids: string[]): Promise<(SyncRecord | undefined)[]> {
    return this.db[table].bulkGet(ids)
  }
  /** Removes pushed outbox entries, unless the row changed again while the push was in flight. */
  async ackOutbox(entries: OutboxEntry[]) {
    await this.db.transaction('rw', this.db.outbox, async () => {
      const current = await this.db.outbox.bulkGet(entries.map((e) => e.key))
      const done = entries.filter((e, i) => current[i]?.token === e.token).map((e) => e.key)
      await this.db.outbox.bulkDelete(done)
    })
  }
  /** Queues every row of a profile for upload (used when moving an existing local profile to the cloud). */
  async enqueueProfile(profileId: string) {
    await this.write([...SYNC_TABLES], async () => {
      await this.track('profiles', [{ id: profileId }])
      for (const t of SYNC_TABLES) {
        if (t !== 'profiles') await this.track(t, await this.db[t].where('profileId').equals(profileId).toArray())
      }
    })
  }
  /** Applies rows/deletions pulled from the server. Rows with unpushed local changes are left alone. */
  async applyRemote(table: SyncTable, rows: SyncRecord[], deletedIds: string[] = []) {
    if (!rows.length && !deletedIds.length) return
    let applied = 0
    await this.write([table], async () => {
      const pending = await this.db.outbox.bulkGet([...rows.map((r) => r.id), ...deletedIds].map((id) => `${table}:${id}`))
      const isPending = new Set(pending.filter(Boolean).map((e) => e!.id))
      const existing = await this.db[table].bulkGet(rows.map((r) => r.id))
      // Skip rows we already have in this version (e.g. our own pushes echoed back).
      const put = rows.filter((r, i) => !isPending.has(r.id) && existing[i]?.updatedAt !== r.updatedAt)
      const del = deletedIds.filter((id) => !isPending.has(id))
      await (this.db[table] as Table<SyncRecord, string>).bulkPut(put)
      await this.db[table].bulkDelete(del)
      applied = put.length + del.length
    })
    if (applied) this.changed()
  }
  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined
  }
  async setMeta(key: string, value: unknown) {
    await this.db.meta.put({ key, value })
  }
  /** Removes a profile's local copy without queuing remote deletes (e.g. on sign-out). */
  async purgeLocalProfile(profileId: string) {
    const d = this.db
    await d.transaction('rw', [...SYNC_TABLES.map((t) => d[t]), d.outbox, d.meta], async () => {
      for (const t of SYNC_TABLES) {
        if (t !== 'profiles') await d[t].where('profileId').equals(profileId).delete()
      }
      await d.profiles.delete(profileId)
      await d.outbox.where('profileId').equals(profileId).delete()
      await d.meta.where('key').startsWith(`cursor:${profileId}:`).delete()
    })
    this.changed()
  }
}

/** Gives all records new ids; exercises matching an existing one by name are merged into it. */
function remapIds(data: ExportData, existingByName: Map<string, string>): ExportData {
  const map = new Map<string, string>()
  const merged = new Set<string>()
  for (const e of data.exercises) {
    const match = existingByName.get(e.name.trim().toLowerCase())
    if (match) {
      map.set(e.id, match)
      merged.add(e.id)
    }
  }
  const id = (old: string) => {
    let n = map.get(old)
    if (!n) map.set(old, (n = newId()))
    return n
  }
  const optId = (old: string | null) => (old ? id(old) : null)
  return {
    ...data,
    exercises: data.exercises.filter((e) => !merged.has(e.id)).map((e) => ({ ...e, id: id(e.id) })),
    templates: data.templates.map((t) => ({ ...t, id: id(t.id), exerciseIds: t.exerciseIds.map(id) })),
    sessions: data.sessions.map((s) => ({ ...s, id: id(s.id), templateId: optId(s.templateId) })),
    sessionExercises: data.sessionExercises.map((se) => ({
      ...se,
      id: id(se.id),
      sessionId: id(se.sessionId),
      exerciseId: id(se.exerciseId),
    })),
    sets: data.sets.map((s) => ({
      ...s,
      id: id(s.id),
      sessionId: id(s.sessionId),
      sessionExerciseId: id(s.sessionExerciseId),
      exerciseId: id(s.exerciseId),
    })),
  }
}
