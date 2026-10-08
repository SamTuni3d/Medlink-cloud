'use client'

import { useEffect, useState, useTransition } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { CheckCircle, AlertCircle, Clock, XCircle, CreditCard, Zap, Building2 } from 'lucide-react'
import { getBillingAction, initiateUpgradeAction } from './actions'
import type { Subscription } from '@medlink/data-client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Subscription['status'] }) {
  const map = {
    active:    { icon: CheckCircle,  text: 'Active',     cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
    trialing:  { icon: Clock,        text: 'Free Trial',  cls: 'bg-blue-50 text-blue-700 ring-blue-200'  },
    past_due:  { icon: AlertCircle,  text: 'Past Due',    cls: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
    cancelled: { icon: XCircle,      text: 'Cancelled',  cls: 'bg-gray-50 text-gray-600 ring-gray-200'  },
    expired:   { icon: XCircle,      text: 'Expired',    cls: 'bg-red-50 text-red-700 ring-red-200'    },
  }
  const { icon: Icon, text, cls } = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      <Icon size={12} />
      {text}
    </span>
  )
}

interface PlanCardProps {
  plan: 'free' | 'starter' | 'pro'
  current: boolean
  onUpgrade: (plan: 'starter' | 'pro') => void
  isPending: boolean
}

const PLANS = {
  free:    { name: 'Free',    price: 0,   branches: 1, users: 5,  features: ['1 branch', 'Up to 5 users', 'POS & inventory', 'Basic reports'] },
  starter: { name: 'Starter', price: 150, branches: 1, users: 5,  features: ['1 branch', 'Up to 5 users', 'Full POS & inventory', 'Expiry alerts', 'Prescription tracking', 'SMS & email alerts'] },
  pro:     { name: 'Pro',     price: 350, branches: 3, users: 15, features: ['Up to 3 branches', 'Up to 15 users', 'Everything in Starter', 'Multi-branch reports', 'Priority support'] },
}

function PlanCard({ plan, current, onUpgrade, isPending }: PlanCardProps) {
  const info = PLANS[plan]
  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 ${current ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">{info.name}</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">
            {info.price === 0 ? 'Free' : `GHS ${info.price}`}
            {info.price > 0 && <span className="text-sm font-normal text-gray-500"> / mo</span>}
          </p>
        </div>
        {current && (
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">Current plan</span>
        )}
      </div>
      <ul className="space-y-2">
        {info.features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle size={14} className="text-teal-500 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {!current && plan !== 'free' && (
        <button
          onClick={() => onUpgrade(plan as 'starter' | 'pro')}
          disabled={isPending}
          className="mt-auto w-full rounded-lg py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ background: 'linear-gradient(90deg, #0ABFBC, #0D9488)' }}
        >
          {isPending ? 'Redirecting…' : `Upgrade to ${info.name}`}
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getBillingAction().then(res => {
      if (res.ok) setSub(res.data)
      else setError(res.error.message)
    })
  }, [])

  function handleUpgrade(plan: 'starter' | 'pro') {
    startTransition(async () => {
      const res = await initiateUpgradeAction(plan)
      if (res.ok && res.data.authorizationUrl) {
        window.location.href = res.data.authorizationUrl
      } else if (!res.ok) {
        setError(res.error.message)
      }
    })
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle size={16} />
        {error}
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl bg-gray-100" />)}
        </div>
      </div>
    )
  }

  const trialDaysLeft = sub.status === 'trialing'
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Plan</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your MedLink subscription.</p>
      </div>

      {/* Current plan summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
              <CreditCard size={20} className="text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 capitalize">{sub.plan} plan</p>
              {trialDaysLeft !== null && (
                <p className="text-xs text-gray-500">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining in trial</p>
              )}
              {sub.current_period_end && (
                <p className="text-xs text-gray-500">
                  Renews {new Date(sub.current_period_end).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={sub.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 size={14} className="text-gray-400" />
            <span><strong className="text-gray-900">{sub.max_branches}</strong> branch{sub.max_branches !== 1 ? 'es' : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Zap size={14} className="text-gray-400" />
            <span><strong className="text-gray-900">{sub.max_users}</strong> users</span>
          </div>
        </div>

        {sub.status === 'past_due' && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>Your last payment failed. Please update your payment method to avoid service interruption.</span>
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">Available Plans</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['free', 'starter', 'pro'] as const).map(plan => (
            <PlanCard
              key={plan}
              plan={plan}
              current={sub.plan === plan}
              onUpgrade={handleUpgrade}
              isPending={isPending}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Prices in Ghanaian Cedi (GHS). Billed monthly via Paystack. Supports MTN MoMo, Vodafone Cash, and local cards.
        </p>
      </div>
    </div>
  )
}
