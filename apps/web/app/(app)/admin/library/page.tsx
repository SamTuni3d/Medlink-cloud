import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPendingSuggestions } from '@medlink/data-client'
import LibraryReviewClient from './LibraryReviewClient'

export const dynamic = 'force-dynamic'

export default async function AdminLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.user_metadata?.role as string | undefined
  if (role !== 'super_admin') redirect('/dashboard')

  const result = await getPendingSuggestions(supabase)
  const suggestions = result.ok ? result.data : []

  return <LibraryReviewClient userId={user.id} initialSuggestions={suggestions} />
}
