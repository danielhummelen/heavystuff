import { Link } from 'react-router-dom'
import { store, type Template } from '../data'
import { useQuery } from '../data/useQuery'
import { formatShortDate } from '../lib/format'
import { useProfile } from '../state/ProfileContext'
import { Modal } from './Modal'
import { setText } from './SetLabel'

interface Props {
  template: Template
  onClose: () => void
  onStart: () => void
}

export function TemplatePreview({ template, onClose, onStart }: Props) {
  const { profile } = useProfile()
  const items = useQuery(
    () =>
      Promise.all(
        template.exerciseIds.map(async (id) => {
          const [exercise, history] = await Promise.all([store.getExercise(id), store.listSetsForExercise(profile.id, id)])
          const lastSessionId = history[history.length - 1]?.sessionId
          const last = lastSessionId ? history.filter((s) => s.sessionId === lastSessionId) : []
          return { id, exercise, last }
        }),
      ),
    [profile.id, template.exerciseIds.join(',')],
  )
  const exercises = items?.filter((i) => i.exercise) ?? []

  return (
    <Modal title={template.name} onClose={onClose}>
      {items && exercises.length === 0 && <p className="muted small">No exercises in this template.</p>}
      <ol className="list">
        {exercises.map(({ id, exercise, last }) => (
          <li key={id} className="list-item static">
            <span>
              <strong>{exercise!.name}</strong>
              <span className="muted small block-text">
                {last.length
                  ? `Last (${formatShortDate(last[0].completedAt)}): ${last.map((s) => setText(s, exercise) + (s.isWarmup ? ' (W)' : '')).join(' · ')}`
                  : exercise!.category}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <button className="btn primary block big" onClick={onStart}>
        ▶ Start workout
      </button>
      <Link className="btn block" to={`/settings/templates/${template.id}`}>
        Edit template
      </Link>
    </Modal>
  )
}
