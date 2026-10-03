import type { WorkoutSet } from '../data/types'

/** Estimated one-rep max (Epley). */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export const isWorking = (s: WorkoutSet) => !s.isWarmup

export interface SessionPoint {
  sessionId: string
  date: number
  e1rm: number
  maxWeight: number
  volume: number
  bestReps: number
}

export type Metric = 'e1rm' | 'maxWeight' | 'volume'

export const METRIC_LABELS: Record<Metric, string> = {
  e1rm: 'Est. 1RM',
  maxWeight: 'Max weight',
  volume: 'Volume',
}

/** One data point per session, based on working (non warm-up) sets. Sorted by date. */
export function sessionSeries(sets: WorkoutSet[], sessionDates: Map<string, number>): SessionPoint[] {
  const bySession = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    if (!isWorking(s)) continue
    const list = bySession.get(s.sessionId) ?? []
    list.push(s)
    bySession.set(s.sessionId, list)
  }
  const points: SessionPoint[] = []
  for (const [sessionId, list] of bySession) {
    points.push({
      sessionId,
      date: sessionDates.get(sessionId) ?? Math.min(...list.map((s) => s.completedAt)),
      e1rm: Math.max(...list.map((s) => e1rm(s.weight, s.reps))),
      maxWeight: Math.max(...list.map((s) => s.weight)),
      volume: list.reduce((sum, s) => sum + s.weight * s.reps, 0),
      bestReps: Math.max(...list.map((s) => s.reps)),
    })
  }
  return points.sort((a, b) => a.date - b.date)
}

export interface PRFlags {
  e1rm: boolean
  weight: boolean
}

/**
 * Returns the set ids that were personal records at the time they were performed
 * (higher est. 1RM or heavier weight than every earlier working set).
 * `sets` must be in chronological order.
 */
export function findPRs(sets: WorkoutSet[]): Map<string, PRFlags> {
  const result = new Map<string, PRFlags>()
  let bestE1rm = 0
  let bestWeight = 0
  let seenAny = false
  for (const s of sets) {
    if (!isWorking(s) || s.reps <= 0) continue
    const est = e1rm(s.weight, s.reps)
    const flags = { e1rm: seenAny && est > bestE1rm, weight: seenAny && s.weight > bestWeight }
    if (flags.e1rm || flags.weight) result.set(s.id, flags)
    bestE1rm = Math.max(bestE1rm, est)
    bestWeight = Math.max(bestWeight, s.weight)
    seenAny = true
  }
  return result
}

export interface Records {
  bestE1rm: WorkoutSet | null
  heaviest: WorkoutSet | null
  mostReps: WorkoutSet | null
  bestVolume: SessionPoint | null
}

export function personalRecords(sets: WorkoutSet[], series: SessionPoint[]): Records {
  const working = sets.filter(isWorking)
  const maxBy = <T,>(list: T[], f: (x: T) => number) =>
    list.reduce<T | null>((best, x) => (best === null || f(x) > f(best) ? x : best), null)
  return {
    bestE1rm: maxBy(working, (s) => e1rm(s.weight, s.reps)),
    heaviest: maxBy(working, (s) => s.weight),
    mostReps: maxBy(working, (s) => s.reps),
    bestVolume: maxBy(series, (p) => p.volume),
  }
}

export function sessionVolume(sets: WorkoutSet[]): number {
  return sets.filter(isWorking).reduce((sum, s) => sum + s.weight * s.reps, 0)
}
