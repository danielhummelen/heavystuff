import { useEffect, useState } from 'react'
import { formatDuration } from '../lib/format'

export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span className="mono">{formatDuration(now - since)}</span>
}
