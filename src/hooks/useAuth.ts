import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/api/supabase'
import i18n from '@/i18n/config'
import type { Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session then stop the loading state
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      setLoading(false) // clear loading as soon as auth state is known
      if (currentUser) {
        try {
          const p = await fetchProfile(currentUser.id)
          setProfile(p)
          if (p?.preferred_language) {
            void i18n.changeLanguage(p.preferred_language)
          }
        } catch {
          // fetch auth failed implicitly
        }
      }
    }).catch(() => {
      setLoading(false)
    })

    // Keep auth state in sync after sign-in / sign-out / token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      setLoading(false) // also clear here in case getSession() is slow
      if (currentUser) {
        // Defer profile fetch so the auth lock is released first.
        // Making async Supabase DB calls directly inside onAuthStateChange
        // causes a GoTrueClient deadlock that blocks all other DB operations.
        setTimeout(async () => {
          try {
            const p = await fetchProfile(currentUser.id)
            setProfile(p)
            if (p?.preferred_language) {
              void i18n.changeLanguage(p.preferred_language)
            }
          } catch {
            // fail silently to avoid exposing errors
          }
        }, 0)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
  ): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, profile, loading, signIn, signUp, signOut } },
    children,
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
