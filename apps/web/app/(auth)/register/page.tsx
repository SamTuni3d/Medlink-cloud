'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Building2, User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { registerOrganization } from './actions'

type State = { error?: string } | null

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)           score++
  if (pw.length >= 12)          score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' }
  if (score <= 2) return { score, label: 'Fair',   color: '#f97316' }
  if (score <= 3) return { score, label: 'Good',   color: '#eab308' }
  return              { score, label: 'Strong', color: '#a855f7' }
}

function GlassInput({
  icon: Icon, type = 'text', name, id, placeholder, autoComplete,
  required, minLength, error, rightSlot, value, onChange,
}: {
  icon: React.ElementType; type?: string; name: string; id?: string
  placeholder: string; autoComplete?: string; required?: boolean
  minLength?: number; error?: string; rightSlot?: React.ReactNode
  value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          id={id ?? name} name={name} type={type} placeholder={placeholder}
          autoComplete={autoComplete} required={required} minLength={minLength}
          value={value} onChange={onChange}
          className="h-11 w-full rounded-xl bg-white/[0.07] pl-11 pr-11 text-sm text-white placeholder:text-white/30 transition-all duration-200 focus:bg-white/[0.10] focus:outline-none"
        />
        {rightSlot && (
          <div className="absolute right-0 top-0 flex h-full items-center pr-4">{rightSlot}</div>
        )}
      </div>
      {error && <p className="mt-1.5 pl-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function PasswordField({
  name, id, placeholder, autoComplete, value, onChange,
}: {
  name: string; id: string; placeholder?: string; autoComplete?: string
  value: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <GlassInput
      icon={Lock} type={show ? 'text' : 'password'} name={name} id={id}
      placeholder={placeholder ?? '••••••••'} autoComplete={autoComplete}
      required value={value} onChange={e => onChange(e.target.value)}
      rightSlot={
        <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="text-white/30 transition-colors hover:text-white/60">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  )
}

export default function RegisterPage() {
  const [password,  setPassword]  = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const pw      = formData.get('password')       as string
      const confirm = formData.get('confirmPassword') as string
      if (pw.length < 8)  return { error: 'Password must be at least 8 characters.' }
      if (pw !== confirm) return { error: 'Passwords do not match.' }
      return registerOrganization(formData)
    },
    null
  )

  const strength = passwordStrength(password)
  const pwMatch  = confirmPw.length > 0 && password === confirmPw

  return (
    <div
      className="w-full rounded-2xl p-7"
      style={{
        background: 'rgba(20,5,50,0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.35)',
      }}
    >
      <h1 className="text-2xl font-bold tracking-tight text-white">Create account</h1>
      <p className="mt-1.5 text-xs text-white/35">
        Already have an account?{' '}
        <Link href="/login" className="text-purple-300 transition-colors hover:text-purple-200">
          Sign in
        </Link>
      </p>

      <form action={formAction} className="mt-5 space-y-3" noValidate>
        <GlassInput
          icon={Building2} name="organizationName"
          placeholder="Pharmacy name" required minLength={2}
        />

        <GlassInput
          icon={User} name="fullName"
          placeholder="Your full name" autoComplete="name" required minLength={2}
        />

        <GlassInput
          icon={Mail} type="email" name="email"
          placeholder="Work email" autoComplete="email" required
        />

        <div className="space-y-1.5">
          <PasswordField
            id="password" name="password"
            placeholder="Password" autoComplete="new-password"
            value={password} onChange={setPassword}
          />
          {password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{ background: i < strength.score ? strength.color : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <p className="pl-0.5 text-xs" style={{ color: strength.color }}>
                {strength.label}
                {strength.score < 3 && (
                  <span className="ml-1 text-white/25">— add numbers or symbols</span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <PasswordField
            id="confirmPassword" name="confirmPassword"
            placeholder="Confirm password" autoComplete="new-password"
            value={confirmPw} onChange={setConfirmPw}
          />
          {confirmPw.length > 0 && !pwMatch && (
            <p className="pl-1 text-xs text-red-400">Passwords do not match</p>
          )}
          {pwMatch && (
            <p className="pl-1 text-xs text-purple-400">Passwords match ✓</p>
          )}
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <motion.button
          type="submit" disabled={isPending}
          whileHover={!isPending ? { scale: 1.016 } : undefined}
          whileTap={!isPending  ? { scale: 0.978 } : undefined}
          className="auth-btn-shimmer relative mt-1 h-11 w-full overflow-hidden rounded-xl font-semibold text-white shadow-lg transition-all duration-300 disabled:opacity-60"
          style={{
            background: isPending
              ? 'linear-gradient(90deg,#c2410c,#dc2626)'
              : 'linear-gradient(90deg,#f97316,#ef4444)',
            boxShadow: '0 4px 24px rgba(249,115,22,0.35)',
          }}
        >
          <span className="relative flex items-center justify-center gap-2 text-sm">
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
              : 'Create account'}
          </span>
        </motion.button>
      </form>

      <p className="mt-4 text-center text-[11px] text-white/20">
        By creating an account you agree to our{' '}
        <Link href="#" className="text-white/35 underline-offset-2 hover:text-white/55 hover:underline">
          Terms
        </Link>{' '}
        &{' '}
        <Link href="#" className="text-white/35 underline-offset-2 hover:text-white/55 hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
