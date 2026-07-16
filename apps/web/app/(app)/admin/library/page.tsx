import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPendingSuggestions } from '@medlink/data-client'
import LibraryReviewClient from './LibraryReviewClient'

export const dynamic = 'force-dynamic'

export default async function AdminLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // SECURITY: user_metadata is user-writable — validate role against the database.
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)

  const roleNames = (roleRows as { roles: { name: string } | null }[] | null)
    ?.map(r => r.roles?.name)
    .filter(Boolean) ?? []

  if (!roleNames.includes('super_admin')) redirect('/dashboard')

  const result = await getPendingSuggestions(supabase)
  const suggestions = result.ok ? result.data : []

  return <LibraryReviewClient userId={user.id} initialSuggestions={suggestions} />
}
