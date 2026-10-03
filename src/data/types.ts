// All entities use string UUIDs and timestamps (ms since epoch) so they can be
// synced to a hosted database later without id remapping.

export interface ProfileSettings {
  defaultRestSec: number
  autoRestTimer: boolean
  restSound: boolean
  restVibrate: boolean
}

export interface Profile {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  settings: ProfileSettings
}

export const CATEGORIES = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full body',
  'Other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export interface Exercise {
  id: string
  profileId: string
  name: string
  category: Category
  equipment: Equipment
  isBodyweight: boolean
  defaultRestSec: number | null
  isPreset: boolean
  archived: boolean
  createdAt: number
  updatedAt: number
}

export interface Template {
  id: string
  profileId: string
  name: string
  exerciseIds: string[]
  createdAt: number
  updatedAt: number
}

export type SessionStatus = 'active' | 'done'

export interface Session {
  id: string
  profileId: string
  name: string
  notes: string
  status: SessionStatus
  startedAt: number
  endedAt: number | null
  templateId: string | null
  createdAt: number
  updatedAt: number
}

export interface SessionExercise {
  id: string
  profileId: string
  sessionId: string
  exerciseId: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface WorkoutSet {
  id: string
  profileId: string
  sessionId: string
  sessionExerciseId: string
  exerciseId: string
  order: number
  weight: number
  reps: number
  rpe: number | null
  rir: number | null
  isWarmup: boolean
  isDropSet: boolean
  toFailure: boolean
  notes: string
  completedAt: number
  createdAt: number
  updatedAt: number
}

export interface ExportData {
  app: 'heavystuff'
  version: 1
  exportedAt: number
  profile: Profile
  exercises: Exercise[]
  templates: Template[]
  sessions: Session[]
  sessionExercises: SessionExercise[]
  sets: WorkoutSet[]
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  defaultRestSec: 90,
  autoRestTimer: true,
  restSound: false,
  restVibrate: false,
}
