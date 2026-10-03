import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { store, type Exercise, type Session, type SessionExercise, type WorkoutSet } from '../data'
import { useQuery } from '../data/useQuery'
import { unlockAudio } from '../lib/alerts'
import { formatShortDate } from '../lib/format'
import { newId } from '../lib/id'
import { moveSessionExercise } from '../lib/sessionOps'
import { findPRs } from '../lib/stats'
import { useProfile } from '../state/ProfileContext'
import { useRestTimer } from '../state/RestTimer'
import { SetForm, type SetValues } from './SetForm'
import { SetTags, setText } from './SetLabel'

interface Props {
  session: Session
  se: SessionExercise
  exercise: Exercise
  sets: WorkoutSet[]
  isFirst: boolean
  isLast: boolean
}

export function ExerciseCard({ session, se, exercise, sets, isFirst, isLast }: Props) {
  const { profile } = useProfile()
  const rest = useRestTimer()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const isActive = session.status === 'active'

  const history = useQuery(() => store.listSetsForExercise(profile.id, exercise.id), [profile.id, exercise.id])

  const prs = useMemo(() => findPRs(history ?? []), [history])

  const previous = useMemo(() => {
    const before = (history ?? []).filter((s) => s.sessionId !== session.id && s.completedAt < session.startedAt)
    if (!before.length) return null
    const lastSessionId = before[before.length - 1].sessionId
    const list = before.filter((s) => s.sessionId === lastSessionId)
    return { date: list[0].completedAt, sets: list }
  }, [history, session.id, session.startedAt])

  const prefill = useMemo<Partial<SetValues>>(() => {
    const last = sets[sets.length - 1]
    if (last) return { weight: last.weight, reps: last.reps }
    const prevWorking = previous?.sets.find((s) => !s.isWarmup) ?? previous?.sets[0]
    return prevWorking ? { weight: prevWorking.weight, reps: prevWorking.reps } : {}
  }, [sets, previous])

  const record = async (v: SetValues) => {
    unlockAudio()
    const now = Date.now()
    const order = sets.length ? Math.max(...sets.map((s) => s.order)) + 1 : 0
    await store.saveSet({
      id: newId(),
      profileId: profile.id,
      sessionId: session.id,
      sessionExerciseId: se.id,
      exerciseId: exercise.id,
      order,
      ...v,
      completedAt: isActive ? now : session.startedAt + (se.order * 100 + order) * 1000,
      createdAt: now,
      updatedAt: now,
    })
    if (isActive && profile.settings.autoRestTimer) {
      rest.start(exercise.defaultRestSec ?? profile.settings.defaultRestSec, exercise.name)
    }
  }

  const update = async (s: WorkoutSet, v: SetValues) => {
    await store.saveSet({ ...s, ...v })
    setEditingId(null)
  }

  const remove = async () => {
    if (sets.length && !confirm(`Remove ${exercise.name} and its ${sets.length} set(s) from this session?`)) return
    await store.deleteSessionExercise(se.id)
  }

  let workingNo = 0

  return (
    <section className="card">
      <header className="card-header">
        <div>
          <h3>{exercise.name}</h3>
          <Link to={`/exercise/${exercise.id}`} className="muted small">
            {exercise.category} · History & chart ›
          </Link>
        </div>
        <div className="menu-wrap">
          <button className="icon-btn" aria-label="Exercise options" onClick={() => setMenuOpen(!menuOpen)}>
            ⋯
          </button>
          {menuOpen && (
            <div className="menu" onClick={() => setMenuOpen(false)}>
              {isActive && (
                <button onClick={() => rest.start(exercise.defaultRestSec ?? profile.settings.defaultRestSec, exercise.name)}>
                  Start rest timer
                </button>
              )}
              {!isFirst && <button onClick={() => moveSessionExercise(session.id, se.id, -1)}>Move up</button>}
              {!isLast && <button onClick={() => moveSessionExercise(session.id, se.id, 1)}>Move down</button>}
              <button className="danger-text" onClick={remove}>
                Remove from session
              </button>
            </div>
          )}
        </div>
      </header>

      {previous && (
        <p className="previous small">
          <span className="muted">Last ({formatShortDate(previous.date)}): </span>
          {previous.sets.map((s) => setText(s, exercise) + (s.isWarmup ? ' (W)' : '')).join(' · ')}
        </p>
      )}

      {sets.length > 0 && (
        <ol className="set-list">
          {sets.map((s) => {
            const label = s.isWarmup ? 'W' : String(++workingNo)
            return editingId === s.id ? (
              <li key={s.id} className="editing">
                <SetForm
                  exercise={exercise}
                  initial={s}
                  submitLabel="Save"
                  onSubmit={(v) => update(s, v)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => store.deleteSet(s.id).then(() => setEditingId(null))}
                />
              </li>
            ) : (
              <li key={s.id}>
                <button className="set-row" onClick={() => setEditingId(s.id)} aria-label={`Edit set ${label}`}>
                  <span className={`set-no ${s.isWarmup ? 'warm' : ''}`}>{label}</span>
                  <span className="set-main">{setText(s, exercise)}</span>
                  <span className="set-tags">
                    <SetTags set={s} pr={prs.get(s.id)} />
                  </span>
                  {s.notes && <span className="set-notes muted small">{s.notes}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {!editingId && (
        <SetForm key={`${sets.length}-${history ? 1 : 0}`} exercise={exercise} initial={prefill} submitLabel={`Record set ${sets.length + 1}`} onSubmit={record} />
      )}
    </section>
  )
}
