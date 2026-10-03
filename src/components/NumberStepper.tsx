import { formatNumber } from '../lib/format'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  step: number
  min?: number
  decimal?: boolean
  placeholder?: string
}

/** Large touch-friendly numeric input with -/+ buttons. Value is kept as a string so partial input works. */
export function NumberStepper({ label, value, onChange, step, min = 0, decimal = false, placeholder }: Props) {
  const bump = (dir: number) => {
    const current = parseFloat(value.replace(',', '.'))
    const base = Number.isFinite(current) ? current : 0
    onChange(formatNumber(Math.max(min, base + dir * step)))
  }
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="stepper-btn" onClick={() => bump(-1)} aria-label={`Decrease ${label}`}>
          −
        </button>
        <input
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="stepper-btn" onClick={() => bump(1)} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

export function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
