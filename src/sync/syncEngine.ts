import { SYNC_TABLES, type DexieStore, type OutboxEntry, type SyncTable } from '../data/dexieStore'
import { PAGE_SIZE, type Remote } from './remote'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  lastSyncedAt: number | null
  error: string | null
}

const PUSH_DEBOUNCE_MS = 1500
const PULL_DEBOUNCE_MS = 500
const INTERVAL_MS = 5 * 60_000

/**
 * Local-first sync: the UI reads/writes IndexedDB only. This engine pushes queued local changes
 * (outbox) to the server and pulls server changes newer than the last seen `rev` per table.
 */
export class SyncEngine {
  private local: DexieStore
  private remote: Remote
  readonly profileId: string
  private state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, error: null }
  private listeners = new Set<() => void>()
  private running: Promise<boolean> | null = null
  private rerun = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private cleanups: (() => void)[] = []

  constructor(local: DexieStore, remote: Remote, profileId: string) {
    this.local = local
    this.remote = remote
    this.profileId = profileId
  }

  getState() {
    return this.state
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  /** Pushes and pulls until nothing is left. Resolves to true when the last attempt succeeded. */
  sync(): Promise<boolean> {
    if (this.running) {
      this.rerun = true
      return this.running
    }
    this.running = (async () => {
      let ok = true
      try {
        do {
          this.rerun = false
          ok = await this.withLock(() => this.runOnce())
        } while (this.rerun && ok)
      } finally {
        this.running = null
      }
      return ok
    })()
    return this.running
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Serialises syncing across open tabs.
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('heavystuff-sync', fn)
    return fn()
  }

  private async runOnce() {
    this.setState({ status: 'syncing', error: null })
    try {
      await this.push()
      await this.pull()
      this.setState({ status: 'idle', lastSyncedAt: Date.now(), pending: await this.local.countOutbox(this.profileId) })
      return true
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      this.setState({
        status: offline ? 'offline' : 'error',
        error: offline ? null : errorMessage(e),
        pending: await this.local.countOutbox(this.profileId),
      })
      return false
    }
  }

  private async push() {
    const entries = await this.local.listOutbox(this.profileId)
    const byTable = new Map<SyncTable, OutboxEntry[]>()
    for (const e of entries) byTable.set(e.table, [...(byTable.get(e.table) ?? []), e])
    for (const table of SYNC_TABLES) {
      const list = byTable.get(table)
      if (!list) continue
      const rows = await this.local.getRows(table, list.map((e) => e.id))
      const upserts = rows.filter((r) => r !== undefined)
      const deletes = list.filter((_, i) => !rows[i]).map((e) => e.id)
      if (upserts.length) await this.remote.upsert(table, upserts)
      if (deletes.length) await this.remote.delete(table, deletes)
      await this.local.ackOutbox(list)
    }
  }

  private cursorKey(name: string) {
    return `cursor:${this.profileId}:${name}`
  }

  private async pull() {
    for (const table of SYNC_TABLES) {
      const key = this.cursorKey(table)
      let cursor = (await this.local.getMeta<number>(key)) ?? 0
      for (;;) {
        const { rows, revs } = await this.remote.pull(table, cursor)
        if (!rows.length) break
        await this.local.applyRemote(table, rows)
        cursor = revs[revs.length - 1]
        await this.local.setMeta(key, cursor)
        if (rows.length < PAGE_SIZE) break
      }
    }
    const key = this.cursorKey('deletions')
    let cursor = (await this.local.getMeta<number>(key)) ?? 0
    for (;;) {
      const list = await this.remote.pullDeletions(cursor)
      if (!list.length) break
      for (const table of SYNC_TABLES) {
        const ids = list.filter((d) => d.table === table).map((d) => d.id)
        await this.local.applyRemote(table, [], ids)
      }
      cursor = list[list.length - 1].rev
      await this.local.setMeta(key, cursor)
      if (list.length < PAGE_SIZE) break
    }
  }

  private schedule(delay: number) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delay)
  }

  /** Starts background syncing: on local changes, server notifications, reconnects and periodically. */
  start() {
    const onLocalChange = async () => {
      const pending = await this.local.countOutbox(this.profileId)
      if (pending !== this.state.pending) this.setState({ pending })
      if (pending) this.schedule(PUSH_DEBOUNCE_MS)
    }
    this.cleanups.push(this.local.subscribe(() => void onLocalChange()))
    this.cleanups.push(this.remote.listen(() => this.schedule(PULL_DEBOUNCE_MS)))
    if (typeof window !== 'undefined') {
      const onOnline = () => void this.sync()
      const onVisible = () => document.visibilityState === 'visible' && void this.sync()
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onVisible)
      const interval = setInterval(() => void this.sync(), INTERVAL_MS)
      this.cleanups.push(() => {
        window.removeEventListener('online', onOnline)
        document.removeEventListener('visibilitychange', onVisible)
        clearInterval(interval)
      })
    }
    void this.sync()
  }

  stop() {
    clearTimeout(this.timer)
    this.cleanups.forEach((c) => c())
    this.cleanups = []
  }
}

function errorMessage(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
