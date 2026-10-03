import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DexieStore } from './dexieStore'

describe('DexieStore', () => {
  it('creates profile with presets, records sets, exports and imports into another profile', async () => {
    const store = new DexieStore(`test-${Math.random()}`)
    let changes = 0
    store.subscribe(() => changes++)

    const p = await store.createProfile('Dan')
    const exercises = await store.listExercises(p.id)
    expect(exercises.length).toBeGreaterThan(30)
    const bench = exercises.find((e) => e.name === 'Bench Press')!

    const now = Date.now()
    const base = { profileId: p.id, createdAt: now, updatedAt: now }
    await store.saveSession({ ...base, id: 's1', name: 'Push', notes: '', status: 'active', startedAt: now, endedAt: null, templateId: null })
    expect((await store.getActiveSession(p.id))?.id).toBe('s1')
    await store.saveSessionExercises([{ ...base, id: 'se1', sessionId: 's1', exerciseId: bench.id, order: 0 }])
    await store.saveSet({
      ...base, id: 'x1', sessionId: 's1', sessionExerciseId: 'se1', exerciseId: bench.id, order: 0,
      weight: 80, reps: 5, rpe: 8, rir: null, isWarmup: false, isDropSet: false, toFailure: false, notes: '', completedAt: now,
    })
    expect(await store.listSetsForExercise(p.id, bench.id)).toHaveLength(1)
    expect(changes).toBeGreaterThan(0)

    const backup = await store.exportProfile(p.id)
    const p2 = await store.createProfile('Other')
    await store.importInto(p2.id, backup)
    const p2Bench = (await store.listExercises(p2.id)).filter((e) => e.name === 'Bench Press')
    expect(p2Bench).toHaveLength(1) // merged by name, not duplicated
    expect(await store.listSetsForExercise(p2.id, p2Bench[0].id)).toHaveLength(1)
    expect(await store.listSetsForExercise(p.id, bench.id)).toHaveLength(1) // source untouched

    await store.deleteSession('s1')
    expect(await store.listSetsForSession('s1')).toHaveLength(0)
    expect(await store.getActiveSession(p.id)).toBeUndefined()
  })
})
