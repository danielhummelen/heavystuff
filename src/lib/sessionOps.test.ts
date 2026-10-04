import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { store } from '../data'
import { AUTO_FINISH_AFTER_MS, addExerciseToSession, autoFinishStaleSession, startSession } from './sessionOps'

describe('autoFinishStaleSession', () => {
  it('finishes an inactive session at its last set, and discards an inactive empty one', async () => {
    const profile = await store.createProfile('Dan')
    const bench = (await store.listExercises(profile.id))[0]

    const session = await startSession(profile)
    const seId = await addExerciseToSession(session, bench.id)
    const lastSet = session.startedAt + 10 * 60 * 1000
    const now = Date.now()
    await store.saveSet({
      id: 'x1', profileId: profile.id, sessionId: session.id, sessionExerciseId: seId, exerciseId: bench.id, order: 0,
      weight: 80, reps: 5, rpe: null, rir: null, isWarmup: false, isDropSet: false, toFailure: false, notes: '',
      completedAt: lastSet, createdAt: now, updatedAt: now,
    })

    expect(await autoFinishStaleSession(profile.id, lastSet + AUTO_FINISH_AFTER_MS - 1)).toBeNull()
    expect(await autoFinishStaleSession(profile.id, lastSet + AUTO_FINISH_AFTER_MS)).toBe('finished')
    expect(await store.getActiveSession(profile.id)).toBeUndefined()
    const done = (await store.listSessions(profile.id)).find((s) => s.id === session.id)!
    expect(done).toMatchObject({ status: 'done', endedAt: lastSet })

    const empty = await startSession(profile)
    expect(await autoFinishStaleSession(profile.id, empty.startedAt + AUTO_FINISH_AFTER_MS)).toBe('discarded')
    expect(await store.getActiveSession(profile.id)).toBeUndefined()
    expect((await store.listSessions(profile.id)).some((s) => s.id === empty.id)).toBe(false)
  })
})
