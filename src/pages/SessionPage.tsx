import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { store } from '../data'
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
      {editing ? <SessionEditor session={session} /> : <SessionSummary session={session} />}
    </>
  )
}
