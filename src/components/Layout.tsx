import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { autoFinishStaleSession } from '../lib/sessionOps'
import { useProfile } from '../state/ProfileContext'
import { useRestTimer } from '../state/RestTimer'
import { RestTimerBar } from './RestTimerBar'

function useAutoFinishStaleSession(profileId: string) {
  const { stop } = useRestTimer()
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      if (await autoFinishStaleSession(profileId)) stop()
    }
    void check()
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [profileId, stop])
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const tabs = [
  {
    to: '/',
    label: 'Workout',
    end: true,
    icon: (
      <Icon>
        <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
      </Icon>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <Icon>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </Icon>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: (
      <Icon>
        <path d="M4 19h16M7 15v-3M12 15V7M17 15v-5" />
      </Icon>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <Icon>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </Icon>
    ),
  },
]

export function Layout() {
  const { profile, sync, signIn } = useProfile()
  useAutoFinishStaleSession(profile.id)
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
