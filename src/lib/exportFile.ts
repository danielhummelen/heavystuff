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
