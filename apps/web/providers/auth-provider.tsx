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

async function resolveOrgId(
  supabase: ReturnType<typeof createClient>,
  session: Session | null
): Promise<string | null> {
  // Fast path: org_id is already baked into the JWT metadata
  const metaOrgId = session?.user?.user_metadata?.organization_id as string | undefined
  if (metaOrgId) return metaOrgId

  // Fallback: metadata missing (old account / registration glitch) — query the DB
  const uid = session?.user?.id
  if (!uid) return null

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', uid)
    .single()

  const orgId = (data as { organization_id: string | null } | null)?.organization_id ?? null

  // If found, also patch user_metadata so next load is instant
  if (orgId) {
    void supabase.auth.updateUser({
      data: {
        ...session?.user?.user_metadata,
        organization_id: orgId,
      },
    })
  }

  return orgId
}

async function resolveRoles(
  supabase: ReturnType<typeof createClient>,
  user: User | null
): Promise<RoleName[]> {
  // Fast path: roles are in metadata
  const metaRoles = user?.user_metadata?.roles as RoleName[] | undefined
  if (metaRoles?.length) return metaRoles

  if (!user?.id) return []

  // Fallback: query user_roles → roles join
  const { data } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)

  const names = (data as { roles: { name: string } | null }[] | null)
    ?.map(r => r.roles?.name)
    .filter(Boolean) as RoleName[] | undefined

  return names ?? []
}

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

    async function applySession(session: Session | null) {
      const [orgId, roles] = await Promise.all([
        resolveOrgId(supabase, session),
        resolveRoles(supabase, session?.user ?? null),
      ])

      const primary = ROLE_PRIORITY.find(r => roles.includes(r)) ?? roles[0] ?? null

      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        organizationId: orgId,
        primaryRole: primary,
      })
    }

    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session)
    })

    // Live auth state changes (sign-in, sign-out, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
