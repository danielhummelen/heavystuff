import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { localStore, store, type Profile } from '../data'
import { remote, signInWithGoogle } from '../sync/supabase'
import { SyncEngine } from '../sync/syncEngine'

export function SignIn() {
  const params = new URLSearchParams(window.location.search)
  const [error, setError] = useState(params.get('error_description') ?? '')

  const signIn = async () => {
    setError('')
    try {
      const { error } = await signInWithGoogle()
      if (error) setError(error.message)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="welcome">
      <h1>🏋️ Heavystuff</h1>
      <p className="muted">Track your lifts, rest and progress.</p>
      <section className="card form">
        <h2>Sign in</h2>
        <p className="muted small">Your workouts are stored on this device and synced to the cloud, so they're safe and available on all your devices.</p>
        {remote ? (
          <button className="btn primary block" onClick={signIn}>
            Continue with Google
          </button>
        ) : (
          <p className="small">Cloud sync is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).</p>
        )}
        {error && <p className="small">⚠️ {error}</p>}
      </section>
    </div>
  )
}

/** After the first sign-in on a device: load the cloud profile, or create/upload one. */
export function Onboarding({ session, onDone }: { session: Session; onDone: (profileId: string) => void }) {
  const [step, setStep] = useState<'checking' | 'choose' | 'error'>('checking')
  const [localProfiles, setLocalProfiles] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const started = useRef(-1)
  const meta = session.user.user_metadata as { full_name?: string; name?: string }
  const name = meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Me'

  useEffect(() => {
    if (!remote || started.current === attempt) return
    started.current = attempt
    void (async () => {
      try {
        const cloudId = await remote.getOwnProfileId()
        if (cloudId) {
          if (!(await new SyncEngine(localStore, remote, cloudId).sync()) || !(await store.getProfile(cloudId))) {
            throw new Error('Could not download your data.')
          }
          return onDone(cloudId)
        }
        const profiles = await store.listProfiles()
        if (!profiles.length) return onDone((await store.createProfile(name)).id)
        setLocalProfiles(profiles)
        setStep('choose')
      } catch (e) {
        setError((e as Error).message)
        setStep('error')
      }
    })()
  }, [attempt, name, onDone])

  const upload = async (p: Profile) => {
    await localStore.enqueueProfile(p.id)
    onDone(p.id)
  }
  const fresh = async () => onDone((await store.createProfile(name)).id)

  return (
    <div className="welcome">
      <h1>🏋️ Heavystuff</h1>
      {step === 'checking' && <p className="muted">Loading your data…</p>}
      {step === 'error' && (
        <section className="card">
          <p>⚠️ {error}</p>
          <button className="btn primary block" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </section>
      )}
      {step === 'choose' && (
        <section className="card">
          <h2>Move your data to the cloud</h2>
          <p className="muted small">Signed in as {session.user.email}. Pick the profile on this device that holds your workouts:</p>
          <ul className="list">
            {localProfiles.map((p) => (
              <li key={p.id}>
                <button className="list-item" onClick={() => upload(p)}>
                  <span>Upload “{p.name}”</span>
                  <span className="muted">›</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn block" onClick={fresh}>
            Start fresh instead
          </button>
        </section>
      )}
    </div>
  )
}
