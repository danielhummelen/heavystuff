import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { beep, vibrate } from '../lib/alerts'
import { useProfile } from './ProfileContext'

const KEY = 'heavystuff.restTimer'

export interface RestState {
  startedAt: number
  targetSec: number | null
  label: string
  alerted: boolean
}

interface RestCtx {
  rest: RestState | null
  now: number
  start: (targetSec: number | null, label: string) => void
  adjust: (deltaSec: number) => void
  stop: () => void
}

const Ctx = createContext<RestCtx | null>(null)

export function useRestTimer() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRestTimer outside RestTimerProvider')
  return v
}

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RestState) : null
  } catch {
    return null
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile()
  const [rest, setRest] = useState<RestState | null>(load)
  const [now, setNow] = useState(Date.now())
  const settings = useRef(profile.settings)
  useEffect(() => {
    settings.current = profile.settings
  }, [profile.settings])

  const update = useCallback((next: RestState | null) => {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
    setRest(next)
  }, [])

  useEffect(() => {
    if (!rest) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [rest])

  useEffect(() => {
    if (!rest || rest.alerted || rest.targetSec == null) return
    if (now - rest.startedAt >= rest.targetSec * 1000) {
      if (settings.current.restSound) beep()
      if (settings.current.restVibrate) vibrate()
      update({ ...rest, alerted: true })
    }
  }, [now, rest, update])

  const start = useCallback(
    (targetSec: number | null, label: string) => {
      setNow(Date.now())
      update({ startedAt: Date.now(), targetSec, label, alerted: false })
    },
    [update],
  )

  const adjust = useCallback(
    (delta: number) => {
      if (!rest) return
      const elapsedSec = (Date.now() - rest.startedAt) / 1000
      const targetSec = Math.max(0, (rest.targetSec ?? Math.ceil(elapsedSec)) + delta)
      update({ ...rest, targetSec, alerted: rest.alerted && elapsedSec >= targetSec })
    },
    [rest, update],
  )

  const stop = useCallback(() => update(null), [update])

  return <Ctx.Provider value={{ rest, now, start, adjust, stop }}>{children}</Ctx.Provider>
}
