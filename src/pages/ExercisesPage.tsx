import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, store, type Exercise } from '../data'
import { useQuery } from '../data/useQuery'
import { ExerciseForm } from '../components/ExerciseForm'
import { PageHeader } from '../components/Layout'
import { Modal } from '../components/Modal'
import { useProfile } from '../state/ProfileContext'

export function ExercisesPage() {
  const { profile } = useProfile()
  const exercises = useQuery(() => store.listExercises(profile.id), [profile.id])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  if (!exercises) return null
  const q = query.trim().toLowerCase()
  const filtered = exercises.filter((e) => e.archived === showArchived && (!q || e.name.toLowerCase().includes(q)))

  const remove = async (e: Exercise) => {
    const count = await store.countSetsForExercise(e.id)
    if (count > 0) {
      if (confirm(`${e.name} has ${count} recorded sets, so it can't be deleted. Archive it instead (hidden from pickers)?`))
        await store.saveExercise({ ...e, archived: true })
      return
    }
    if (confirm(`Delete ${e.name}?`)) {
      const templates = await store.listTemplates(profile.id)
      await Promise.all(
        templates.filter((t) => t.exerciseIds.includes(e.id)).map((t) => store.saveTemplate({ ...t, exerciseIds: t.exerciseIds.filter((x) => x !== e.id) })),
      )
      await store.deleteExercise(e.id)
    }
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Exercises"
        back
        action={
          <button className="btn primary" onClick={() => setEditing('new')}>
            + New
          </button>
        }
      />
      <input className="search" type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <label className="check">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
      {CATEGORIES.map((cat) => {
        const list = filtered.filter((e) => e.category === cat)
        if (!list.length) return null
        return (
          <section key={cat}>
            <h3 className="group-title">{cat}</h3>
            <ul className="list card">
              {list.map((e) => (
                <li key={e.id}>
                  <button className="list-item" onClick={() => setEditing(e)}>
                    <span>
                      {e.name}
                      <span className="muted small block-text">
                        {e.equipment}
                        {e.isBodyweight && ' · bodyweight'}
                        {e.defaultRestSec != null && ` · rest ${e.defaultRestSec}s`}
                        {!e.isPreset && ' · custom'}
                      </span>
                    </span>
                    <span className="muted">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {!filtered.length && <p className="muted center">No exercises.</p>}

      {editing && (
        <Modal title={editing === 'new' ? 'New exercise' : 'Edit exercise'} onClose={() => setEditing(null)}>
          <ExerciseForm
            profileId={profile.id}
            initial={editing === 'new' ? undefined : editing}
            initialName={editing === 'new' ? query : ''}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
          {editing !== 'new' && (
            <div className="row gap wrap modal-extra">
              <Link className="btn" to={`/exercise/${editing.id}`}>
                History & chart
              </Link>
              {editing.archived ? (
                <button className="btn" onClick={() => store.saveExercise({ ...editing, archived: false }).then(() => setEditing(null))}>
                  Unarchive
                </button>
              ) : (
                <button className="btn danger" onClick={() => remove(editing)}>
                  Delete / archive
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
