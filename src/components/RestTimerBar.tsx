import { formatDuration } from '../lib/format'
import { useRestTimer } from '../state/RestTimer'

export function RestTimerBar() {
  const { rest, now, adjust, stop } = useRestTimer()
  if (!rest) return null
  const elapsed = now - rest.startedAt
  const target = rest.targetSec != null ? rest.targetSec * 1000 : null
  const done = target != null && elapsed >= target
  const pct = target ? Math.min(100, (elapsed / target) * 100) : 0

  return (
    <div className={`rest-bar ${done ? 'done' : ''}`} role="timer" aria-live="off">
      {target != null && <div className="rest-progress" style={{ width: `${pct}%` }} />}
      <div className="rest-content">
        <div className="rest-info">
          <span className="small">{done ? 'Rest done — go!' : `Rest · ${rest.label}`}</span>
          <span className="rest-time mono">
            {formatDuration(elapsed)}
            {target != null && <span className="muted"> / {formatDuration(target)}</span>}
          </span>
        </div>
        <button className="pill-btn" onClick={() => adjust(-15)} aria-label="15 seconds less">
          −15
        </button>
        <button className="pill-btn" onClick={() => adjust(15)} aria-label="15 seconds more">
          +15
        </button>
        <button className="icon-btn" onClick={stop} aria-label="Close rest timer">
          ✕
        </button>
      </div>
    </div>
  )
}
