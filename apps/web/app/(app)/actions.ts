'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOutAction() {
  const supabase = await createClient()
  // Server-side signOut clears the httpOnly auth cookies that browser JS cannot touch.
  await supabase.auth.signOut()
  redirect('/login')
}
