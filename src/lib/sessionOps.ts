import { store, type Profile, type Session, type SessionExercise, type Template } from '../data'
import { defaultSessionName } from './format'
import { newId } from './id'

export async function startSession(profile: Profile, template?: Template): Promise<Session> {
  const existing = await store.getActiveSession(profile.id)
  if (existing) return existing
  const now = Date.now()
  const session: Session = {
    id: newId(),
    profileId: profile.id,
    name: template?.name ?? defaultSessionName(now),
    notes: '',
    status: 'active',
    startedAt: now,
    endedAt: null,
    templateId: template?.id ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await store.saveSession(session)
  if (template?.exerciseIds.length) {
    await store.saveSessionExercises(template.exerciseIds.map((exerciseId, i) => makeSE(session, exerciseId, i)))
  }
  return session
}

export async function createPastSession(profile: Profile): Promise<Session> {
  const start = new Date()
  start.setDate(start.getDate() - 1)
  start.setHours(18, 0, 0, 0)
  const startedAt = start.getTime()
  const now = Date.now()
  const session: Session = {
    id: newId(),
    profileId: profile.id,
    name: defaultSessionName(startedAt),
    notes: '',
    status: 'done',
    startedAt,
    endedAt: startedAt + 60 * 60 * 1000,
    templateId: null,
    createdAt: now,
    updatedAt: now,
  }
  await store.saveSession(session)
  return session
}

function makeSE(session: Session, exerciseId: string, order: number): SessionExercise {
  const now = Date.now()
  return { id: newId(), profileId: session.profileId, sessionId: session.id, exerciseId, order, createdAt: now, updatedAt: now }
}

export async function addExerciseToSession(session: Session, exerciseId: string) {
  const list = await store.listSessionExercises(session.id)
  const order = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 0
  const se = makeSE(session, exerciseId, order)
  await store.saveSessionExercises([se])
  return se.id
}

export async function moveSessionExercise(sessionId: string, id: string, dir: -1 | 1) {
  const list = await store.listSessionExercises(sessionId)
  const i = list.findIndex((s) => s.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  await store.saveSessionExercises(list.map((s, order) => ({ ...s, order })))
}

export async function finishSession(session: Session) {
  await store.saveSession({ ...session, status: 'done', endedAt: Date.now() })
}

export const AUTO_FINISH_AFTER_MS = 2 * 60 * 60 * 1000

/**
 * Ends an active session that has seen no activity (new set or exercise) for AUTO_FINISH_AFTER_MS.
 * It's finished at the time of the last set, or discarded if no sets were logged.
 */
export async function autoFinishStaleSession(profileId: string, now = Date.now()): Promise<'finished' | 'discarded' | null> {
  const session = await store.getActiveSession(profileId)
  if (!session) return null
  const [sets, ses] = await Promise.all([store.listSetsForSession(session.id), store.listSessionExercises(session.id)])
  const lastSet = Math.max(0, ...sets.map((s) => s.completedAt))
  const lastActivity = Math.max(session.startedAt, lastSet, ...ses.map((s) => s.createdAt))
  if (now - lastActivity < AUTO_FINISH_AFTER_MS) return null
  if (!sets.length) {
    await store.deleteSession(session.id)
    return 'discarded'
  }
  await store.saveSession({ ...session, status: 'done', endedAt: lastSet })
  return 'finished'
}

export async function saveSessionAsTemplate(session: Session, name: string) {
  const list = await store.listSessionExercises(session.id)
  const now = Date.now()
  await store.saveTemplate({
    id: newId(),
    profileId: session.profileId,
    name,
    exerciseIds: list.map((s) => s.exerciseId),
    createdAt: now,
    updatedAt: now,
  })
}
