import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { store, type ExportData, type ProfileSettings } from '../data'
import { PageHeader } from '../components/Layout'
import { beep, canVibrate, unlockAudio, vibrate } from '../lib/alerts'
import { download, toCsv } from '../lib/exportFile'
import { formatSyncState } from '../lib/format'
import { useProfile } from '../state/ProfileContext'

export function SettingsPage() {
  const { profile, email, sync, syncNow, signIn, signOut, deleteAllData } = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const setSetting = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) =>
    store.saveProfile({ ...profile, settings: { ...profile.settings, [key]: value } })

  const stamp = new Date().toISOString().slice(0, 10)
  const exportJson = async () => {
    const data = await store.exportProfile(profile.id)
    download(`heavystuff-${profile.name}-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
  }
  const exportCsv = async () => {
    const data = await store.exportProfile(profile.id)
    download(`heavystuff-${profile.name}-${stamp}.csv`, toCsv(data), 'text/csv')
  }
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ExportData
      if (!confirm(`Import ${data.sessions?.length ?? 0} sessions into profile “${profile.name}”?`)) return
      await store.importInto(profile.id, data)
      setMessage('Import complete ✔')
    } catch (e) {
      setMessage(`Import failed: ${(e as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const rename = () => {
    const name = prompt('Profile name', profile.name)
    if (name?.trim()) void store.saveProfile({ ...profile, name: name.trim() })
  }
  const deleteData = async () => {
    if (!confirm(`Delete “${profile.name}” and ALL workouts from this device and the cloud? This cannot be undone.`)) return
    if (prompt('Type DELETE to confirm') !== 'DELETE') return
    await deleteAllData()
  }

  const s = profile.settings
  return (
    <>
      <PageHeader title="Settings" />

      <section className="card">
        <h2>Profile</h2>
        <div className="row between">
          <strong>{profile.name}</strong>
          <button className="link-btn" onClick={rename}>
            Rename
          </button>
        </div>
        <p className="muted small">Signed in as {email}</p>
      </section>

      <section className="card">
        <h2>Cloud sync</h2>
        {sync ? (
          <>
            <p className="small">{formatSyncState(sync)}</p>
            {sync.error && <p className="small">⚠️ {sync.error}</p>}
            <div className="row gap wrap">
              <button className="btn" onClick={syncNow} disabled={sync.status === 'syncing'}>
                Sync now
              </button>
              <button className="btn" onClick={signOut}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small">Not signed in – changes are kept on this device and synced after you sign in.</p>
            <div className="row gap wrap">
              <button className="btn primary" onClick={signIn}>
                Sign in with Google
              </button>
              <button className="btn" onClick={signOut}>
                Sign out
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card form">
        <h2>Rest timer</h2>
        <label className="check">
          <input type="checkbox" checked={s.autoRestTimer} onChange={(e) => setSetting('autoRestTimer', e.target.checked)} />
          Show rest timer automatically after each set
        </label>
        <label>
          Default rest target (seconds)
          <input
            inputMode="numeric"
            defaultValue={s.defaultRestSec}
            key={s.defaultRestSec}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10)
              if (Number.isFinite(n) && n >= 0) void setSetting('defaultRestSec', n)
            }}
          />
        </label>
        <p className="muted small">Each exercise can override this (edit the exercise).</p>
        <label className="check">
          <input
            type="checkbox"
            checked={s.restSound}
            onChange={(e) => {
              unlockAudio()
              void setSetting('restSound', e.target.checked)
            }}
          />
          Sound when rest is over
        </label>
        <label className="check">
          <input type="checkbox" checked={s.restVibrate} onChange={(e) => setSetting('restVibrate', e.target.checked)} disabled={!canVibrate()} />
          Vibrate when rest is over {!canVibrate() && <span className="muted small">(not supported on this device)</span>}
        </label>
        <button
          className="btn"
          onClick={() => {
            unlockAudio()
            beep()
            vibrate()
          }}
        >
          Test alert
        </button>
      </section>

      <section className="card">
        <h2>Library</h2>
        <ul className="list">
          <li>
            <Link className="list-item" to="/settings/exercises">
              <span>Exercises</span>
              <span className="muted">›</span>
            </Link>
          </li>
          <li>
            <Link className="list-item" to="/settings/templates">
              <span>Templates</span>
              <span className="muted">›</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Data</h2>
        <p className="muted small">Your data is synced to the cloud. You can also export a copy at any time.</p>
        <div className="row gap wrap">
          <button className="btn" onClick={exportJson}>
            Export backup (JSON)
          </button>
          <button className="btn" onClick={exportCsv}>
            Export sets (CSV)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        {message && <p className="small">{message}</p>}
      </section>

      <section className="card">
        <h2>Danger zone</h2>
        <button className="btn danger" onClick={deleteData}>
          Delete all my data
        </button>
      </section>
    </>
  )
}
