import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate, formatNumber, formatShortDate } from '../lib/format'
import { METRIC_LABELS, type Metric, type SessionPoint } from '../lib/stats'

export function ExerciseChart({ points, metric }: { points: SessionPoint[]; metric: Metric }) {
  if (points.length === 0) return <p className="muted center chart-empty">No working sets recorded yet.</p>
  const data = points.map((p) => ({ date: p.date, value: Number(p[metric].toFixed(1)) }))
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => formatShortDate(t)}
            tick={{ fontSize: 12 }}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} width={56} />
          <Tooltip
            labelFormatter={(t) => formatDate(Number(t))}
            formatter={(v) => [`${formatNumber(Number(v), 1)} kg`, METRIC_LABELS[metric]]}
          />
          <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
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
