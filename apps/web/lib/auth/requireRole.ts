import type { SupabaseClient } from '@supabase/supabase-js'

type AuthError = { ok: false; error: { code: string; message: string } }
type AuthOk    = { ok: true; userId: string }

/** Validates the JWT and returns the authenticated user's ID. */
export async function requireAuth(
  client: SupabaseClient
): Promise<AuthOk | AuthError> {
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } }
  }
  return { ok: true, userId: user.id }
}

/**
 * Checks that the authenticated user holds at least one of the allowed roles.
 * Role names are validated against the database — not user-supplied metadata.
 */
export async function requireRole(
  client: SupabaseClient,
  userId: string,
  allowedRoles: string[]
): Promise<{ ok: true } | AuthError> {
  const { data } = await client
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)

  const userRoles = ((data ?? []) as unknown as { roles: { name: string } | { name: string }[] | null }[])
    .flatMap(r => {
      if (!r.roles) return []
      return Array.isArray(r.roles) ? r.roles.map(x => x.name) : [r.roles.name]
    })
    .filter((n): n is string => !!n)

  const permitted = allowedRoles.some(r => userRoles.includes(r))
  if (!permitted) {
    return {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'You do not have permission to perform this action.',
      },
    }
  }
  return { ok: true }
}
