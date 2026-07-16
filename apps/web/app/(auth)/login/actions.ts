'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const LoginSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(1).max(512),
})

export async function signIn(formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!checkRateLimit(`login:${ip}`, 10)) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  }

  const parsed = LoginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Incorrect email or password.' }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('invalid login') ||
      msg.includes('invalid credentials') ||
      msg.includes('email not confirmed')
    ) {
      return { error: 'Incorrect email or password.' }
    }
    if (msg.includes('too many') || msg.includes('rate limit')) {
      return { error: 'Too many attempts. Please wait a few minutes and try again.' }
    }
    // Never surface raw Supabase messages to the client
    return { error: 'Sign in failed. Please check your details and try again.' }
  }

  redirect('/dashboard')
}
