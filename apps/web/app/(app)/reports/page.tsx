'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, RefreshCw, Download, Users, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { getSales, getSalesByCashier, getTopProducts } from '@medlink/data-client'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Sale, CashierSummary, TopProduct } from '@medlink/data-client'

// ── Period helpers ────────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | 'week' | 'month'

function periodRange(p: Period): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)

  if (p === 'today') {
    return { from: today, to: now }
  }
  if (p === 'yesterday') {
    const yStart = new Date(today); yStart.setDate(yStart.getDate() - 1)
    const yEnd   = new Date(today); yEnd.setMilliseconds(-1)
    return { from: yStart, to: yEnd }
  }
  if (p === 'week') {
    const from = new Date(today); from.setDate(from.getDate() - 6)
    return { from, to: now }
  }
  // month
  const from = new Date(today); from.setDate(1)
  return { from, to: now }
}

// ── Chart bucketing ───────────────────────────────────────────────────────────

interface Bucket { label: string; revenue: number; count: number }

function buildHourlyBuckets(): Bucket[] {
  return Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    revenue: 0,
    count: 0,
  }))
}

function buildDailyBuckets(from: Date, to: Date): Bucket[] {
  const buckets: Bucket[] = []
  const cur = new Date(from)
  while (cur <= to) {
    buckets.push({
      label: cur.toLocaleDateString('en-GH', { weekday: 'short', day: '2-digit' }),
      revenue: 0,
      count: 0,
    })
    cur.setDate(cur.getDate() + 1)
  }
  return buckets
}

function bucketSales(sales: Sale[], period: Period, from: Date): Bucket[] {
  const isHourly = period === 'today' || period === 'yesterday'
  const buckets = isHourly ? buildHourlyBuckets() : buildDailyBuckets(from, new Date())

  for (const sale of sales) {
    if (sale.status !== 'completed') continue
    const d = new Date(sale.created_at)

    if (isHourly) {
      const h = d.getHours()
      const b = buckets[h]
      if (b) { b.revenue += sale.total_amount; b.count += 1 }
    } else {
      const dateStr = d.toLocaleDateString('en-GH', { weekday: 'short', day: '2-digit' })
      const b = buckets.find(bk => bk.label === dateStr)
      if (b) { b.revenue += sale.total_amount; b.count += 1 }
    }
  }
  return buckets
}

// ── Payment method helpers ────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', mobile_money: 'Mobile Money', credit: 'Credit',
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',      label: 'This Week' },
  { key: 'month',     label: 'This Month' },
]

export default function ReportsPage() {
  const { activeBranch } = useBranch()
  const [period, setPeriod]             = useState<Period>('today')
  const [sales, setSales]               = useState<Sale[]>([])
  const [cashiers, setCashiers]         = useState<CashierSummary[]>([])
  const [topProducts, setTopProducts]   = useState<TopProduct[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true); setError(null)

    const { from, to } = periodRange(period)
    const fromISO = from.toISOString()
    const toISO   = to.toISOString()
    const client  = createClient()

    const [salesRes, cashiersRes, topRes] = await Promise.all([
      getSales(client, activeBranch.id, { fromDate: fromISO, toDate: toISO, limit: 500 }),
      getSalesByCashier(client, activeBranch.id, fromISO, toISO),
      getTopProducts(client, activeBranch.id, fromISO, toISO, 10),
    ])

    if (salesRes.ok)    setSales(salesRes.data)
    else setError(salesRes.error.message)
    if (cashiersRes.ok) setCashiers(cashiersRes.data)
    if (topRes.ok)      setTopProducts(topRes.data)

    setLoading(false)
  }, [activeBranch, period])

  useEffect(() => { void load() }, [load])

  const completed    = sales.filter(s => s.status === 'completed')
  const totalRevenue = completed.reduce((sum, s) => sum + s.total_amount, 0)
  const avgTxn       = completed.length > 0 ? totalRevenue / completed.length : 0
  const currency     = sales[0]?.currency_code ?? 'GHS'

  const byPayment = completed.reduce<Record<string, number>>((acc, s) => {
    acc[s.payment_method] = (acc[s.payment_method] ?? 0) + s.total_amount
    return acc
  }, {})
  const topPaymentEntry = Object.entries(byPayment).sort((a, b) => b[1] - a[1])[0]

  const { from } = periodRange(period)
  const buckets  = bucketSales(sales, period, from)
  const isHourly = period === 'today' || period === 'yesterday'

  function exportCSV() {
    const header = 'Sale #,Date,Payment,Total,Status'
    const rows   = sales.map(s =>
      [s.sale_number, s.created_at, s.payment_method, s.total_amount, s.status].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `sales-${activeBranch?.name ?? 'export'}-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Daily sales summary &amp; performance</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || sales.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to view reports.</p>
      )}

      {/* Period tabs */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(p => (
          <Button
            key={p.key}
            variant={period === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Revenue',          value: loading ? null : formatCurrency(totalRevenue, currency) },
          { label: 'Transactions',     value: loading ? null : String(completed.length) },
          { label: 'Avg. transaction', value: loading ? null : formatCurrency(avgTxn, currency) },
          { label: 'Top payment',      value: loading ? null : (topPaymentEntry ? PAYMENT_LABELS[topPaymentEntry[0]] ?? topPaymentEntry[0] : '—') },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {value === null
                ? <Skeleton className="h-9 w-24" />
                : <p className="text-2xl font-bold text-primary tabular-nums">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Revenue — {isHourly ? 'by hour' : 'by day'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={buckets} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  interval={isHourly ? 2 : 0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={v => formatCurrency(v as number, currency).replace(/\.00$/, '')}
                  width={75}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v, currency), 'Revenue']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cashier + Top Products side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Cashier performance */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Cashier Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : cashiers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Cashier</th>
                      <th className="pb-2 text-center font-medium">Txns</th>
                      <th className="pb-2 text-right font-medium">Revenue</th>
                      <th className="pb-2 text-right font-medium hidden sm:table-cell">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashiers.map((c, i) => (
                      <tr key={c.cashier_id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
                            <span className="font-medium truncate max-w-[120px]">{c.cashier_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center tabular-nums text-muted-foreground">{c.transaction_count}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold">
                          {formatCurrency(c.total_revenue, currency)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                          {formatCurrency(c.avg_transaction, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td className="pt-2.5 font-semibold text-xs text-muted-foreground">Total</td>
                      <td className="pt-2.5 text-center tabular-nums text-xs text-muted-foreground">
                        {cashiers.reduce((s, c) => s + c.transaction_count, 0)}
                      </td>
                      <td className="pt-2.5 text-right tabular-nums font-bold text-primary">
                        {formatCurrency(totalRevenue, currency)}
                      </td>
                      <td className="hidden sm:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => {
                  const pct = totalRevenue > 0 ? (p.total_revenue / totalRevenue) * 100 : 0
                  return (
                    <div key={p.medication_id}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                          <span className="text-sm truncate">{p.medication_name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">{p.quantity_sold} units</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrency(p.total_revenue, currency)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Payment method breakdown */}
      {!loading && Object.keys(byPayment).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(byPayment).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
                const pct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
                const txns = completed.filter(s => s.payment_method === method).length
                return (
                  <div key={method} className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{PAYMENT_LABELS[method] ?? method}</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(amount, currency)}</p>
                    <p className="text-xs text-muted-foreground">{txns} transactions · {pct.toFixed(0)}%</p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
