import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store, type Session } from '../data'
import { useQuery } from '../data/useQuery'
import { formatDuration, formatNumber, fromLocalInput, toLocalInput } from '../lib/format'
import { addExerciseToSession, finishSession, saveSessionAsTemplate } from '../lib/sessionOps'
import { sessionVolume } from '../lib/stats'
import { useProfile } from '../state/ProfileContext'
import { useRestTimer } from '../state/RestTimer'
import { Elapsed } from './Elapsed'
import { ExerciseCard } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'

export function SessionEditor({ session }: { session: Session }) {
  const { profile } = useProfile()
  const rest = useRestTimer()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [showNotes, setShowNotes] = useState(!!session.notes)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const isActive = session.status === 'active'

  const data = useQuery(async () => {
    const [ses, sets, exercises] = await Promise.all([
      store.listSessionExercises(session.id),
      store.listSetsForSession(session.id),
      store.listExercises(profile.id),
    ])
    return { ses, sets, exercises: new Map(exercises.map((e) => [e.id, e])) }
  }, [session.id, profile.id])

  const save = (patch: Partial<Session>) => store.saveSession({ ...session, ...patch })

  const changeStart = async (value: string) => {
    const startedAt = fromLocalInput(value)
    if (startedAt == null || startedAt === session.startedAt) return
    const delta = startedAt - session.startedAt
    // Shift sets and end time so ordering/duration are preserved.
    await Promise.all((data?.sets ?? []).map((s) => store.saveSet({ ...s, completedAt: s.completedAt + delta })))
    await save({ startedAt, endedAt: session.endedAt != null ? session.endedAt + delta : null })
  }

  const changeEnd = (value: string) => {
    const endedAt = fromLocalInput(value)
    if (endedAt == null) return
    if (endedAt < session.startedAt) return alert('End time must be after start time')
    void save({ endedAt })
  }

  const finish = async () => {
    if (!data?.sets.length) {
      if (confirm('No sets recorded. Discard this session?')) return discard(true)
      return
    }
    if (!confirm('Finish this workout?')) return
    await finishSession(session)
    rest.stop()
    navigate(`/history/${session.id}`)
  }

  const discard = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm(isActive ? 'Discard this workout? All its sets will be deleted.' : 'Delete this session permanently?')) return
    await store.deleteSession(session.id)
    if (isActive) rest.stop()
    navigate(isActive ? '/' : '/history')
  }

  const saveTemplate = async () => {
    if (!data?.ses.length) return alert('Add some exercises first')
    const name = prompt('Template name', session.name)
    if (!name?.trim()) return
    await saveSessionAsTemplate(session, name.trim())
    alert('Template saved')
  }

  // In an active session only one exercise is "open" for logging; default to the one with the latest set.
  const focusId = (() => {
    if (!isActive || !data?.ses.length) return null
    if (focusedId && data.ses.some((s) => s.id === focusedId)) return focusedId
    const latest = data.sets.reduce<(typeof data.sets)[number] | null>((a, s) => (!a || s.completedAt > a.completedAt ? s : a), null)
    return latest?.sessionExerciseId ?? data.ses[0].id
  })()

  const totalSets = data?.sets.filter((s) => !s.isWarmup).length ?? 0
  const volume = data ? sessionVolume(data.sets) : 0

  return (
    <div className="session">
      <div className="card session-head">
        <input
          className="title-input"
          defaultValue={session.name}
          key={session.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== session.name && save({ name: e.target.value.trim() })}
          aria-label="Session name"
        />
        {isActive ? (
          <div className="row between">
            <span className="big-timer">
              <Elapsed since={session.startedAt} />
            </span>
            <button className="btn primary" onClick={finish}>
              Finish
            </button>
          </div>
        ) : (
          <div className="grid-2">
            <label>
              Start
              <input type="datetime-local" key={session.startedAt} defaultValue={toLocalInput(session.startedAt)} onBlur={(e) => changeStart(e.target.value)} />
            </label>
            <label>
              End
              <input
                type="datetime-local"
                key={session.endedAt ?? 0}
                defaultValue={session.endedAt ? toLocalInput(session.endedAt) : ''}
                onBlur={(e) => changeEnd(e.target.value)}
              />
            </label>
          </div>
        )}
        <p className="muted small">
          {totalSets} working sets · {formatNumber(volume, 0)} kg volume
          {!isActive && session.endedAt ? ` · ${formatDuration(session.endedAt - session.startedAt)}` : ''}
        </p>
        {showNotes ? (
          <textarea
            placeholder="Session notes…"
            defaultValue={session.notes}
            rows={2}
            onBlur={(e) => e.target.value !== session.notes && save({ notes: e.target.value })}
          />
        ) : (
          <button className="link-btn" onClick={() => setShowNotes(true)}>
            + Add notes
          </button>
        )}
      </div>

      {data?.ses.map((se, i) => {
        const exercise = data.exercises.get(se.exerciseId)
        if (!exercise) return null
        return (
          <ExerciseCard
            key={se.id}
            session={session}
            se={se}
            exercise={exercise}
            sets={data.sets.filter((s) => s.sessionExerciseId === se.id)}
            isFirst={i === 0}
            isLast={i === data.ses.length - 1}
            collapsed={focusId != null && focusId !== se.id}
            onFocus={() => setFocusedId(se.id)}
          />
        )
      })}

      {data && !data.ses.length && <p className="muted center">Add your first exercise to get started.</p>}

      <button className="btn primary block big" onClick={() => setPicking(true)}>
        + Add exercise
      </button>

      <div className="row gap wrap session-actions">
        <button className="btn" onClick={saveTemplate}>
          Save as template
        </button>
        <button className="btn danger" onClick={() => discard()}>
          {isActive ? 'Discard workout' : 'Delete session'}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          profileId={profile.id}
          excludeIds={data?.ses.map((s) => s.exerciseId)}
          onClose={() => setPicking(false)}
          onPick={async (ex) => {
            setPicking(false)
            setFocusedId(await addExerciseToSession(session, ex.id))
            requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
          }}
        />
      )}
    </div>
  )
}
