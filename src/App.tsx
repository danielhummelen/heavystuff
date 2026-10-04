import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ExercisesPage } from './pages/ExercisesPage'
import { HistoryPage } from './pages/HistoryPage'
import { SessionPage } from './pages/SessionPage'
import { SettingsPage } from './pages/SettingsPage'
import { TemplateEditPage } from './pages/TemplateEditPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { ProfileProvider } from './state/ProfileContext'
import { RestTimerProvider } from './state/RestTimer'

// Chart pages are loaded on demand.
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })))
const ExerciseDetailPage = lazy(() => import('./pages/ExerciseDetailPage').then((m) => ({ default: m.ExerciseDetailPage })))

export default function App() {
  return (
    <HashRouter>
      <ProfileProvider>
        <RestTimerProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<WorkoutPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="history/:id" element={<SessionPage />} />
              <Route path="stats" element={<Suspense><StatsPage /></Suspense>} />
              <Route path="exercise/:id" element={<Suspense><ExerciseDetailPage /></Suspense>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/exercises" element={<ExercisesPage />} />
              <Route path="settings/templates" element={<TemplatesPage />} />
              <Route path="settings/templates/:id" element={<TemplateEditPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </RestTimerProvider>
      </ProfileProvider>
    </HashRouter>
  )
}
