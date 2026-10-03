import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { store, type WorkoutSet } from '../data'
import { useQuery } from '../data/useQuery'
import { ExerciseChart, MetricTabs } from '../components/ExerciseChart'
import { ExerciseForm } from '../components/ExerciseForm'
import { PageHeader } from '../components/Layout'
import { Modal } from '../components/Modal'
import { RecordsGrid } from '../components/RecordsGrid'
import { SetTags, setText } from '../components/SetLabel'
import { formatDate, formatNumber } from '../lib/format'
import { findPRs, personalRecords, sessionSeries, type Metric } from '../lib/stats'
import { useProfile } from '../state/ProfileContext'

export function ExerciseDetailPage() {
  const { id = '' } = useParams()
  const { profile } = useProfile()
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [editing, setEditing] = useState(false)

  const data = useQuery(async () => {
    const [exercise, sets, sessions] = await Promise.all([
      store.getExercise(id),
      store.listSetsForExercise(profile.id, id),
      store.listSessions(profile.id),
    ])
    return { exercise: exercise ?? null, sets, sessions: new Map(sessions.map((s) => [s.id, s])) }
  }, [id, profile.id])

  const derived = useMemo(() => {
    if (!data) return null
    const dates = new Map([...data.sessions].map(([k, s]) => [k, s.startedAt]))
    const series = sessionSeries(data.sets, dates)
    const groups = new Map<string, WorkoutSet[]>()
    for (const s of data.sets) groups.set(s.sessionId, [...(groups.get(s.sessionId) ?? []), s])
    const bySession = [...groups].sort((a, b) => (dates.get(b[0]) ?? 0) - (dates.get(a[0]) ?? 0))
    return { series, prs: findPRs(data.sets), bySession, records: personalRecords(data.sets, series) }
  }, [data])

  if (!data || !derived) return null
  if (!data.exercise) return <Navigate to="/stats" replace />
  const ex = data.exercise

  return (
    <>
      <PageHeader
        title={ex.name}
        back
        action={
          <button className="link-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        }
      />
      <p className="muted small page-sub">
        {ex.category} · {ex.equipment}
        {ex.defaultRestSec != null && ` · rest ${ex.defaultRestSec}s`}
      </p>

      <section className="card">
        <MetricTabs value={metric} onChange={setMetric} />
        <ExerciseChart points={derived.series} metric={metric} />
        <RecordsGrid records={derived.records} exercise={ex} />
      </section>

      <h3 className="group-title">History</h3>
      {derived.bySession.length === 0 && <p className="muted center">No sets recorded yet.</p>}
      {derived.bySession.map(([sessionId, sets]) => {
        const session = data.sessions.get(sessionId)
        const point = derived.series.find((p) => p.sessionId === sessionId)
        return (
          <Link key={sessionId} to={session?.status === 'active' ? '/' : `/history/${sessionId}`} className="card session-item">
            <div className="row between">
              <strong>{session ? formatDate(session.startedAt) : 'Unknown session'}</strong>
              {point && <span className="muted small">{formatNumber(point.volume, 0)} kg</span>}
            </div>
            {session && <div className="muted small">{session.name}</div>}
            <ol className="history-sets">
              {sets.map((s) => (
                <li key={s.id}>
                  <span>{setText(s, ex)}</span> <SetTags set={s} pr={derived.prs.get(s.id)} />
                  {s.notes && <span className="muted small"> — {s.notes}</span>}
                </li>
              ))}
            </ol>
          </Link>
        )
      })}

      {editing && (
        <Modal title="Edit exercise" onClose={() => setEditing(false)}>
          <ExerciseForm profileId={profile.id} initial={ex} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </Modal>
      )}
    </>
  )
}
