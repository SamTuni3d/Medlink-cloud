'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerOrganization } from './actions'

type State = { error?: string } | null

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const password = formData.get('password') as string
      const confirm = formData.get('confirmPassword') as string
      if (password !== confirm) return { error: 'Passwords do not match' }
      if (password.length < 8) return { error: 'Password must be at least 8 characters' }
      return registerOrganization(formData)
    },
    null
  )

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="MedLink" className="mx-auto mb-7 h-12 w-auto" />
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create your pharmacy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up MedLink Cloud for your organization
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="organizationName">Pharmacy name</Label>
          <Input
            id="organizationName"
            name="organizationName"
            placeholder="Accra Central Pharmacy"
            required
            minLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Your full name</Label>
          <Input
            id="fullName"
            name="fullName"
            placeholder="Kofi Mensah"
            autoComplete="name"
            required
            minLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="kofi@pharmacyname.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {state?.error && (
          <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
    </div>
  )
}
