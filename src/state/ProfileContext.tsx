import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { store, type Profile } from '../data'
import { useQuery } from '../data/useQuery'

const KEY = 'heavystuff.currentProfileId'

interface ProfileCtx {
  profile: Profile
  setProfileId: (id: string | null) => void
}

const Ctx = createContext<ProfileCtx | null>(null)

export function useProfile(): ProfileCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile outside ProfileProvider')
  return v
}

/**
 * Local profiles stand in for real authentication. When a hosted backend is added,
 * replace this provider with one backed by the auth session (e.g. Supabase auth user).
 */
export function ProfileProvider({ children, fallback }: { children: ReactNode; fallback: (select: (id: string) => void) => ReactNode }) {
  const [profileId, setId] = useState<string | null>(() => localStorage.getItem(KEY))
  const profile = useQuery(() => (profileId ? store.getProfile(profileId) : Promise.resolve(undefined)), [profileId])
  const [checked, setChecked] = useState(false)

  const setProfileId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
    setId(id)
  }, [])

  useEffect(() => {
    if (!profileId) return setChecked(true)
    store.getProfile(profileId).then((p) => {
      if (!p) setProfileId(null)
      setChecked(true)
    })
  }, [profileId, setProfileId])

  if (!profileId) return <>{fallback(setProfileId)}</>
  if (!checked || !profile) return null
  return <Ctx.Provider value={{ profile, setProfileId }}>{children}</Ctx.Provider>
}
