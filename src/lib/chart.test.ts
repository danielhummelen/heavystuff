import { describe, expect, it } from 'vitest'
import { monotonePath, niceTicks } from './chart'

describe('niceTicks', () => {
  it('produces round steps covering the range', () => {
    expect(niceTicks(62, 98, 5)).toEqual([60, 70, 80, 90, 100])
    expect(niceTicks(0, 1000, 5)).toEqual([0, 500, 1000])
    const t = niceTicks(0.1, 0.9, 5)
    expect(t[0]).toBeLessThanOrEqual(0.1)
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(0.9)
  })

  it('handles a flat range', () => {
    const t = niceTicks(100, 100)
    expect(t[0]).toBeLessThan(100)
    expect(t[t.length - 1]).toBeGreaterThan(100)
  })
})

describe('monotonePath', () => {
  it('handles small inputs', () => {
    expect(monotonePath([])).toBe('')
    expect(monotonePath([{ x: 1, y: 2 }])).toBe('M1,2')
    expect(monotonePath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M0,0L10,5')
  })

  it('builds cubic segments through every point', () => {
    const d = monotonePath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 5 },
    ])
    expect(d.startsWith('M0,0C')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(2)
    expect(d.endsWith(' 20,5')).toBe(true)
  })
})
