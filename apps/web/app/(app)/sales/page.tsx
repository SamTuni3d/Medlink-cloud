'use client'

import { useState, useEffect, useCallback } from 'react'
import { Receipt, Search, RefreshCw, Eye, Ban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { voidSaleAction } from './actions'

type DateRange = 'today' | 'week' | 'month'

function dateRangeStart(range: DateRange): string {
  const d = new Date()
  if (range === 'today') d.setHours(0, 0, 0, 0)
  else if (range === 'week') { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0) }
  else { d.setDate(1); d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

function statusVariant(status: Sale['status']): 'default' | 'destructive' | 'secondary' {
  if (status === 'completed') return 'default'
  if (status === 'voided') return 'destructive'
  return 'secondary'
}

function paymentLabel(method: Sale['payment_method']) {
  const map: Record<string, string> = {
    cash: 'Cash', card: 'Card',
    mobile_money: 'Mobile Money', credit: 'Credit',
  }
  return map[method] ?? method
}

export default function SalesPage() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { toast } = useToast()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>('today')
  const [search, setSearch] = useState('')
  const [selectedSale, setSelectedSale] = useState<{ sale: Sale; items: SaleItem[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true); setError(null)
    const result = await getSales(createClient(), activeBranch.id, {
      fromDate: dateRangeStart(range),
      limit: 200,
    })
    if (result.ok) setSales(result.data)
    else setError(result.error.message)
    setLoading(false)
  }, [activeBranch, range])

  useEffect(() => { void load() }, [load])

  const filtered = sales.filter(s =>
    search === '' ||
    s.sale_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const completed = filtered.filter(s => s.status === 'completed')
  const totalRevenue = completed.reduce((sum, s) => sum + s.total_amount, 0)
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
    const result = await voidSaleAction({ saleId: voidTarget.id, voidedBy: user.id })
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

  const RANGES: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'month', label: 'This month' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Sales</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to view sales.</p>
      )}

      <div className="flex gap-2">
        {RANGES.map(r => (
          <Button key={r.key} variant={range === r.key ? 'default' : 'outline'} size="sm"
            onClick={() => setRange(r.key)}>
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Completed', value: loading ? null : String(completed.length) },
          { label: 'Revenue', value: loading ? null : formatCurrency(totalRevenue, currency) },
          {
            label: 'Avg. transaction',
            value: loading ? null : completed.length > 0
              ? formatCurrency(totalRevenue / completed.length, currency) : '—',
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base">
              {loading ? 'Loading…' : `${filtered.length} sale${filtered.length !== 1 ? 's' : ''}`}
            </CardTitle>
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search sale # or customer…" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Receipt className="h-10 w-10" />
              <p className="text-sm">No sales found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Sale #</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Customer</th>
                    <th className="pb-2 pr-4 font-medium">Payment</th>
                    <th className="pb-2 pr-4 font-medium text-right">Total</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sale => (
                    <tr key={sale.id}
                      className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs font-medium">{sale.sale_number}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('en-GH', {
                          day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 pr-4">{sale.customer_name ?? '—'}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{paymentLabel(sale.payment_method)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-medium">
                        {formatCurrency(sale.total_amount, sale.currency_code)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(sale.status)} className="capitalize text-xs">
                          {sale.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => void openDetail(sale)}
                          aria-label="View receipt">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <span className="text-foreground text-right">{paymentLabel(selectedSale.sale.payment_method)}</span>
                  {selectedSale.sale.customer_name && (
                    <><span>Customer</span>
                      <span className="text-foreground text-right">{selectedSale.sale.customer_name}</span></>
                  )}
                  {selectedSale.sale.prescription_number && (
                    <><span>Rx #</span>
                      <span className="text-foreground text-right font-mono">{selectedSale.sale.prescription_number}</span></>
                  )}
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
                        <span>{formatCurrency(selectedSale.sale.amount_tendered, selectedSale.sale.currency_code)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Change</span>
                        <span>{formatCurrency(selectedSale.sale.change_given ?? 0, selectedSale.sale.currency_code)}</span>
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

      {/* Void confirmation dialog */}
      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open && !voiding) setVoidTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Void this sale?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{voidTarget?.sale_number}</span> will be marked as voided
            and all items will be returned to stock. This cannot be undone.
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
