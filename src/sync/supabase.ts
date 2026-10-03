import { createClient } from '@supabase/supabase-js'
import { SupabaseRemote } from './remote'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
export const remote = supabase ? new SupabaseRemote(supabase) : null

export function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured')
  // Return to the app's own URL (works on any static host / sub-path); HashRouter state is not needed.
  const redirectTo = window.location.href.split('#')[0].split('?')[0]
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}
