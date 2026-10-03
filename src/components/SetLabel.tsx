import type { Exercise, WorkoutSet } from '../data'
import { formatNumber } from '../lib/format'
import type { PRFlags } from '../lib/stats'

export function setText(s: Pick<WorkoutSet, 'weight' | 'reps'>, exercise?: Exercise) {
  if (exercise?.isBodyweight) return s.weight ? `BW+${formatNumber(s.weight)} × ${s.reps}` : `BW × ${s.reps}`
  return `${formatNumber(s.weight)} kg × ${s.reps}`
}

export function SetTags({ set, pr }: { set: WorkoutSet; pr?: PRFlags }) {
  return (
    <>
      {set.isWarmup && <span className="tag">W</span>}
      {set.isDropSet && <span className="tag">Drop</span>}
      {set.toFailure && <span className="tag">F</span>}
      {set.rpe != null && <span className="tag">RPE {formatNumber(set.rpe)}</span>}
      {set.rir != null && <span className="tag">RIR {set.rir}</span>}
      {pr && <span className="tag pr" title={pr.e1rm ? 'Est. 1RM PR' : 'Weight PR'}>🏆 PR</span>}
    </>
  )
}
