import { describe, expect, it } from 'vitest'
import type { WorkoutSet } from '../data/types'
import { e1rm, findPRs, sessionSeries } from './stats'

let n = 0
const set = (p: Partial<WorkoutSet>): WorkoutSet => ({
  id: `s${++n}`,
  profileId: 'p',
  sessionId: 'a',
  sessionExerciseId: 'se',
  exerciseId: 'e',
  order: 0,
  weight: 100,
  reps: 5,
  rpe: null,
  rir: null,
  isWarmup: false,
  isDropSet: false,
  toFailure: false,
  notes: '',
  completedAt: n,
  createdAt: 0,
  updatedAt: 0,
  ...p,
})

describe('stats', () => {
  it('computes Epley e1RM', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
    expect(e1rm(100, 0)).toBe(0)
  })

  it('builds per-session series ignoring warm-ups', () => {
    const sets = [
      set({ sessionId: 'a', weight: 40, reps: 10, isWarmup: true }),
      set({ sessionId: 'a', weight: 100, reps: 5 }),
      set({ sessionId: 'a', weight: 100, reps: 3 }),
      set({ sessionId: 'b', weight: 105, reps: 5 }),
    ]
    const series = sessionSeries(sets, new Map([['a', 1], ['b', 2]]))
    expect(series).toHaveLength(2)
    expect(series[0]).toMatchObject({ sessionId: 'a', maxWeight: 100, volume: 800, bestReps: 5 })
    expect(series[1].maxWeight).toBe(105)
  })

  it('flags PRs only when beating earlier working sets', () => {
    const a = set({ weight: 100, reps: 5 })
    const b = set({ weight: 100, reps: 4 })
    const c = set({ weight: 110, reps: 1 })
    const w = set({ weight: 200, reps: 1, isWarmup: true })
    const d = set({ weight: 100, reps: 8 })
    const prs = findPRs([a, b, c, w, d])
    expect(prs.has(a.id)).toBe(false)
    expect(prs.has(b.id)).toBe(false)
    expect(prs.get(c.id)).toEqual({ e1rm: false, weight: true })
    expect(prs.has(w.id)).toBe(false)
    expect(prs.get(d.id)).toEqual({ e1rm: true, weight: false })
  })
})
