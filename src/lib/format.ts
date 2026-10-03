export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatNumber(n: number, maxDecimals = 2): string {
  return Number(n.toFixed(maxDecimals)).toString()
}

export function formatWeight(kg: number): string {
  return `${formatNumber(kg)} kg`
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): number | null {
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

export function defaultSessionName(ts: number): string {
  const h = new Date(ts).getHours()
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
  return `${part} workout`
}

export function formatSyncState(s: { status: string; pending: number; lastSyncedAt: number | null }): string {
  const pending = s.pending ? ` · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : ''
  if (s.status === 'syncing') return `Syncing…${pending}`
  if (s.status === 'offline') return `Offline – will sync when back online${pending}`
  if (s.status === 'error') return `Sync failed${pending}`
  return s.lastSyncedAt ? `✔ Synced at ${formatTime(s.lastSyncedAt)}${pending}` : `Not synced yet${pending}`
}
