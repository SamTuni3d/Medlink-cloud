'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Normalize Supabase messages — never reveal whether an email exists
    const msg = error.message.toLowerCase()
    if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('email not confirmed')) {
      return { error: 'Incorrect email or password.' }
    }
    if (msg.includes('too many') || msg.includes('rate limit')) {
      return { error: 'Too many attempts. Please wait a few minutes and try again.' }
    }
    return { error: 'Sign in failed. Please check your details and try again.' }
  }

  redirect('/dashboard')
}
