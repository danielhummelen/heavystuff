import { NavLink, Outlet } from 'react-router-dom'
import { useProfile } from '../state/ProfileContext'
import { RestTimerBar } from './RestTimerBar'

const tabs = [
  { to: '/', label: 'Workout', icon: '🏋️', end: true },
  { to: '/history', label: 'History', icon: '📅' },
  { to: '/stats', label: 'Stats', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Layout() {
  const { sync, signIn } = useProfile()
  return (
    <div className="app">
      <main className="content">
        {!sync && (
          <div className="banner small">
            Not signed in – changes are kept on this device until you{' '}
            <button className="link-btn" onClick={signIn}>
              sign in again
            </button>
            .
          </div>
        )}
        <Outlet />
      </main>
      <RestTimerBar />
      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageHeader({ title, back, action }: { title: string; back?: boolean; action?: React.ReactNode }) {
  return (
    <header className="page-header">
      {back && (
        <button className="icon-btn" onClick={() => history.back()} aria-label="Back">
          ‹
        </button>
      )}
      <h1>{title}</h1>
      <div className="grow" />
      {action}
    </header>
  )
}
