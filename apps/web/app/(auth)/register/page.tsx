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
  icon: Icon, type = 'text', placeholder, autoComplete, name, id,
  required, error, rightSlot, value, onChange, minLength,
}: {
  icon: React.ElementType; type?: string; placeholder: string
  autoComplete?: string; name: string; id?: string; required?: boolean
  error?: string; rightSlot?: React.ReactNode
  value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  minLength?: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          id={id ?? name} name={name} type={type} placeholder={placeholder}
          autoComplete={autoComplete} required={required} minLength={minLength}
          value={value} onChange={onChange}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-10 pr-11 text-sm text-white placeholder:text-white/20 backdrop-blur-sm transition-all duration-200 focus:border-purple-500/60 focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_rgba(147,51,234,0.15)] focus:outline-none"
        />
        {rightSlot && (
          <div className="absolute right-0 top-0 flex h-full items-center pr-3.5">{rightSlot}</div>
        )}
      </div>
      {error && <p className="pl-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block pl-0.5 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
      {children}
    </label>
  )
}

function PasswordField({ name, id, placeholder, autoComplete, value, onChange }: {
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
          className="text-white/25 transition-colors hover:text-white/60">
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
    <div>
      <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.04] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-[48px]">

        {/* Logo */}
        <div className="mb-7 flex flex-col items-center gap-2.5">
          <div className="relative">
            <div className="auth-glow-breathe absolute -inset-3 rounded-full bg-purple-500/20 blur-xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="MedLink" className="relative h-10 w-auto" />
          </div>
          <span className="text-[10px] font-semibold tracking-[0.25em] text-white/35 uppercase">MedLink Cloud</span>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-[1.5rem] font-bold leading-tight text-white">Create your pharmacy</h1>
          <p className="mt-1.5 text-sm text-white/35">Set up MedLink Cloud for your organisation</p>
        </div>

        <form action={formAction} className="space-y-3.5" noValidate>
          <div className="space-y-1">
            <FieldLabel>Pharmacy Name</FieldLabel>
            <GlassInput icon={Building2} name="organizationName" placeholder="Accra Central Pharmacy" required minLength={2} />
          </div>

          <div className="space-y-1">
            <FieldLabel>Your Full Name</FieldLabel>
            <GlassInput icon={User} name="fullName" placeholder="Kofi Mensah" autoComplete="name" required minLength={2} />
          </div>

          <div className="space-y-1">
            <FieldLabel>Work Email</FieldLabel>
            <GlassInput icon={Mail} type="email" name="email" placeholder="kofi@pharmacyname.com" autoComplete="email" required />
          </div>

          <div className="space-y-1">
            <FieldLabel>Password</FieldLabel>
            <PasswordField id="password" name="password" autoComplete="new-password" value={password} onChange={setPassword} />
            {password.length > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="flex gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ background: i < strength.score ? strength.color : 'rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
                <p className="pl-0.5 text-xs" style={{ color: strength.color }}>
                  {strength.label}
                  {strength.score < 3 && <span className="ml-1 text-white/30">— try adding numbers or symbols</span>}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <FieldLabel>Confirm Password</FieldLabel>
            <PasswordField id="confirmPassword" name="confirmPassword" autoComplete="new-password" value={confirmPw} onChange={setConfirmPw} />
            {confirmPw.length > 0 && !pwMatch && <p className="pl-0.5 text-xs text-red-400">Passwords do not match</p>}
            {pwMatch && <p className="pl-0.5 text-xs text-purple-400">Passwords match ✓</p>}
          </div>

          {state?.error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{state.error}</div>
          )}

          <motion.button
            type="submit" disabled={isPending}
            whileHover={!isPending ? { scale: 1.018 } : undefined}
            whileTap={!isPending  ? { scale: 0.975 } : undefined}
            className="auth-btn-shimmer relative mt-1 h-12 w-full overflow-hidden rounded-full bg-gradient-to-r from-purple-800 via-purple-600 to-violet-500 font-semibold text-white shadow-[0_0_30px_rgba(147,51,234,0.4)] transition-shadow duration-300 disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-[0_0_50px_rgba(147,51,234,0.6)]"
          >
            <span className="relative flex items-center justify-center gap-2 text-sm">
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : 'Create Account'}
            </span>
          </motion.button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11px] text-white/25">Already have an account?</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <Link href="/login"
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-sm font-medium text-white/60 transition-all duration-200 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white">
          Sign in instead
        </Link>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/20">
        By creating an account you agree to MedLink&apos;s{' '}
        <Link href="#" className="text-white/35 underline-offset-2 hover:text-white/50 hover:underline">Terms of Service</Link>
        {' '}and{' '}
        <Link href="#" className="text-white/35 underline-offset-2 hover:text-white/50 hover:underline">Privacy Policy</Link>
      </p>
    </div>
  )
}
