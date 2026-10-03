'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Receipt, Search, Download, Eye, Ban, Calendar, ChevronDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getSales, getSaleById } from '@medlink/data-client'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Sale, SaleItem } from '@medlink/data-client'
import { voidSaleAction } from '../actions'

const PAGE_SIZE = 50

type Preset = '30d' | '90d' | 'year' | 'all'

const PRESETS: { key: Preset; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

function presetStart(preset: Preset): string | undefined {
  const d = new Date()
  if (preset === '30d') { d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (preset === '90d') { d.setDate(d.getDate() - 90); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (preset === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d.toISOString() }
  return undefined // all time
}

function statusVariant(status: Sale['status']): 'default' | 'destructive' | 'secondary' {
  if (status === 'completed') return 'default'
  if (status === 'voided') return 'destructive'
  return 'secondary'
}

function paymentLabel(method: Sale['payment_method']) {
  const map: Record<string, string> = {
    cash: 'Cash', card: 'Card', mobile_money: 'Mobile Money', credit: 'Credit',
  }
  return map[method] ?? method
}

function exportCSV(sales: Sale[]) {
  const header = ['Sale #', 'Date', 'Customer', 'Cashier', 'Payment', 'Total', 'Currency', 'Status']
  const rows = sales.map(s => [
    s.sale_number,
    new Date(s.created_at).toLocaleString('en-GH'),
    s.customer_name ?? '',
    s.cashier_name ?? '',
    paymentLabel(s.payment_method),
    s.total_amount.toFixed(2),
    s.currency_code,
    s.status,
  ])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-history-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SalesHistoryPage() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { toast } = useToast()

  // Filters
  const [preset, setPreset] = useState<Preset>('90d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [usingCustom, setUsingCustom] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'mobile_money' | 'credit'>('all')

  // Data
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)

  // Receipt / void
  const [selectedSale, setSelectedSale] = useState<{ sale: Sale; items: SaleItem[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)

  const effectiveFrom = usingCustom
    ? (customFrom ? new Date(customFrom).toISOString() : undefined)
    : presetStart(preset)
  const effectiveTo = usingCustom && customTo
    ? new Date(customTo + 'T23:59:59').toISOString()
    : undefined

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!activeBranch) { setLoading(false); return }
    const offset = reset ? 0 : offsetRef.current
    if (reset) { setLoading(true); setError(null) } else setLoadingMore(true)

    const result = await getSales(createClient(), activeBranch.id, {
      fromDate: effectiveFrom,
      toDate: effectiveTo,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: PAGE_SIZE,
      offset,
    })

    if (reset) setLoading(false); else setLoadingMore(false)

    if (!result.ok) { setError(result.error.message); return }

    const rows = result.data
    setSales(prev => reset ? rows : [...prev, ...rows])
    offsetRef.current = offset + rows.length
    setHasMore(rows.length === PAGE_SIZE)
  }, [activeBranch, effectiveFrom, effectiveTo, statusFilter])

  // Reset and refetch when filters change
  useEffect(() => {
    offsetRef.current = 0
    setSales([])
    void fetchPage(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch, preset, usingCustom, customFrom, customTo, statusFilter])

  // Client-side filter for search and payment (fast, no extra round trip)
  const filtered = sales.filter(s => {
    if (paymentFilter !== 'all' && s.payment_method !== paymentFilter) return false
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      s.sale_number.toLowerCase().includes(q) ||
      (s.customer_name ?? '').toLowerCase().includes(q) ||
      (s.cashier_name ?? '').toLowerCase().includes(q)
    )
  })

  const completedRows = filtered.filter(s => s.status === 'completed')
  const totalRevenue = completedRows.reduce((sum, s) => sum + s.total_amount, 0)
  const currency = sales[0]?.currency_code ?? 'GHS'

  async function openDetail(sale: Sale) {
    setDetailLoading(true)
    setSelectedSale({ sale, items: [] })
    const result = await getSaleById(createClient(), sale.id)
    if (result.ok) setSelectedSale(result.data)
    setDetailLoading(false)
  }

  async function handleVoid() {
    if (!voidTarget || !user) return
    setVoiding(true)
    const result = await voidSaleAction({ saleId: voidTarget.id })
    setVoiding(false)
    setVoidTarget(null)
    if (!result.ok) {
      toast({ title: 'Could not void sale', description: result.error.message, variant: 'destructive' })
      return
    }
    setSales(prev => prev.map(s => s.id === voidTarget.id ? { ...s, status: 'voided' as const } : s))
    if (selectedSale?.sale.id === voidTarget.id) {
      setSelectedSale(prev => prev ? { ...prev, sale: { ...prev.sale, status: 'voided' as const } } : null)
    }
    toast({ title: 'Sale voided', description: `${voidTarget.sale_number} has been reversed and stock restored.` })
  }

  function applyCustomRange() {
    setUsingCustom(true)
    setPreset('all') // clear preset highlight
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete record of all transactions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to view history.</p>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* Preset range buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            {PRESETS.map(p => (
              <Button
                key={p.key}
                variant={!usingCustom && preset === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setPreset(p.key); setUsingCustom(false) }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground w-16">Custom:</span>
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-40 text-sm"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="w-40 text-sm"
              aria-label="To date"
            />
            <Button
              size="sm"
              variant={usingCustom ? 'default' : 'outline'}
              onClick={applyCustomRange}
              disabled={!customFrom && !customTo}
            >
              Apply
            </Button>
            {usingCustom && (
              <Button size="sm" variant="ghost" onClick={() => { setUsingCustom(false); setCustomFrom(''); setCustomTo('') }}>
                Clear
              </Button>
            )}
          </div>

          {/* Search + status + payment */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sale #, customer, cashier…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={v => setPaymentFilter(v as typeof paymentFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Transactions', value: loading ? null : `${filtered.length}${hasMore ? '+' : ''}` },
          { label: 'Revenue', value: loading ? null : formatCurrency(totalRevenue, currency) },
          {
            label: 'Avg. transaction',
            value: loading ? null : completedRows.length > 0
              ? formatCurrency(totalRevenue / completedRows.length, currency)
              : '—',
          },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              {value === null
                ? <Skeleton className="mt-1 h-8 w-24" />
                : <p className="text-2xl font-bold text-primary">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading
              ? 'Loading…'
              : `${filtered.length}${hasMore ? '+' : ''} sale${filtered.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Receipt className="h-10 w-10" />
              <p className="text-sm">No sales found for this period.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Sale #</th>
                      <th className="pb-2 pr-4 font-medium">Date &amp; Time</th>
                      <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Customer</th>
                      <th className="pb-2 pr-4 font-medium hidden md:table-cell">Cashier</th>
                      <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Payment</th>
                      <th className="pb-2 pr-4 font-medium text-right">Total</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(sale => (
                      <tr
                        key={sale.id}
                        className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => void openDetail(sale)}
                      >
                        <td className="py-3 pr-4 font-mono text-xs font-medium">{sale.sale_number}</td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {new Date(sale.created_at).toLocaleString('en-GH', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 pr-4 hidden sm:table-cell">{sale.customer_name ?? '—'}</td>
                        <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground">
                          {sale.cashier_name ?? '—'}
                        </td>
                        <td className="py-3 pr-4 hidden sm:table-cell text-muted-foreground">
                          {paymentLabel(sale.payment_method)}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums font-medium">
                          {formatCurrency(sale.total_amount, sale.currency_code)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant(sale.status)} className="capitalize text-xs">
                            {sale.status}
                          </Badge>
                        </td>
                        <td className="py-3" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void openDetail(sale)}
                            aria-label="View receipt"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="pt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => void fetchPage(false)}
                    disabled={loadingMore}
                  >
                    {loadingMore
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</>
                      : <><ChevronDown className="mr-2 h-4 w-4" />Load more</>}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Receipt sheet */}
      <Sheet open={!!selectedSale} onOpenChange={open => { if (!open) setSelectedSale(null) }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedSale && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>Receipt — {selectedSale.sale.sale_number}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-y-2 text-muted-foreground">
                  <span>Date</span>
                  <span className="text-foreground text-right">
                    {new Date(selectedSale.sale.created_at).toLocaleString('en-GH')}
                  </span>
                  <span>Status</span>
                  <span className="text-right">
                    <Badge variant={statusVariant(selectedSale.sale.status)} className="capitalize text-xs">
                      {selectedSale.sale.status}
                    </Badge>
                  </span>
                  <span>Payment</span>
                  <span className="text-foreground text-right">
                    {paymentLabel(selectedSale.sale.payment_method)}
                  </span>
                  {selectedSale.sale.customer_name && (
                    <>
                      <span>Customer</span>
                      <span className="text-foreground text-right">{selectedSale.sale.customer_name}</span>
                    </>
                  )}
                  {selectedSale.sale.prescription_number && (
                    <>
                      <span>Rx #</span>
                      <span className="text-foreground text-right font-mono">
                        {selectedSale.sale.prescription_number}
                      </span>
                    </>
                  )}
                  <span>Served by</span>
                  <span className="text-foreground text-right font-medium">
                    {detailLoading ? '…' : (selectedSale.sale.cashier_name ?? '—')}
                  </span>
                </div>

                <hr />

                {detailLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : selectedSale.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSale.items.map(item => (
                      <div key={item.id} className="flex justify-between gap-2">
                        <span className="text-muted-foreground flex-shrink-0">{item.quantity}×</span>
                        <span className="flex-1 min-w-0">
                          {item.medication_name ?? 'Medication'}
                          {item.discount_percent > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (−{item.discount_percent}%)
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums flex-shrink-0">
                          {formatCurrency(item.line_total, item.currency_code)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <hr />

                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedSale.sale.subtotal, selectedSale.sale.currency_code)}</span>
                  </div>
                  {selectedSale.sale.discount_amount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount</span>
                      <span>−{formatCurrency(selectedSale.sale.discount_amount, selectedSale.sale.currency_code)}</span>
                    </div>
                  )}
                  {selectedSale.sale.tax_amount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax</span>
                      <span>{formatCurrency(selectedSale.sale.tax_amount, selectedSale.sale.currency_code)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t mt-2">
                    <span>Total</span>
                    <span>{formatCurrency(selectedSale.sale.total_amount, selectedSale.sale.currency_code)}</span>
                  </div>
                  {selectedSale.sale.amount_tendered != null && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tendered</span>
                        <span>
                          {formatCurrency(selectedSale.sale.amount_tendered, selectedSale.sale.currency_code)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Change</span>
                        <span>
                          {formatCurrency(selectedSale.sale.change_given ?? 0, selectedSale.sale.currency_code)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {selectedSale.sale.status === 'completed' && (
                  <div className="pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => setVoidTarget(selectedSale.sale)}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Void Sale
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Void confirmation */}
      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open && !voiding) setVoidTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Void this sale?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{voidTarget?.sale_number}</span> will be marked as
            voided and all items will be returned to stock. This cannot be undone.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleVoid()} disabled={voiding}>
              {voiding ? 'Voiding…' : 'Void Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
