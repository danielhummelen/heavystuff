import { useEffect, useRef, useState } from 'react'
import { monotonePath, niceTicks } from '../lib/chart'
import { formatDate, formatNumber, formatShortDate } from '../lib/format'
import { METRIC_LABELS, type Metric, type SessionPoint } from '../lib/stats'

const HEIGHT = 240
const PAD = { top: 10, right: 16, bottom: 26, left: 44 }
const DAY = 86_400_000

export function ExerciseChart({ points, metric }: { points: SessionPoint[]; metric: Metric }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (points.length === 0) return <p className="muted center chart-empty">No working sets recorded yet.</p>

  const data = points.map((p) => ({ date: p.date, value: Number(p[metric].toFixed(1)) }))
  const values = data.map((d) => d.value)
  const yTicks = niceTicks(Math.min(...values), Math.max(...values), 5)
  const yMin = yTicks[0]
  const yMax = yTicks[yTicks.length - 1]
  let xMin = data[0].date
  let xMax = data[data.length - 1].date
  if (xMin === xMax) {
    xMin -= DAY
    xMax += DAY
  }

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const inset = Math.min(10, plotW / 4)
  const sx = (t: number) => PAD.left + inset + ((t - xMin) / (xMax - xMin)) * (plotW - 2 * inset)
  const sy = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH
  const pts = data.map((d) => ({ x: sx(d.date), y: sy(d.value) }))

  const xTickCount = Math.max(2, Math.min(5, Math.floor(plotW / 70)))
  const xTicks = Array.from({ length: xTickCount }, (_, i) => xMin + ((xMax - xMin) * i) / (xTickCount - 1))

  const pick = (clientX: number) => {
    const left = ref.current?.getBoundingClientRect().left ?? 0
    const x = clientX - left
    let best = 0
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i
    setActive(best)
  }

  const a = active !== null && active < data.length ? active : null

  return (
    <div
      className="chart"
      ref={ref}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${METRIC_LABELS[metric]} over time`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={sy(v)} y2={sy(v)} stroke="var(--border)" />
              <text x={PAD.left - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="chart-tick">
                {formatNumber(v, 1)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={sx(t)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              className="chart-tick"
            >
              {formatShortDate(t)}
            </text>
          ))}
          {a !== null && (
            <line x1={pts[a].x} x2={pts[a].x} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeDasharray="3 3" />
          )}
          <path d={monotonePath(pts)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === a ? 6 : 3} fill={i === a ? 'var(--accent)' : 'var(--card)'} stroke="var(--accent)" strokeWidth={2} />
          ))}
        </svg>
      )}
      {a !== null && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(pts[a].x, 70), width - 70), top: Math.max(0, pts[a].y - 56) }}
        >
          <div className="muted small">{formatDate(data[a].date)}</div>
          <strong>
            {METRIC_LABELS[metric]}: {formatNumber(data[a].value, 1)} kg
          </strong>
        </div>
      )}
    </div>
  )
}

export function MetricTabs({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  return (
    <div className="segmented" role="tablist">
      {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
        <button key={m} role="tab" aria-selected={value === m} className={value === m ? 'active' : ''} onClick={() => onChange(m)}>
          {METRIC_LABELS[m]}
        </button>
      ))}
    </div>
  )
}
