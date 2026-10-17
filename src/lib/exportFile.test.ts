import { describe, expect, it } from 'vitest'
import type { ExportData } from '../data'
import { sessionExport, slug, toCsv } from './exportFile'

const base = { profileId: 'p', createdAt: 0, updatedAt: 0 }
const set = (id: string, sessionId: string, exerciseId: string) => ({
  ...base,
  id,
  sessionId,
  exerciseId,
  sessionExerciseId: `${sessionId}-${exerciseId}`,
  order: 0,
  weight: 100,
  reps: 5,
  completedAt: 1,
})

const data = {
  app: 'heavystuff',
  version: 1,
  exportedAt: 0,
  profile: { id: 'p', name: 'Me' },
  exercises: [
    { ...base, id: 'e1', name: 'Bench', category: 'Chest' },
    { ...base, id: 'e2', name: 'Squat', category: 'Legs' },
  ],
  templates: [{ ...base, id: 't1', name: 'Push' }],
  sessions: [
    { ...base, id: 's1', name: 'Push', notes: '', status: 'done', startedAt: 0, endedAt: 1, templateId: 't1' },
    { ...base, id: 's2', name: 'Legs', notes: '', status: 'done', startedAt: 0, endedAt: 1, templateId: null },
  ],
  sessionExercises: [
    { ...base, id: 's1-e1', sessionId: 's1', exerciseId: 'e1', order: 0 },
    { ...base, id: 's2-e2', sessionId: 's2', exerciseId: 'e2', order: 0 },
  ],
  sets: [set('a', 's1', 'e1'), set('b', 's2', 'e2'), set('c', 's1', 'e1')],
} as unknown as ExportData

describe('sessionExport', () => {
  it('keeps only the given session and its exercises', () => {
    const out = sessionExport(data, 's1')
    expect(out.sessions.map((s) => s.id)).toEqual(['s1'])
    expect(out.sessions[0].templateId).toBeNull()
    expect(out.sessionExercises.map((s) => s.id)).toEqual(['s1-e1'])
    expect(out.sets.map((s) => s.id)).toEqual(['a', 'c'])
    expect(out.exercises.map((e) => e.id)).toEqual(['e1'])
    expect(out.templates).toEqual([])
    expect(toCsv(out).split('\n')).toHaveLength(3)
  })
})

describe('slug', () => {
  it('makes filename-safe names', () => {
    expect(slug('Push day #2!')).toBe('push-day-2')
    expect(slug('***')).toBe('session')
  })
})
