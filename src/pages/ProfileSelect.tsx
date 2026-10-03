import { useState } from 'react'
import { store } from '../data'
import { useQuery } from '../data/useQuery'

export function ProfileSelect({ onSelect }: { onSelect: (id: string) => void }) {
  const profiles = useQuery(() => store.listProfiles(), [])
  const [name, setName] = useState('')

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const p = await store.createProfile(name.trim())
    onSelect(p.id)
  }

  return (
    <div className="welcome">
      <h1>🏋️ Heavystuff</h1>
      <p className="muted">Track your lifts, rest and progress.</p>
      {!!profiles?.length && (
        <section className="card">
          <h2>Who's lifting?</h2>
          <ul className="list">
            {profiles.map((p) => (
              <li key={p.id}>
                <button className="list-item" onClick={() => onSelect(p.id)}>
                  <span>{p.name}</span>
                  <span className="muted">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form className="card form" onSubmit={create}>
        <h2>{profiles?.length ? 'New profile' : 'Create your profile'}</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus={profiles?.length === 0} />
        </label>
        <button className="btn primary block" disabled={!name.trim()}>
          Create profile
        </button>
      </form>
    </div>
  )
}
