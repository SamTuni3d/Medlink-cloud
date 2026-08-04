'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function signOutAction() {
  const supabase = await createClient()

  // Revoke the server-side session token.
  await supabase.auth.signOut({ scope: 'global' })

  // Belt-and-suspenders: manually expire every Supabase auth cookie so the
  // middleware's hasSession check sees no session, regardless of whether the
  // SSR library's setAll handler cleared them during signOut().
  const cookieStore = await cookies()
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith('sb-') && name.includes('-auth-token')) {
      cookieStore.set(name, '', { maxAge: 0, path: '/' })
    }
  }

  redirect('/login')
}
