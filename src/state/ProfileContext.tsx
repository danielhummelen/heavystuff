import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { localStore, store, type Profile } from '../data'
import { useQuery } from '../data/useQuery'
import { Onboarding, SignIn } from '../pages/SignIn'
import { remote, signInWithGoogle, supabase } from '../sync/supabase'
import { SyncEngine, type SyncState } from '../sync/syncEngine'

const ACCOUNT_KEY = 'heavystuff.account'

/** Links the signed-in Supabase user to the local profile, so the app also opens offline. */
interface Account {
  userId: string
  email: string
  profileId: string
}

interface ProfileCtx {
  profile: Profile
  email: string
  /** Null while not signed in to the server (changes are kept locally and synced later). */
  sync: SyncState | null
  syncNow: () => void
  signIn: () => void
  signOut: () => Promise<void>
  deleteAllData: () => Promise<void>
}

const Ctx = createContext<ProfileCtx | null>(null)

export function useProfile(): ProfileCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile outside ProfileProvider')
  return v
}

function loadAccount(): Account | null {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null')
  } catch {
    return null
  }
}

function useSession() {
  const [state, setState] = useState<{ ready: boolean; session: Session | null }>({ ready: !supabase, session: null })
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setState({ ready: true, session: data.session }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, session })
      // Drop the OAuth `?code=` from the address bar once it has been exchanged.
      if (session && /[?&](code|error)=/.test(window.location.search)) {
        history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return state
}

const noSync = () => () => {}

/** Signed-in Google account = profile. Data lives in IndexedDB and syncs to Supabase in the background. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { ready, session } = useSession()
  const [account, setAccountState] = useState<Account | null>(loadAccount)
  const [busy, setBusy] = useState<string | null>(null)

  const setAccount = useCallback((a: Account | null) => {
    if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a))
    else localStorage.removeItem(ACCOUNT_KEY)
    setAccountState(a)
  }, [])

  const userMatches = !!account && session?.user.id === account.userId
  const profileId = account?.profileId
  const profile = useQuery(() => (profileId ? store.getProfile(profileId).then((p) => p ?? null) : Promise.resolve(null)), [profileId])

  const engine = useMemo(
    () => (remote && profileId && userMatches ? new SyncEngine(localStore, remote, profileId) : null),
    [profileId, userMatches],
  )
  useEffect(() => {
    engine?.start()
    return () => engine?.stop()
  }, [engine])
  const sync = useSyncExternalStore(engine ? (l) => engine.subscribe(l) : noSync, () => engine?.getState() ?? null)

  // Local copy vanished (e.g. signed out in another tab): go through onboarding again.
  useEffect(() => {
    if (profile === null && account && !busy) setAccount(null)
  }, [profile, account, busy, setAccount])

  const signIn = useCallback(() => void signInWithGoogleSafe(), [])

  const signOut = useCallback(async () => {
    if (!account) return
    setBusy('Signing out…')
    try {
      if (engine) await engine.sync()
      const pending = await localStore.countOutbox(account.profileId)
      if (pending && !confirm(`${pending} change(s) have not been synced yet and will be lost. Sign out anyway?`)) return
      engine?.stop()
      await supabase?.auth.signOut({ scope: 'local' })
      setAccount(null)
      await localStore.purgeLocalProfile(account.profileId)
    } finally {
      setBusy(null)
    }
  }, [account, engine, setAccount])

  const deleteAllData = useCallback(async () => {
    if (!account) return
    if (!engine || !(await engine.sync())) {
      alert('You need to be online and signed in to delete your data.')
      return
    }
    setBusy('Deleting your data…')
    try {
      await store.deleteProfile(account.profileId)
      if (!(await engine.sync())) {
        alert('Could not reach the server. Your data will be deleted from the cloud on the next sync.')
        return
      }
      engine.stop()
      await supabase?.auth.signOut({ scope: 'local' })
      setAccount(null)
      await localStore.purgeLocalProfile(account.profileId)
    } finally {
      setBusy(null)
    }
  }, [account, engine, setAccount])

  if (busy) return <Splash text={busy} />

  if (account && (userMatches || !session)) {
    if (!profile) return null
    const value: ProfileCtx = {
      profile,
      email: account.email,
      sync: userMatches ? sync : null,
      syncNow: () => void engine?.sync(),
      signIn,
      signOut,
      deleteAllData,
    }
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
  }

  if (!ready) return <Splash text="Loading…" />
  if (!session) return <SignIn />
  return (
    <Onboarding
      key={session.user.id}
      session={session}
      onDone={(id) => setAccount({ userId: session.user.id, email: session.user.email ?? '', profileId: id })}
    />
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div className="welcome">
      <h1>🏋️ Heavystuff</h1>
      <p className="muted">{text}</p>
    </div>
  )
}

async function signInWithGoogleSafe() {
  const { error } = await signInWithGoogle()
  if (error) alert(`Sign-in failed: ${error.message}`)
}
