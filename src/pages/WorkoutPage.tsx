import { useNavigate } from 'react-router-dom'
import { store, type Template } from '../data'
import { useQuery } from '../data/useQuery'
import { PageHeader } from '../components/Layout'
import { SessionEditor } from '../components/SessionEditor'
import { formatDate } from '../lib/format'
import { createPastSession, startSession } from '../lib/sessionOps'
import { useProfile } from '../state/ProfileContext'

export function WorkoutPage() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const data = useQuery(async () => {
    const [active, templates, sessions, exercises] = await Promise.all([
      store.getActiveSession(profile.id),
      store.listTemplates(profile.id),
      store.listSessions(profile.id),
      store.listExercises(profile.id),
    ])
    return { active, templates, last: sessions.find((s) => s.status === 'done'), exNames: new Map(exercises.map((e) => [e.id, e.name])) }
  }, [profile.id])

  if (!data) return null

  if (data.active)
    return (
      <>
        <PageHeader title="Workout" />
        <SessionEditor session={data.active} />
      </>
    )

  const start = (t?: Template) => startSession(profile, t)
  const logPast = async () => {
    const s = await createPastSession(profile)
    navigate(`/history/${s.id}?edit=1`)
  }

  return (
    <>
      <PageHeader title={`Hi, ${profile.name}`} />
      <button className="btn primary block big" onClick={() => start()}>
        ▶ Start empty workout
      </button>

      <section className="card">
        <div className="row between">
          <h2>Templates</h2>
          <button className="link-btn" onClick={() => navigate('/settings/templates')}>
            Manage
          </button>
        </div>
        {data.templates.length === 0 ? (
          <p className="muted small">No templates yet. Create one (e.g. “Push day”) or save a workout as a template.</p>
        ) : (
          <ul className="list">
            {data.templates.map((t) => (
              <li key={t.id}>
                <button className="list-item" onClick={() => start(t)}>
                  <span>
                    <strong>{t.name}</strong>
                    <span className="muted small block-text">
                      {t.exerciseIds.map((id) => data.exNames.get(id)).filter(Boolean).join(', ') || 'No exercises'}
                    </span>
                  </span>
                  <span className="accent">Start ›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.last && (
        <section className="card">
          <h2>Last workout</h2>
          <button className="list-item" onClick={() => navigate(`/history/${data.last!.id}`)}>
            <span>
              <strong>{data.last.name}</strong>
              <span className="muted small block-text">{formatDate(data.last.startedAt)}</span>
            </span>
            <span className="muted">›</span>
          </button>
        </section>
      )}

      <button className="btn block" onClick={logPast}>
        + Log a past workout
      </button>
    </>
  )
}
