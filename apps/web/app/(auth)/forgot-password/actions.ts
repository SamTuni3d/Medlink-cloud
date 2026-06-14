'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string

  const headersList = await headers()
  const origin = headersList.get('origin') ?? ''

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
