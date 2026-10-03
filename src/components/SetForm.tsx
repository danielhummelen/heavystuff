import { useState } from 'react'
import type { Exercise, WorkoutSet } from '../data'
import { NumberStepper, parseNum } from './NumberStepper'
import { formatNumber } from '../lib/format'

export type SetValues = Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'rir' | 'isWarmup' | 'isDropSet' | 'toFailure' | 'notes'>

interface Props {
  exercise: Exercise
  initial?: Partial<SetValues>
  submitLabel: string
  onSubmit: (values: SetValues) => void
  onCancel?: () => void
  onDelete?: () => void
}

const str = (n: number | null | undefined) => (n == null ? '' : formatNumber(n))

export function SetForm({ exercise, initial = {}, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [weight, setWeight] = useState(exercise.isBodyweight && !initial.weight ? '' : str(initial.weight))
  const [reps, setReps] = useState(str(initial.reps))
  const [rpe, setRpe] = useState(str(initial.rpe))
  const [rir, setRir] = useState(str(initial.rir))
  const [isWarmup, setWarmup] = useState(!!initial.isWarmup)
  const [isDropSet, setDrop] = useState(!!initial.isDropSet)
  const [toFailure, setFailure] = useState(!!initial.toFailure)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const hasExtras = !!(initial.rpe != null || initial.rir != null || initial.isWarmup || initial.isDropSet || initial.toFailure || initial.notes)
  const [showMore, setShowMore] = useState(hasExtras && !!onDelete)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseNum(weight)
    const r = parseNum(reps)
    if (!exercise.isBodyweight && (w == null || w < 0)) return setError('Enter a weight')
    if (r == null || r <= 0) return setError('Enter reps')
    const rpeN = parseNum(rpe)
    const rirN = parseNum(rir)
    if (rpeN != null && (rpeN < 1 || rpeN > 10)) return setError('RPE must be 1–10')
    setError('')
    onSubmit({
      weight: w ?? 0,
      reps: Math.round(r),
      rpe: rpeN,
      rir: rirN,
      isWarmup,
      isDropSet,
      toFailure,
      notes: notes.trim(),
    })
  }

  return (
    <form className="set-form" onSubmit={submit}>
      <div className="grid-2">
        <NumberStepper
          label={exercise.isBodyweight ? 'Added kg' : 'Weight (kg)'}
          value={weight}
          onChange={setWeight}
          step={2.5}
          decimal
          placeholder={exercise.isBodyweight ? '0' : ''}
        />
        <NumberStepper label="Reps" value={reps} onChange={setReps} step={1} />
      </div>
      <button type="button" className="link-btn" onClick={() => setShowMore(!showMore)}>
        {showMore ? '− Fewer options' : '+ RPE, warm-up, notes…'}
      </button>
      {showMore && (
        <div className="set-extras">
          <div className="grid-2">
            <label>
              RPE
              <input inputMode="decimal" placeholder="1–10" value={rpe} onChange={(e) => setRpe(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </label>
            <label>
              RIR
              <input inputMode="numeric" placeholder="Reps in reserve" value={rir} onChange={(e) => setRir(e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
          <div className="chips">
            <button type="button" className={`chip ${isWarmup ? 'active' : ''}`} onClick={() => setWarmup(!isWarmup)}>
              Warm-up
            </button>
            <button type="button" className={`chip ${isDropSet ? 'active' : ''}`} onClick={() => setDrop(!isDropSet)}>
              Drop set
            </button>
            <button type="button" className={`chip ${toFailure ? 'active' : ''}`} onClick={() => setFailure(!toFailure)}>
              To failure
            </button>
          </div>
          <label>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row gap">
        {onDelete && (
          <button type="button" className="btn danger" onClick={onDelete}>
            Delete
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn primary grow">{submitLabel}</button>
      </div>
    </form>
  )
}
