import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { store, type ExportData, type ProfileSettings } from '../data'
import { useQuery } from '../data/useQuery'
import { PageHeader } from '../components/Layout'
import { beep, canVibrate, unlockAudio, vibrate } from '../lib/alerts'
import { download, toCsv } from '../lib/exportFile'
import { useProfile } from '../state/ProfileContext'

export function SettingsPage() {
  const { profile, setProfileId } = useProfile()
  const profiles = useQuery(() => store.listProfiles(), [])
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
  const newProfile = async () => {
    const name = prompt('New profile name')
    if (!name?.trim()) return
    const p = await store.createProfile(name.trim())
    setProfileId(p.id)
  }
  const deleteProfile = async () => {
    if (!confirm(`Delete profile “${profile.name}” and ALL its data? This cannot be undone.`)) return
    if (prompt('Type DELETE to confirm') !== 'DELETE') return
    const id = profile.id
    setProfileId(null)
    await store.deleteProfile(id)
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
        {profiles && profiles.length > 1 && (
          <label>
            Switch profile
            <select value={profile.id} onChange={(e) => setProfileId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="row gap wrap">
          <button className="btn" onClick={newProfile}>
            + New profile
          </button>
          <button className="btn" onClick={() => setProfileId(null)}>
            Sign out
          </button>
        </div>
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
        <p className="muted small">Data is stored on this device only. Export regularly to keep a backup.</p>
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
        <button className="btn danger" onClick={deleteProfile}>
          Delete profile
        </button>
      </section>
    </>
  )
}
