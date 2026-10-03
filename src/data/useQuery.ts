import { useEffect, useState } from 'react'
import { store } from './index'

/**
 * Runs an async store query and re-runs it whenever the store reports a change.
 * Returns undefined while the first result for the current deps is loading.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const key = JSON.stringify(deps)
  const [state, setState] = useState<{ key: string; value: T } | undefined>()

  useEffect(() => {
    let run = 0
    let disposed = false
    const exec = () => {
      const current = ++run
      fn().then((value) => {
        if (!disposed && current === run) setState({ key, value })
      }, console.error)
    }
    exec()
    const unsub = store.subscribe(exec)
    return () => {
      disposed = true
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state && state.key === key ? state.value : undefined
}
