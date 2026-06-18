'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck, RefreshCw, CheckCircle2, AlertTriangle,
  ChevronUp, ChevronDown, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getInventory, submitStockTake } from '@medlink/data-client'
import type { InventoryWithBatches } from '@medlink/data-client'

interface CountRow {
  inventoryId: string
  medicationId: string
  medicationName: string
  genericName: string | null
  category: string | null
  systemCount: number
  physicalCount: string   // string so the input is always controlled
}

type SortKey = 'name' | 'category' | 'delta'
type SortDir = 'asc' | 'desc'

function deltaClass(delta: number) {
  if (delta === 0) return 'text-slate-400'
  return delta > 0
    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
    : 'text-red-600 dark:text-red-400 font-semibold'
}

function deltaLabel(delta: number) {
  if (delta === 0) return '—'
  return delta > 0 ? `+${delta}` : String(delta)
}

export default function StockTakePage() {
  const { activeBranch } = useBranch()
  const { user, organizationId } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [rows, setRows] = useState<CountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [error, setError] = useState<string | null>(null)

  // Keep a ref map for keyboard navigation between count inputs
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true); setError(null)
    const result = await getInventory(createClient(), activeBranch.id)
    if (!result.ok) { setError(result.error.message); setLoading(false); return }

    setRows(
      result.data.map((r: InventoryWithBatches) => ({
        inventoryId: r.inventory_id,
        medicationId: r.medication_id,
        medicationName: r.medication_name,
        genericName: r.generic_name,
        category: r.category,
        systemCount: r.available_stock,
        physicalCount: String(r.available_stock),
      }))
    )
    setLoading(false)
  }, [activeBranch])

  useEffect(() => { void load() }, [load])

  function setCount(medicationId: string, value: string) {
    setRows(prev =>
      prev.map(r => r.medicationId === medicationId ? { ...r, physicalCount: value } : r)
    )
  }

  // Navigate to next row on Enter
  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const filtered = displayRows
    const nextItem = filtered[idx + 1]
    if (nextItem) inputRefs.current.get(nextItem.medicationId)?.focus()
  }

  const discrepancies = useMemo(() =>
    rows.filter(r => {
      const phys = parseInt(r.physicalCount)
      return !isNaN(phys) && phys !== r.systemCount
    }),
    [rows]
  )

  const netDelta = useMemo(() =>
    discrepancies.reduce((sum, r) => sum + (parseInt(r.physicalCount) - r.systemCount), 0),
    [discrepancies]
  )

  const displayRows = useMemo(() => {
    let filtered = rows
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        r.medicationName.toLowerCase().includes(q) ||
        (r.genericName ?? '').toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q)
      )
    }
    if (showDiscrepanciesOnly) {
      filtered = filtered.filter(r => {
        const phys = parseInt(r.physicalCount)
        return !isNaN(phys) && phys !== r.systemCount
      })
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.medicationName.localeCompare(b.medicationName)
      else if (sortKey === 'category') cmp = (a.category ?? '').localeCompare(b.category ?? '')
      else if (sortKey === 'delta') {
        const da = parseInt(a.physicalCount) - a.systemCount
        const db = parseInt(b.physicalCount) - b.systemCount
        cmp = da - db
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, showDiscrepanciesOnly, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="h-3 w-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 opacity-80" />
      : <ChevronDown className="h-3 w-3 opacity-80" />
  }

  async function handleSubmit() {
    if (!activeBranch || !organizationId || !user) return
    if (rows.length === 0) return

    const items = rows.map(r => ({
      medicationId: r.medicationId,
      medicationName: r.medicationName,
      systemCount: r.systemCount,
      physicalCount: Math.max(0, parseInt(r.physicalCount) || 0),
    }))

    setSubmitting(true)
    const result = await submitStockTake(createClient(), {
      organizationId,
      branchId: activeBranch.id,
      performedBy: user.id,
      notes: notes.trim() || undefined,
      items,
    })
    setSubmitting(false)

    if (!result.ok) {
      toast({ title: 'Stock take failed', description: result.error.message, variant: 'destructive' })
      return
    }

    const { discrepancyCount, netDelta: nd } = result.data
    toast({
      title: 'Stock take submitted',
      description: discrepancyCount === 0
        ? 'All counts matched — inventory is accurate.'
        : `${discrepancyCount} discrepanc${discrepancyCount === 1 ? 'y' : 'ies'} corrected (net ${nd >= 0 ? '+' : ''}${nd} units).`,
    })
    router.push('/inventory')
  }

  const counted    = rows.filter(r => r.physicalCount !== '').length
  const uncounted  = rows.length - counted

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Stock Take
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Enter the physical count for each medication. Discrepancies are adjusted automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || submitting}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to start a stock take.</p>
      )}

      {/* Summary bar */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Items',    value: rows.length,            color: '' },
            { label: 'Counted',        value: counted,                color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Uncounted',      value: uncounted,              color: uncounted > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
            { label: 'Discrepancies',  value: discrepancies.length,   color: discrepancies.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color || 'text-slate-900 dark:text-slate-100'}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Net delta banner */}
      {discrepancies.length > 0 && (
        <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
          netDelta === 0
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            : netDelta > 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {discrepancies.length} item{discrepancies.length !== 1 ? 's' : ''} differ from system count —
          net variance: <span className="font-bold ml-1">{netDelta >= 0 ? '+' : ''}{netDelta} units</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medication…"
            className="pl-9"
          />
        </div>
        <Button
          variant={showDiscrepanciesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowDiscrepanciesOnly(v => !v)}
          className="shrink-0"
        >
          {showDiscrepanciesOnly ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
          {showDiscrepanciesOnly ? 'Showing discrepancies' : 'Show discrepancies only'}
        </Button>
      </div>

      {/* Count sheet table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : displayRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {showDiscrepanciesOnly ? 'No discrepancies yet — all counts match.' : 'No medications found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center gap-1">Medication <SortIcon k="name" /></span>
                  </th>
                  <th
                    className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none md:table-cell"
                    onClick={() => toggleSort('category')}
                  >
                    <span className="flex items-center gap-1">Category <SortIcon k="category" /></span>
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    System
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Physical Count
                  </th>
                  <th
                    className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none"
                    onClick={() => toggleSort('delta')}
                  >
                    <span className="flex items-center justify-center gap-1">Variance <SortIcon k="delta" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayRows.map((row, idx) => {
                  const phys = parseInt(row.physicalCount)
                  const delta = isNaN(phys) ? 0 : phys - row.systemCount
                  const hasDiscrepancy = !isNaN(phys) && delta !== 0
                  return (
                    <tr
                      key={row.medicationId}
                      className={hasDiscrepancy ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{row.medicationName}</p>
                        {row.genericName && (
                          <p className="text-xs text-slate-500 mt-0.5">{row.genericName}</p>
                        )}
                      </td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        {row.category ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {row.category}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-slate-600 dark:text-slate-300 font-mono text-base font-semibold">
                          {row.systemCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Input
                          ref={el => {
                            if (el) inputRefs.current.set(row.medicationId, el)
                            else inputRefs.current.delete(row.medicationId)
                          }}
                          type="number"
                          min="0"
                          value={row.physicalCount}
                          onChange={e => setCount(row.medicationId, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          className={`w-24 mx-auto text-center font-mono font-semibold ${
                            hasDiscrepancy ? 'border-amber-400 focus:ring-amber-400' : ''
                          }`}
                        />
                      </td>
                      <td className={`px-5 py-3 text-center font-mono text-base ${deltaClass(delta)}`}>
                        {deltaLabel(delta)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-2.5 text-xs text-slate-500">
              Showing {displayRows.length} of {rows.length} items
            </div>
          </div>
        )}
      </div>

      {/* Notes + Submit */}
      {rows.length > 0 && !loading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Monthly count, shelf reorganisation…"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {discrepancies.length === 0
                ? 'All counts match system — no adjustments needed.'
                : `${discrepancies.length} adjustment${discrepancies.length !== 1 ? 's' : ''} will be recorded.`}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push('/inventory')} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={submitting || rows.length === 0}>
                {submitting ? 'Submitting…' : (
                  <>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Submit Stock Take
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
