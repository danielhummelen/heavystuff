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

class HeavyDB extends Dexie {
  profiles!: Table<Profile, string>
  exercises!: Table<Exercise, string>
  templates!: Table<Template, string>
  sessions!: Table<Session, string>
  sessionExercises!: Table<SessionExercise, string>
  sets!: Table<WorkoutSet, string>

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
    await this.db.transaction('rw', this.db.profiles, this.db.exercises, async () => {
      await this.db.profiles.add(profile)
      await this.db.exercises.bulkAdd(exercises)
    })
    this.changed()
    return profile
  }
  async saveProfile(profile: Profile) {
    await this.db.profiles.put({ ...profile, updatedAt: Date.now() })
    this.changed()
  }
  async deleteProfile(id: string) {
    const d = this.db
    await d.transaction('rw', [d.profiles, d.exercises, d.templates, d.sessions, d.sessionExercises, d.sets], async () => {
      await d.sets.where('profileId').equals(id).delete()
      await d.sessionExercises.where('profileId').equals(id).delete()
      await d.sessions.where('profileId').equals(id).delete()
      await d.templates.where('profileId').equals(id).delete()
      await d.exercises.where('profileId').equals(id).delete()
      await d.profiles.delete(id)
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
    await this.db.exercises.put({ ...exercise, updatedAt: Date.now() })
    this.changed()
  }
  async deleteExercise(id: string) {
    await this.db.exercises.delete(id)
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
    await this.db.templates.put({ ...template, updatedAt: Date.now() })
    this.changed()
  }
  async deleteTemplate(id: string) {
    await this.db.templates.delete(id)
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
    await this.db.sessions.put({ ...session, updatedAt: Date.now() })
    this.changed()
  }
  async deleteSession(id: string) {
    const d = this.db
    await d.transaction('rw', d.sessions, d.sessionExercises, d.sets, async () => {
      await d.sets.where('sessionId').equals(id).delete()
      await d.sessionExercises.where('sessionId').equals(id).delete()
      await d.sessions.delete(id)
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
    await this.db.sessionExercises.bulkPut(items.map((i) => ({ ...i, updatedAt: now })))
    this.changed()
  }
  async deleteSessionExercise(id: string) {
    const d = this.db
    await d.transaction('rw', d.sessionExercises, d.sets, async () => {
      await d.sets.where('sessionExerciseId').equals(id).delete()
      await d.sessionExercises.delete(id)
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
    await this.db.sets.put({ ...set, updatedAt: Date.now() })
    this.changed()
  }
  async deleteSet(id: string) {
    await this.db.sets.delete(id)
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
    const own = <T extends { profileId: string }>(rows: T[]) => rows.map((r) => ({ ...r, profileId }))
    // Avoid two active sessions after import.
    const hasActive = await this.getActiveSession(profileId)
    const sessions = own(data.sessions).map((s) =>
      s.status === 'active' && hasActive && hasActive.id !== s.id
        ? { ...s, status: 'done' as const, endedAt: s.endedAt ?? s.startedAt }
        : s,
    )
    await d.transaction('rw', [d.exercises, d.templates, d.sessions, d.sessionExercises, d.sets], async () => {
      await d.exercises.bulkPut(own(data.exercises))
      await d.templates.bulkPut(own(data.templates))
      await d.sessions.bulkPut(sessions)
      await d.sessionExercises.bulkPut(own(data.sessionExercises))
      await d.sets.bulkPut(own(data.sets))
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
