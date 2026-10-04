import { useMemo, useState } from 'react'
import { CATEGORIES, store, type Exercise } from '../data'
import { useQuery } from '../data/useQuery'
import { ExerciseForm } from './ExerciseForm'
import { Modal } from './Modal'

interface Props {
  profileId: string
  onPick: (exercise: Exercise) => void
  onClose: () => void
  excludeIds?: string[]
}

export function ExercisePicker({ profileId, onPick, onClose, excludeIds = [] }: Props) {
  const exercises = useQuery(() => store.listExercises(profileId), [profileId])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (exercises ?? []).filter(
      (e) =>
        !e.archived &&
        !excludeIds.includes(e.id) &&
        (!category || e.category === category) &&
        (!q || e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)),
    )
  }, [exercises, query, category, excludeIds])

  const grouped = CATEGORIES.map((c) => [c, filtered.filter((e) => e.category === c)] as const).filter(([, l]) => l.length)

  if (creating)
    return (
      <Modal title="New exercise" onClose={onClose}>
        <ExerciseForm profileId={profileId} initialName={query} onSaved={onPick} onCancel={() => setCreating(false)} />
      </Modal>
    )

  return (
    <Modal title="Add exercise" onClose={onClose} tall>
      <input className="search" type="search" placeholder="Search exercises…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips">
        <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory(null)}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(category === c ? null : c)}>
            {c}
          </button>
        ))}
      </div>
      <button className="btn block" onClick={() => setCreating(true)}>
        + Create {query.trim() ? `“${query.trim()}”` : 'custom exercise'}
      </button>
      {grouped.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="group-title">{cat}</h3>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id}>
                <button className="list-item" onClick={() => onPick(e)}>
                  <span>{e.name}</span>
                  <span className="muted small">{e.equipment}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {exercises && !filtered.length && <p className="muted center">No exercises found.</p>}
    </Modal>
  )
}
