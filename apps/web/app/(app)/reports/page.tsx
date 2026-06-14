'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, RefreshCw, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { getSales } from '@medlink/data-client'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Sale } from '@medlink/data-client'

interface DayBucket {
  day: string    // e.g. "Mon 09"
  isoDate: string
  revenue: number
  count: number
}

function buildLast7Days(): DayBucket[] {
  const buckets: DayBucket[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    buckets.push({
      day: d.toLocaleDateString('en-GH', { weekday: 'short', day: '2-digit' }),
      isoDate: d.toISOString().split('T')[0] ?? '',
      revenue: 0,
      count: 0,
    })
  }
  return buckets
}

function bucketSales(sales: Sale[], buckets: DayBucket[]): DayBucket[] {
  const copy = buckets.map(b => ({ ...b }))
  for (const sale of sales) {
    if (sale.status !== 'completed') continue
    const saleDate = sale.created_at.split('T')[0]
    const bucket = copy.find(b => b.isoDate === saleDate)
    if (bucket) {
      bucket.revenue += sale.total_amount
      bucket.count += 1
    }
  }
  return copy
}

export default function ReportsPage() {
  const { activeBranch } = useBranch()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true); setError(null)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const result = await getSales(createClient(), activeBranch.id, {
      fromDate: sevenDaysAgo.toISOString(),
      limit: 1000,
    })
    if (result.ok) setSales(result.data)
    else setError(result.error.message)
    setLoading(false)
  }, [activeBranch])

  useEffect(() => { void load() }, [load])

  const buckets = bucketSales(sales, buildLast7Days())
  const completed = sales.filter(s => s.status === 'completed')
  const totalRevenue = completed.reduce((sum, s) => sum + s.total_amount, 0)
  const avgTransaction = completed.length > 0 ? totalRevenue / completed.length : 0
  const currency = sales[0]?.currency_code ?? 'GHS'

  // Payment method breakdown
  const byPayment = completed.reduce<Record<string, number>>((acc, s) => {
    acc[s.payment_method] = (acc[s.payment_method] ?? 0) + s.total_amount
    return acc
  }, {})
  const topPayment = Object.entries(byPayment).sort((a, b) => b[1] - a[1])[0]

  function exportCSV() {
    const header = 'Sale Number,Date,Customer,Payment,Total,Status'
    const rows = sales.map(s =>
      [s.sale_number, s.created_at, s.customer_name ?? '', s.payment_method, s.total_amount, s.status].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-${activeBranch?.name ?? 'export'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const paymentLabels: Record<string, string> = {
    cash: 'Cash', card: 'Card', mobile_money: 'Mobile Money', credit: 'Credit',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
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

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to view reports.</p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '7-day revenue', value: loading ? null : formatCurrency(totalRevenue, currency) },
          { label: 'Transactions', value: loading ? null : String(completed.length) },
          { label: 'Avg. transaction', value: loading ? null : formatCurrency(avgTransaction, currency) },
          { label: 'Top payment', value: loading ? null : (topPayment ? paymentLabels[topPayment[0]] ?? topPayment[0] : '—') },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {value === null
                ? <Skeleton className="h-9 w-24" />
                : <p className="text-3xl font-bold text-primary">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 7-day bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily revenue — last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={buckets} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={v => formatCurrency(v as number, currency).replace(/\.00$/, '')}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Transaction count chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily transactions — last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={buckets} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} width={40} />
                <Tooltip formatter={(value: number) => [value, 'Transactions']} labelStyle={{ fontWeight: 600 }} />
                <Bar dataKey="count" fill="hsl(var(--primary) / 0.6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Payment method breakdown */}
      {!loading && Object.keys(byPayment).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment method breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byPayment)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => {
                  const pct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{paymentLabels[method] ?? method}</span>
                        <span className="tabular-nums font-medium">{formatCurrency(amount, currency)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
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
