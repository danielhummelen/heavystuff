import type { Exercise } from '../data'
import { formatNumber, formatShortDate } from '../lib/format'
import { e1rm, type Records } from '../lib/stats'
import { setText } from './SetLabel'

export function RecordsGrid({ records, exercise }: { records: Records; exercise: Exercise }) {
  const { bestE1rm, heaviest, mostReps, bestVolume } = records
  if (!bestE1rm) return null
  return (
    <div className="records">
      <div className="record">
        <span className="muted small">Est. 1RM</span>
        <strong>{formatNumber(e1rm(bestE1rm.weight, bestE1rm.reps), 1)} kg</strong>
        <span className="muted small">
          {setText(bestE1rm, exercise)} · {formatShortDate(bestE1rm.completedAt)}
        </span>
      </div>
      {heaviest && (
        <div className="record">
          <span className="muted small">Heaviest</span>
          <strong>{formatNumber(heaviest.weight)} kg</strong>
          <span className="muted small">
            × {heaviest.reps} · {formatShortDate(heaviest.completedAt)}
          </span>
        </div>
      )}
      {mostReps && (
        <div className="record">
          <span className="muted small">Most reps</span>
          <strong>{mostReps.reps}</strong>
          <span className="muted small">
            {setText(mostReps, exercise)} · {formatShortDate(mostReps.completedAt)}
          </span>
        </div>
      )}
      {bestVolume && (
        <div className="record">
          <span className="muted small">Best volume</span>
          <strong>{formatNumber(bestVolume.volume, 0)} kg</strong>
          <span className="muted small">{formatShortDate(bestVolume.date)}</span>
        </div>
      )}
    </div>
  )
}
