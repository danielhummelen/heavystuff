import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { store, type Template } from '../data'
import { useQuery } from '../data/useQuery'
import { ExercisePicker } from '../components/ExercisePicker'
import { PageHeader } from '../components/Layout'
import { startSession } from '../lib/sessionOps'
import { useProfile } from '../state/ProfileContext'

export function TemplateEditPage() {
  const { id = '' } = useParams()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const data = useQuery(async () => {
    const [template, exercises] = await Promise.all([store.getTemplate(id), store.listExercises(profile.id)])
    return { template: template ?? null, exercises: new Map(exercises.map((e) => [e.id, e])) }
  }, [id, profile.id])

  if (!data) return null
  if (!data.template) return <Navigate to="/settings/templates" replace />
  const t = data.template
  const save = (patch: Partial<Template>) => store.saveTemplate({ ...t, ...patch })
  const move = (i: number, dir: -1 | 1) => {
    const ids = [...t.exerciseIds]
    ;[ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]
    void save({ exerciseIds: ids })
  }

  const start = async () => {
    const active = await store.getActiveSession(profile.id)
    if (active) return alert('Finish or discard your current workout first.')
    await startSession(profile, t)
    navigate('/')
  }

  const remove = async () => {
    if (!confirm(`Delete template “${t.name}”?`)) return
    await store.deleteTemplate(t.id)
    navigate('/settings/templates', { replace: true })
  }

  return (
    <>
      <PageHeader title="Template" back />
      <div className="card">
        <input
          className="title-input"
          defaultValue={t.name}
          key={t.name}
          aria-label="Template name"
          onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && save({ name: e.target.value.trim() })}
        />
        <ol className="list">
          {t.exerciseIds.map((exId, i) => (
            <li key={exId} className="list-item static">
              <span>
                {i + 1}. {data.exercises.get(exId)?.name ?? 'Deleted exercise'}
              </span>
              <span className="row">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button className="icon-btn" disabled={i === t.exerciseIds.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </button>
                <button className="icon-btn" onClick={() => save({ exerciseIds: t.exerciseIds.filter((x) => x !== exId) })} aria-label="Remove">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
        {!t.exerciseIds.length && <p className="muted small">No exercises yet.</p>}
        <button className="btn block" onClick={() => setPicking(true)}>
          + Add exercise
        </button>
      </div>
      <button className="btn primary block big" onClick={start} disabled={!t.exerciseIds.length}>
        ▶ Start workout from template
      </button>
      <button className="btn danger block" onClick={remove}>
        Delete template
      </button>
      {picking && (
        <ExercisePicker
          profileId={profile.id}
          excludeIds={t.exerciseIds}
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setPicking(false)
            void save({ exerciseIds: [...t.exerciseIds, ex.id] })
          }}
        />
      )}
    </>
  )
}
