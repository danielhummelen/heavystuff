import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { store, type Session } from '../data'
import { download, sessionExport, slug, toCsv } from '../lib/exportFile'
import { useQuery } from '../data/useQuery'
import { PageHeader } from '../components/Layout'
import { SessionEditor } from '../components/SessionEditor'
import { SessionSummary } from '../components/SessionSummary'

export function SessionPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const editing = params.get('edit') === '1'
  const session = useQuery(() => store.getSession(id).then((s) => s ?? null), [id])
  if (session === undefined) return null
  if (session === null) return <Navigate to="/history" replace />
  if (session.status === 'active') return <Navigate to="/" replace />

  const setEditing = (on: boolean) => setParams(on ? { edit: '1' } : {}, { replace: true })

  return (
    <>
      <PageHeader
        title={editing ? 'Edit session' : 'Session'}
        back
        action={
          <button className={`btn ${editing ? 'primary' : ''}`} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        }
      />
      {editing ? (
        <SessionEditor session={session} />
      ) : (
        <>
          <SessionSummary session={session} />
          <SessionDownload session={session} />
        </>
      )}
    </>
  )
}

function SessionDownload({ session }: { session: Session }) {
  const save = async (format: 'csv' | 'json') => {
    const data = sessionExport(await store.exportProfile(session.profileId), session.id)
    const name = `heavystuff-${slug(session.name)}-${new Date(session.startedAt).toISOString().slice(0, 10)}`
    if (format === 'csv') download(`${name}.csv`, toCsv(data), 'text/csv')
    else download(`${name}.json`, JSON.stringify(data, null, 2), 'application/json')
  }
  return (
    <section className="card">
      <h2>Download session</h2>
      <div className="row gap wrap">
        <button className="btn" onClick={() => save('csv')}>
          Sets (CSV)
        </button>
        <button className="btn" onClick={() => save('json')}>
          Backup (JSON)
        </button>
      </div>
    </section>
  )
}
