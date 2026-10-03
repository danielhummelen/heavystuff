import { useState } from 'react'
import { CATEGORIES, EQUIPMENT, store, type Category, type Equipment, type Exercise } from '../data'
import { newId } from '../lib/id'

interface Props {
  profileId: string
  initial?: Exercise
  initialName?: string
  onSaved: (exercise: Exercise) => void
  onCancel?: () => void
}

export function ExerciseForm({ profileId, initial, initialName = '', onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? initialName)
  const [category, setCategory] = useState<Category>(initial?.category ?? 'Other')
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'Barbell')
  const [isBodyweight, setBodyweight] = useState(initial?.isBodyweight ?? false)
  const [rest, setRest] = useState(initial?.defaultRestSec != null ? String(initial.defaultRestSec) : '')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Name is required')
    const all = await store.listExercises(profileId)
    if (all.some((x) => x.id !== initial?.id && x.name.toLowerCase() === trimmed.toLowerCase()))
      return setError('An exercise with this name already exists')
    const restNum = parseInt(rest, 10)
    const now = Date.now()
    const ex: Exercise = {
      id: initial?.id ?? newId(),
      profileId,
      name: trimmed,
      category,
      equipment,
      isBodyweight,
      defaultRestSec: Number.isFinite(restNum) && restNum >= 0 ? restNum : null,
      isPreset: initial?.isPreset ?? false,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    await store.saveExercise(ex)
    onSaved(ex)
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!initial} />
      </label>
      <div className="grid-2">
        <label>
          Muscle group
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Equipment
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={isBodyweight} onChange={(e) => setBodyweight(e.target.checked)} />
        Bodyweight exercise (weight = added weight, optional)
      </label>
      <label>
        Default rest (seconds)
        <input inputMode="numeric" placeholder="Use profile default" value={rest} onChange={(e) => setRest(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row gap">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn primary grow">Save</button>
      </div>
    </form>
  )
}
