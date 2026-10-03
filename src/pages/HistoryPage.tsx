import { Link } from 'react-router-dom'
import { store } from '../data'
import { useQuery } from '../data/useQuery'
import { PageHeader } from '../components/Layout'
import { formatDate, formatDuration, formatNumber, formatTime } from '../lib/format'
import { sessionVolume } from '../lib/stats'
import { useProfile } from '../state/ProfileContext'

export function HistoryPage() {
  const { profile } = useProfile()
  const data = useQuery(async () => {
    const [sessions, sets, exercises] = await Promise.all([
      store.listSessions(profile.id),
      store.listSetsForProfile(profile.id),
      store.listExercises(profile.id),
    ])
    const names = new Map(exercises.map((e) => [e.id, e.name]))
    return sessions.map((s) => {
      const own = sets.filter((x) => x.sessionId === s.id)
      const exNames = [...new Set(own.map((x) => x.exerciseId))].map((id) => names.get(id) ?? '?')
      return { session: s, sets: own.filter((x) => !x.isWarmup).length, volume: sessionVolume(own), exNames }
    })
  }, [profile.id])

  if (!data) return null

  const groups = new Map<string, typeof data>()
  for (const row of data) {
    const key = new Date(row.session.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  return (
    <>
      <PageHeader title="History" />
      {data.length === 0 && <p className="muted center">No workouts yet.</p>}
      {[...groups].map(([month, rows]) => (
        <section key={month}>
          <h3 className="group-title">{month}</h3>
          {rows.map(({ session: s, sets, volume, exNames }) => (
            <Link key={s.id} to={s.status === 'active' ? '/' : `/history/${s.id}`} className="card session-item">
              <div className="row between">
                <strong>{s.name}</strong>
                {s.status === 'active' ? <span className="tag live">In progress</span> : <span className="muted small">{formatTime(s.startedAt)}</span>}
              </div>
              <div className="muted small">
                {formatDate(s.startedAt)}
                {s.endedAt ? ` · ${formatDuration(s.endedAt - s.startedAt)}` : ''} · {sets} sets · {formatNumber(volume, 0)} kg
              </div>
              {exNames.length > 0 && <div className="small ellipsis">{exNames.join(', ')}</div>}
            </Link>
          ))}
        </section>
      ))}
    </>
  )
}
