'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { RoleName } from '@medlink/data-client'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  /** Role with highest privilege the user holds — null while loading */
  primaryRole: RoleName | null
  organizationId: string | null
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  primaryRole: null,
  organizationId: null,
})

const ROLE_PRIORITY: RoleName[] = [
  'super_admin',
  'org_admin',
  'branch_manager',
  'pharmacist',
  'cashier',
  'inventory_manager',
  'auditor',
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    primaryRole: null,
    organizationId: null,
  })

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session,
        loading: false,
        organizationId:
          (session?.user?.user_metadata?.organization_id as string) ?? null,
      }))
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
          organizationId:
            (session?.user?.user_metadata?.organization_id as string) ?? null,
        }))
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // Derive primaryRole from user_metadata roles array (set during registration)
  useEffect(() => {
    if (!state.user) {
      setState(prev => ({ ...prev, primaryRole: null }))
      return
    }
    const roles: RoleName[] =
      (state.user.user_metadata?.roles as RoleName[]) ?? []
    const primary =
      ROLE_PRIORITY.find(r => roles.includes(r)) ?? roles[0] ?? null
    setState(prev => ({ ...prev, primaryRole: primary }))
  }, [state.user])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
