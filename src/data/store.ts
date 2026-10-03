import type {
  Exercise,
  ExportData,
  Profile,
  Session,
  SessionExercise,
  Template,
  WorkoutSet,
} from './types'

/**
 * Backend-agnostic data access contract. The UI only talks to this interface,
 * so a hosted implementation (e.g. Supabase/Postgres or a REST API) can replace
 * the local IndexedDB one by implementing the same methods and calling the
 * subscribers whenever data changes.
 */
export interface DataStore {
  subscribe(listener: () => void): () => void

  listProfiles(): Promise<Profile[]>
  getProfile(id: string): Promise<Profile | undefined>
  createProfile(name: string): Promise<Profile>
  saveProfile(profile: Profile): Promise<void>
  deleteProfile(id: string): Promise<void>

  listExercises(profileId: string): Promise<Exercise[]>
  getExercise(id: string): Promise<Exercise | undefined>
  saveExercise(exercise: Exercise): Promise<void>
  deleteExercise(id: string): Promise<void>
  countSetsForExercise(exerciseId: string): Promise<number>

  listTemplates(profileId: string): Promise<Template[]>
  getTemplate(id: string): Promise<Template | undefined>
  saveTemplate(template: Template): Promise<void>
  deleteTemplate(id: string): Promise<void>

  getActiveSession(profileId: string): Promise<Session | undefined>
  listSessions(profileId: string): Promise<Session[]>
  getSession(id: string): Promise<Session | undefined>
  saveSession(session: Session): Promise<void>
  deleteSession(id: string): Promise<void>

  listSessionExercises(sessionId: string): Promise<SessionExercise[]>
  saveSessionExercises(items: SessionExercise[]): Promise<void>
  deleteSessionExercise(id: string): Promise<void>

  listSetsForSession(sessionId: string): Promise<WorkoutSet[]>
  listSetsForExercise(profileId: string, exerciseId: string): Promise<WorkoutSet[]>
  listSetsForProfile(profileId: string): Promise<WorkoutSet[]>
  saveSet(set: WorkoutSet): Promise<void>
  deleteSet(id: string): Promise<void>

  exportProfile(profileId: string): Promise<ExportData>
  importInto(profileId: string, data: ExportData): Promise<void>
}
