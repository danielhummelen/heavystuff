import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { store, type Session } from '../data'
import { useQuery } from '../data/useQuery'
import { formatDate, formatDuration, formatNumber, formatTime } from '../lib/format'
import { findPRs, sessionVolume } from '../lib/stats'
import { SetTags, setText } from './SetLabel'

/** Read-only overview of a finished session. */
export function SessionSummary({ session }: { session: Session }) {
  const data = useQuery(async () => {
    const [ses, sets, exercises] = await Promise.all([
      store.listSessionExercises(session.id),
      store.listSetsForSession(session.id),
      store.listExercises(session.profileId),
    ])
    const history = await Promise.all(ses.map((se) => store.listSetsForExercise(session.profileId, se.exerciseId)))
    return { ses, sets, exercises: new Map(exercises.map((e) => [e.id, e])), history: history.flat() }
  }, [session.id, session.profileId, session.updatedAt])

  const prs = useMemo(() => {
    if (!data) return new Map()
    const byExercise = new Map<string, typeof data.history>()
    for (const s of data.history) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
    return new Map([...byExercise.values()].flatMap((list) => [...findPRs(list)]))
  }, [data])

  if (!data) return null
  const workingSets = data.sets.filter((s) => !s.isWarmup).length

  return (
    <div className="session">
      <div className="card">
        <h2 className="summary-title">{session.name}</h2>
        <p className="muted small summary-meta">
          {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
          {session.endedAt ? ` – ${formatTime(session.endedAt)} (${formatDuration(session.endedAt - session.startedAt)})` : ''}
        </p>
        <div className="records">
          <div className="record">
            <span className="muted small">Working sets</span>
            <strong>{workingSets}</strong>
          </div>
          <div className="record">
            <span className="muted small">Volume</span>
            <strong>{formatNumber(sessionVolume(data.sets), 0)} kg</strong>
          </div>
        </div>
        {session.notes && <p className="session-notes">{session.notes}</p>}
      </div>

      {data.ses.length === 0 && <p className="muted center">No exercises recorded.</p>}

      {data.ses.map((se) => {
        const exercise = data.exercises.get(se.exerciseId)
        if (!exercise) return null
        const sets = data.sets.filter((s) => s.sessionExerciseId === se.id)
        let workingNo = 0
        return (
          <section key={se.id} className="card">
            <header className="card-header">
              <div>
                <h3>{exercise.name}</h3>
                <Link to={`/exercise/${exercise.id}`} className="muted small">
                  {exercise.category} · History & chart ›
                </Link>
              </div>
            </header>
            {sets.length === 0 ? (
              <p className="muted small">No sets recorded.</p>
            ) : (
              <ol className="set-list">
                {sets.map((s) => (
                  <li key={s.id} className="set-row static">
                    <span className={`set-no ${s.isWarmup ? 'warm' : ''}`}>{s.isWarmup ? 'W' : ++workingNo}</span>
                    <span className="set-main">{setText(s, exercise)}</span>
                    <span className="set-tags">
                      <SetTags set={s} pr={prs.get(s.id)} />
                    </span>
                    {s.notes && <span className="set-notes muted small">{s.notes}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}
