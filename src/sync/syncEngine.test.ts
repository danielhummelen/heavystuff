import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DexieStore, type SyncRecord, type SyncTable } from '../data/dexieStore'
import type { WorkoutSet } from '../data/types'
import { fromRow, toRow, type Remote } from './remote'
import { SyncEngine } from './syncEngine'

/** Mimics supabase/migrations: global rev, stale updates ignored, deletes leave tombstones. */
class FakeRemote implements Remote {
  rev = 0
  tables = new Map<SyncTable, Map<string, { row: SyncRecord; rev: number }>>()
  deletions = new Map<string, { table: SyncTable; id: string; rev: number }>()
  fail = false

  private t(table: SyncTable) {
    if (!this.tables.has(table)) this.tables.set(table, new Map())
    return this.tables.get(table)!
  }
  private check() {
    if (this.fail) throw new Error('network down')
  }
  async pull(table: SyncTable, since: number) {
    this.check()
    const list = [...this.t(table).values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev)
    return { rows: list.map((r) => structuredClone(r.row)), revs: list.map((r) => r.rev) }
  }
  async pullDeletions(since: number) {
    this.check()
    return [...this.deletions.values()].filter((d) => d.rev > since).sort((a, b) => a.rev - b.rev)
  }
  async upsert(table: SyncTable, rows: SyncRecord[]) {
    this.check()
    for (const row of rows) {
      const existing = this.t(table).get(row.id)
      if (existing && row.updatedAt < existing.row.updatedAt) continue
      this.t(table).set(row.id, { row: fromRow(table, toRow(table, row)), rev: ++this.rev })
      this.deletions.delete(`${table}:${row.id}`)
    }
  }
  async delete(table: SyncTable, ids: string[]) {
    this.check()
    for (const id of ids) {
      if (this.t(table).delete(id)) this.deletions.set(`${table}:${id}`, { table, id, rev: ++this.rev })
    }
  }
  async getOwnProfileId() {
    return [...this.t('profiles').keys()][0]
  }
  listen() {
    return () => {}
  }
}

const device = () => new DexieStore(`test-${Math.random()}`)

function makeSet(profileId: string, id: string, weight: number): WorkoutSet {
  const now = Date.now()
  return {
    id, profileId, sessionId: 's1', sessionExerciseId: 'se1', exerciseId: 'e1', order: 0, weight, reps: 5,
    rpe: null, rir: null, isWarmup: false, isDropSet: false, toFailure: false, notes: '', completedAt: now,
    createdAt: now, updatedAt: now,
  }
}

describe('remote mapping', () => {
  it('round-trips records through snake_case rows', () => {
    const set = makeSet('p1', 'x', 80)
    const row = toRow('sets', set)
    expect(row).toMatchObject({ profile_id: 'p1', sort_order: 0, session_exercise_id: 'se1', is_drop_set: false })
    expect(fromRow('sets', { ...row, user_id: 'u', rev: 3 })).toEqual(set)
  })
})

describe('SyncEngine', () => {
  it('syncs creates, edits and deletes between two devices', async () => {
    const server = new FakeRemote()
    const a = device()
    const profile = await a.createProfile('Dan')
    const syncA = new SyncEngine(a, server, profile.id)
    expect(await a.countOutbox(profile.id)).toBeGreaterThan(30)
    expect(await syncA.sync()).toBe(true)
    expect(await a.countOutbox(profile.id)).toBe(0)
    expect(server.tables.get('exercises')!.size).toBeGreaterThan(30)

    // New device signs in and pulls everything.
    const b = device()
    expect(await server.getOwnProfileId()).toBe(profile.id)
    const syncB = new SyncEngine(b, server, profile.id)
    await syncB.sync()
    expect((await b.getProfile(profile.id))?.name).toBe('Dan')
    expect(await b.listExercises(profile.id)).toHaveLength((await a.listExercises(profile.id)).length)

    await b.saveSet(makeSet(profile.id, 'x1', 80))
    await syncB.sync()
    await syncA.sync()
    expect((await a.listSetsForProfile(profile.id)).map((s) => s.weight)).toEqual([80])

    await a.deleteSet('x1')
    await syncA.sync()
    expect(server.tables.get('sets')!.has('x1')).toBe(false)
    await syncB.sync()
    expect(await b.listSetsForProfile(profile.id)).toHaveLength(0)
  })

  it('keeps unpushed local edits when pulling and resolves conflicts by last write', async () => {
    const server = new FakeRemote()
    const a = device()
    const profile = await a.createProfile('Dan')
    const syncA = new SyncEngine(a, server, profile.id)
    await a.saveSet(makeSet(profile.id, 'x1', 80))
    await syncA.sync()
    const b = device()
    const syncB = new SyncEngine(b, server, profile.id)
    await syncB.sync()

    // A edits while offline; B edits later and syncs first.
    server.fail = true
    await a.saveSet(makeSet(profile.id, 'x1', 90))
    expect(await syncA.sync()).toBe(false)
    expect(syncA.getState()).toMatchObject({ status: 'error', pending: 1 })
    server.fail = false
    await new Promise((r) => setTimeout(r, 2))
    await b.saveSet(makeSet(profile.id, 'x1', 100))
    await syncB.sync()

    // A's pending edit is not overwritten by the pull before it's pushed...
    await a.applyRemote('sets', [{ ...makeSet(profile.id, 'x1', 100), updatedAt: Date.now() + 1000 }])
    expect((await a.listSetsForProfile(profile.id))[0].weight).toBe(90)
    // ...and once pushed, the newest write (B) wins everywhere.
    await syncA.sync()
    await syncB.sync()
    expect((await a.listSetsForProfile(profile.id))[0].weight).toBe(100)
    expect((await b.listSetsForProfile(profile.id))[0].weight).toBe(100)
    expect(syncA.getState()).toMatchObject({ status: 'idle', pending: 0 })
  })

  it('uploads an existing local profile and purges local data without deleting remotely', async () => {
    const server = new FakeRemote()
    const a = device()
    const profile = await a.createProfile('Legacy')
    await a.saveSet(makeSet(profile.id, 'x1', 80))
    // Simulate data created before sync existed: clear the queue, then enqueue the whole profile.
    await a.ackOutbox(await a.listOutbox(profile.id))
    await a.enqueueProfile(profile.id)
    const sync = new SyncEngine(a, server, profile.id)
    await sync.sync()
    expect(server.tables.get('profiles')!.has(profile.id)).toBe(true)
    expect(server.tables.get('sets')!.has('x1')).toBe(true)

    await a.purgeLocalProfile(profile.id)
    expect(await a.getProfile(profile.id)).toBeUndefined()
    expect(await a.countOutbox(profile.id)).toBe(0)
    expect(server.tables.get('sets')!.has('x1')).toBe(true)

    // Signing in again pulls everything back (cursors were reset by the purge).
    await new SyncEngine(a, server, profile.id).sync()
    expect(await a.listSetsForProfile(profile.id)).toHaveLength(1)
  })
})
