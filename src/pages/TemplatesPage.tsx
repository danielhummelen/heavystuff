import { Link, useNavigate } from 'react-router-dom'
import { store } from '../data'
import { useQuery } from '../data/useQuery'
import { PageHeader } from '../components/Layout'
import { newId } from '../lib/id'
import { useProfile } from '../state/ProfileContext'

export function TemplatesPage() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const templates = useQuery(() => store.listTemplates(profile.id), [profile.id])

  const create = async () => {
    const name = prompt('Template name (e.g. Push day)')
    if (!name?.trim()) return
    const now = Date.now()
    const id = newId()
    await store.saveTemplate({ id, profileId: profile.id, name: name.trim(), exerciseIds: [], createdAt: now, updatedAt: now })
    navigate(`/settings/templates/${id}`)
  }

  return (
    <>
      <PageHeader
        title="Templates"
        back
        action={
          <button className="btn primary" onClick={create}>
            + New
          </button>
        }
      />
      {templates?.length === 0 && <p className="muted center">No templates yet.</p>}
      <ul className="list card">
        {templates?.map((t) => (
          <li key={t.id}>
            <Link className="list-item" to={`/settings/templates/${t.id}`}>
              <span>{t.name}</span>
              <span className="muted small">{t.exerciseIds.length} exercises ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
