import type { ExportData } from '../data'

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Narrows a profile export to a single session (and only the exercises it uses). */
export function sessionExport(data: ExportData, sessionId: string): ExportData {
  const sessionExercises = data.sessionExercises.filter((se) => se.sessionId === sessionId)
  const sets = data.sets.filter((s) => s.sessionId === sessionId)
  const exerciseIds = new Set([...sessionExercises.map((se) => se.exerciseId), ...sets.map((s) => s.exerciseId)])
  return {
    ...data,
    exercises: data.exercises.filter((e) => exerciseIds.has(e.id)),
    templates: [],
    // Templates aren't included, so drop the link to avoid a dangling reference on import.
    sessions: data.sessions.filter((s) => s.id === sessionId).map((s) => ({ ...s, templateId: null })),
    sessionExercises,
    sets,
  }
}

/** Safe filename fragment, e.g. "Push day #2" → "push-day-2". */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session'

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(data: ExportData): string {
  const sessions = new Map(data.sessions.map((s) => [s.id, s]))
  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const header = ['date', 'session', 'exercise', 'category', 'set', 'weight_kg', 'reps', 'rpe', 'rir', 'warmup', 'drop_set', 'to_failure', 'notes']
  const rows = [...data.sets]
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((s) => {
      const ses = sessions.get(s.sessionId)
      const ex = exercises.get(s.exerciseId)
      return [
        new Date(s.completedAt).toISOString(),
        ses?.name,
        ex?.name,
        ex?.category,
        s.order + 1,
        s.weight,
        s.reps,
        s.rpe,
        s.rir,
        s.isWarmup,
        s.isDropSet,
        s.toFailure,
        s.notes,
      ]
    })
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}
