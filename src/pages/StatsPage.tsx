import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../data'
import { useQuery } from '../data/useQuery'
import { ExerciseChart, MetricTabs } from '../components/ExerciseChart'
import { PageHeader } from '../components/Layout'
import { RecordsGrid } from '../components/RecordsGrid'
import { formatNumber } from '../lib/format'
import { personalRecords, sessionSeries, sessionVolume, type Metric } from '../lib/stats'
import { useProfile } from '../state/ProfileContext'

const STAT_KEY = 'heavystuff.stats.exercise'

export function StatsPage() {
  const { profile } = useProfile()
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [selected, setSelected] = useState<string | null>(() => localStorage.getItem(STAT_KEY))

  const data = useQuery(async () => {
    const [sessions, sets, exercises] = await Promise.all([
      store.listSessions(profile.id),
      store.listSetsForProfile(profile.id),
      store.listExercises(profile.id),
    ])
    return { sessions, sets: sets.sort((a, b) => a.completedAt - b.completedAt), exercises }
  }, [profile.id])

  const view = useMemo(() => {
    if (!data) return null
    const lastUsed = new Map<string, number>()
    const setCount = new Map<string, number>()
    for (const s of data.sets) {
      lastUsed.set(s.exerciseId, Math.max(lastUsed.get(s.exerciseId) ?? 0, s.completedAt))
      setCount.set(s.exerciseId, (setCount.get(s.exerciseId) ?? 0) + 1)
    }
    const used = data.exercises.filter((e) => lastUsed.has(e.id)).sort((a, b) => lastUsed.get(b.id)! - lastUsed.get(a.id)!)
    const weekAgo = Date.now() - 7 * 864e5
    const monthAgo = Date.now() - 30 * 864e5
    const done = data.sessions.filter((s) => s.status === 'done')
    return {
      used,
      setCount,
      sessionDates: new Map(data.sessions.map((s) => [s.id, s.startedAt])),
      total: done.length,
      week: done.filter((s) => s.startedAt >= weekAgo).length,
      monthVolume: sessionVolume(data.sets.filter((s) => s.completedAt >= monthAgo)),
    }
  }, [data])

  if (!data || !view) return null
  const exercise = view.used.find((e) => e.id === selected) ?? view.used[0]
  const exSets = exercise ? data.sets.filter((s) => s.exerciseId === exercise.id) : []
  const series = sessionSeries(exSets, view.sessionDates)

  return (
    <>
      <PageHeader title="Stats" />
      <div className="records">
        <div className="record">
          <span className="muted small">Workouts</span>
          <strong>{view.total}</strong>
        </div>
        <div className="record">
          <span className="muted small">Last 7 days</span>
          <strong>{view.week}</strong>
        </div>
        <div className="record wide">
          <span className="muted small">Volume, last 30 days</span>
          <strong>{formatNumber(view.monthVolume, 0)} kg</strong>
        </div>
      </div>

      {!exercise ? (
        <p className="muted center">Record some sets to see your trends.</p>
      ) : (
        <section className="card">
          <select
            className="title-select"
            value={exercise.id}
            onChange={(e) => {
              setSelected(e.target.value)
              localStorage.setItem(STAT_KEY, e.target.value)
            }}
            aria-label="Exercise"
          >
            {view.used.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <MetricTabs value={metric} onChange={setMetric} />
          <ExerciseChart points={series} metric={metric} />
          <RecordsGrid records={personalRecords(exSets, series)} exercise={exercise} />
          <Link to={`/exercise/${exercise.id}`} className="btn block">
            Full history ›
          </Link>
        </section>
      )}

      {view.used.length > 0 && (
        <section className="card">
          <h2>Exercises</h2>
          <ul className="list">
            {view.used.map((e) => (
              <li key={e.id}>
                <Link className="list-item" to={`/exercise/${e.id}`}>
                  <span>{e.name}</span>
                  <span className="muted small">{view.setCount.get(e.id)} sets ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
