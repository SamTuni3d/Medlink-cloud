'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle, Clock, RefreshCw, PackageX, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getExpiringBatches, recordStockMovement } from '@medlink/data-client'
import type { ExpiringBatch } from '@medlink/data-client'

type Risk = 'critical' | 'high' | 'medium'

interface ExpiryRow extends ExpiringBatch {
  days_to_expiry: number
  risk: Risk
}

const RISK_CONFIG: Record<Risk, { label: string; badge: string; icon: string }> = {
  critical: { label: 'Critical', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',    icon: 'text-red-500' },
  high:     { label: 'High',     badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: 'text-amber-500' },
  medium:   { label: 'Medium',   badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500', icon: 'text-yellow-500' },
}

function getRisk(days: number): Risk {
  if (days <= 30) return 'critical'
  if (days <= 60) return 'high'
  return 'medium'
}

export default function ExpiryPage() {
  const { activeBranch } = useBranch()
  const { user, organizationId } = useAuth()
  const { toast } = useToast()

  const [rows, setRows] = useState<ExpiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [writeOffTarget, setWriteOffTarget] = useState<ExpiryRow | null>(null)
  const [writingOff, setWritingOff] = useState(false)
  const [riskFilter, setRiskFilter] = useState<Risk | 'all'>('all')

  const load = useCallback(async () => {
    if (!activeBranch || !organizationId) { setLoading(false); return }
    setLoading(true); setError(null)

    const result = await getExpiringBatches(createClient(), activeBranch.id, organizationId)
    if (!result.ok) { setError(result.error.message); setLoading(false); return }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const expiryRows: ExpiryRow[] = result.data.map(b => {
      const expiry = new Date(b.expiry_date!)
      expiry.setHours(0, 0, 0, 0)
      const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
      return { ...b, days_to_expiry: days, risk: getRisk(days) }
    })

    setRows(expiryRows)
    setLoading(false)
  }, [activeBranch, organizationId])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() =>
    riskFilter === 'all' ? rows : rows.filter(r => r.risk === riskFilter),
    [rows, riskFilter]
  )

  const counts = useMemo(() => ({
    critical: rows.filter(r => r.risk === 'critical').length,
    high:     rows.filter(r => r.risk === 'high').length,
    medium:   rows.filter(r => r.risk === 'medium').length,
  }), [rows])

  const totalAtRisk = rows.reduce((sum, r) => sum + r.quantity_remaining, 0)

  async function handleWriteOff() {
    if (!writeOffTarget || !activeBranch || !organizationId || !user) return
    setWritingOff(true)

    const result = await recordStockMovement(createClient(), {
      organization_id: organizationId,
      branch_id: activeBranch.id,
      medication_id: writeOffTarget.medication_id,
      batch_id: writeOffTarget.id,
      movement_type: 'expiry_write_off',
      delta: -writeOffTarget.quantity_remaining,
      notes: `Expiry write-off — batch ${writeOffTarget.batch_number}, expires ${writeOffTarget.expiry_date}`,
      performed_by: user.id,
    })

    setWritingOff(false)
    const target = writeOffTarget
    setWriteOffTarget(null)

    if (!result.ok) {
      toast({ title: 'Write-off failed', description: result.error.message, variant: 'destructive' })
      return
    }

    toast({
      title: 'Stock written off',
      description: `${target.quantity_remaining} units of ${target.medication_name} (batch ${target.batch_number}) removed.`,
    })
    void load()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="h-6 w-6 text-amber-500" />
            Expiry Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Medications expiring within 90 days — act before stock becomes unsellable.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Critical (≤30d)', value: counts.critical, color: 'text-red-600 dark:text-red-400' },
          { label: 'High (≤60d)',     value: counts.high,     color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Medium (≤90d)',   value: counts.medium,   color: 'text-yellow-600 dark:text-yellow-500' },
          { label: 'Units at Risk',   value: totalAtRisk,     color: rows.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{loading ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Risk filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'critical', 'high', 'medium'] as const).map(f => (
          <button
            key={f}
            onClick={() => setRiskFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              riskFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f === 'all' ? `All (${rows.length})` : `${RISK_CONFIG[f].label} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {rows.length === 0 ? 'No medications expiring within 90 days.' : 'No items in this category.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Medication</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Batch</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Expires</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Days Left</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Qty Remaining</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Risk</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(row => {
                  const cfg = RISK_CONFIG[row.risk]
                  return (
                    <tr key={row.id} className={row.risk === 'critical' ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{row.medication_name}</td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{row.batch_number}</td>
                      <td className="px-5 py-4 text-center text-sm text-slate-600 dark:text-slate-300">
                        {new Date(row.expiry_date!).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-lg font-bold ${
                          row.days_to_expiry <= 30 ? 'text-red-600 dark:text-red-400' :
                          row.days_to_expiry <= 60 ? 'text-amber-600 dark:text-amber-400' :
                          'text-yellow-600 dark:text-yellow-500'
                        }`}>
                          {row.days_to_expiry}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {row.quantity_remaining}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                          <AlertTriangle className={`mr-1 h-3 w-3 ${cfg.icon}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          onClick={() => setWriteOffTarget(row)}
                        >
                          <PackageX className="mr-1.5 h-3.5 w-3.5" />
                          Write Off
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-2.5 text-xs text-slate-500">
              {filtered.length} batch{filtered.length !== 1 ? 'es' : ''} at risk
            </div>
          </div>
        )}
      </div>

      {/* Write-off confirm dialog */}
      <Dialog open={!!writeOffTarget} onOpenChange={v => { if (!v) setWriteOffTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <PackageX className="h-5 w-5" />
              Confirm Write-Off
            </DialogTitle>
          </DialogHeader>
          {writeOffTarget && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This will permanently remove{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{writeOffTarget.quantity_remaining} units</span>{' '}
                of <span className="font-semibold text-slate-900 dark:text-slate-100">{writeOffTarget.medication_name}</span>{' '}
                (batch <span className="font-mono">{writeOffTarget.batch_number}</span>) from stock.
              </p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-500 space-y-1">
                <p>Expiry: <span className="font-medium">{new Date(writeOffTarget.expiry_date!).toLocaleDateString('en-GH', { day: '2-digit', month: 'long', year: 'numeric' })}</span></p>
                <p>Days remaining: <span className="font-medium text-red-500">{writeOffTarget.days_to_expiry} days</span></p>
                <p>Units: <span className="font-medium">{writeOffTarget.quantity_remaining}</span></p>
              </div>
              <p className="text-xs text-slate-400">An <code>expiry_write_off</code> movement will be recorded in the audit log.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOffTarget(null)} disabled={writingOff}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleWriteOff()} disabled={writingOff}>
              {writingOff ? 'Writing off…' : 'Confirm Write-Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
