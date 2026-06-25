'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerOrganization } from './actions'

type State = { error?: string } | null

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' }
  if (score <= 2) return { score, label: 'Fair',   color: '#f97316' }
  if (score <= 3) return { score, label: 'Good',   color: '#eab308' }
  return              { score, label: 'Strong', color: '#22c55e' }
}

function PasswordInput({
  id, name, placeholder, autoComplete, value, onChange, required,
}: {
  id: string
  name: string
  placeholder?: string
  autoComplete?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function RegisterPage() {
  const [password, setPassword]       = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const pw      = formData.get('password') as string
      const confirm = formData.get('confirmPassword') as string
      if (pw.length < 8)     return { error: 'Password must be at least 8 characters.' }
      if (pw !== confirm)    return { error: 'Passwords do not match.' }
      return registerOrganization(formData)
    },
    null
  )

  const strength = passwordStrength(password)
  const segments = 4

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="MedLink" className="mx-auto mb-7 h-12 w-auto" />

      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Create your pharmacy</h1>
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
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              required
            />
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {Array.from({ length: segments }).map((_, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        background: i < strength.score
                          ? strength.color
                          : 'hsl(175 18% 87%)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: strength.color }}>
                  {strength.label}
                  {strength.score < 3 && (
                    <span className="ml-1 text-muted-foreground">
                      — try adding numbers or symbols
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPw}
              onChange={setConfirmPw}
              required
            />
            {confirmPw.length > 0 && password !== confirmPw && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
            {confirmPw.length > 0 && password === confirmPw && (
              <p className="text-xs text-green-600">Passwords match ✓</p>
            )}
          </div>

          {state?.error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
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
