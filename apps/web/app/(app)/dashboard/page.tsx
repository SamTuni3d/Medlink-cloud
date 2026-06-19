'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp, ShoppingCart, RefreshCw, ChevronRight, Package,
  AlertCircle, Zap,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StaggerGrid, StaggerItem, HoverCard, FadeIn } from '@/components/ui/motion-primitives'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { formatCurrency } from '@/lib/formatCurrency'
import { createClient } from '@/lib/supabase/client'
import { getSales } from '@medlink/data-client'
import type { Sale, InventoryWithBatches } from '@medlink/data-client'

interface ChartDay { date: string; amount: number }

function getLast7Days(): ChartDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { date: d.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' }), amount: 0 }
  })
}

// ─── Insights ────────────────────────────────────────────────────────────────

interface Insight { title: string; body: string; severity: 'critical' | 'info' | 'warning' }

function deriveInsights(rows: InventoryWithBatches[]): Insight[] {
  const insights: Insight[] = []
  const critical = rows
    .filter(r => r.available_stock < r.reorder_point && r.reorder_point > 0)
    .sort((a, b) => (a.available_stock / a.reorder_point) - (b.available_stock / b.reorder_point))
    .slice(0, 1)
  for (const item of critical) {
    insights.push({ title: 'Reorder Required', severity: 'critical',
      body: `${item.medication_name} is running low. Stock: ${item.available_stock} units (reorder at ${item.reorder_point}).` })
  }
  const outOfStock = rows.filter(r => r.available_stock === 0).length
  if (outOfStock > 0) {
    insights.push({ title: 'Out-of-Stock Alert', severity: 'critical',
      body: `${outOfStock} medication${outOfStock > 1 ? 's are' : ' is'} completely out of stock.` })
  }
  const slowMovers = rows
    .filter(r => r.reorder_point > 0 && r.available_stock > r.reorder_point * 5)
    .slice(0, 1)
  for (const item of slowMovers) {
    insights.push({ title: 'Slow-Moving Stock', severity: 'info',
      body: `${item.medication_name} has ${item.available_stock} units — well above reorder level.` })
  }
  if (outOfStock > 0) {
    insights.push({ title: 'Optimisation Tip', severity: 'info',
      body: `Set up automatic reorder triggers to prevent ${outOfStock} out-of-stock situations.` })
  }
  return insights.slice(0, 4)
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, urgent, loading }: {
  label: string; value: string | null; sub?: string
  icon: typeof TrendingUp; urgent?: boolean; loading?: boolean
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 transition-all ${
      urgent ? 'border-red-200 bg-red-50/40' : 'border-border'
    }`}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${urgent ? 'text-red-400' : 'text-muted-foreground/40'}`} />
      </div>
      {loading || value === null ? (
        <>
          <Skeleton className="mt-3 h-8 w-32" />
          {sub && <Skeleton className="mt-2 h-3 w-40" />}
        </>
      ) : (
        <>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${
            urgent ? 'text-red-600' : 'text-foreground'
          }`}>{value}</p>
          {sub && <p className={`mt-1 text-xs ${urgent ? 'text-red-500' : 'text-muted-foreground'}`}>{sub}</p>}
        </>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeBranch } = useBranch()
  const { organizationId } = useAuth()
  const { stats, loading, error, refresh } = useDashboardStats(activeBranch?.id ?? null, organizationId)
  const [chartData, setChartData]   = useState<ChartDay[]>(getLast7Days())
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(true)

  const loadRecentSales = useCallback(async () => {
    if (!activeBranch) { setSalesLoading(false); return }
    setSalesLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const result = await getSales(createClient(), activeBranch.id, {
      fromDate: sevenDaysAgo.toISOString(), limit: 50,
    })
    if (result.ok) {
      setRecentSales(result.data.slice(0, 5))
      const days = getLast7Days()
      for (const sale of result.data) {
        if (sale.status !== 'completed') continue
        const label = new Date(sale.created_at).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })
        const bucket = days.find(d => d.date === label)
        if (bucket) bucket.amount += Number(sale.total_amount)
      }
      setChartData([...days])
    }
    setSalesLoading(false)
  }, [activeBranch])

  useEffect(() => { void loadRecentSales() }, [loadRecentSales])

  const currency = stats?.currencyCode ?? 'GHS'
  const actionNeeded = (stats?.lowStockCount ?? 0) + (stats?.expiringSoonCount ?? 0)
  const insights = stats ? deriveInsights(stats.inventoryRows) : []

  return (
    <div className="mx-auto max-w-7xl space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back. Here is your pharmacy&apos;s command center.</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => { void refresh(); void loadRecentSales() }}
          disabled={loading} className="self-start sm:self-auto"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!activeBranch && !loading && (
        <div className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'hsl(33 80% 80%)', background: 'hsl(175 35% 95%)', color: '#004741' }}>
          Select a branch from the top bar to see live data.
        </div>
      )}

      {/* KPI cards */}
      <StaggerGrid className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        {[
          { label: 'Sales Today',        icon: TrendingUp,  value: loading ? null : formatCurrency(stats?.salesTodayAmount ?? 0, currency) },
          { label: 'Gross Profit (Month)', icon: TrendingUp, value: loading ? null : formatCurrency(stats?.grossProfitMonth ?? 0, currency) },
          { label: 'Inventory Value',    icon: Package,     value: loading ? null : formatCurrency(stats?.inventoryValue ?? 0, currency) },
          { label: 'Action Needed',      icon: AlertCircle, value: loading ? null : String(actionNeeded),
            sub: loading ? undefined : `${stats?.lowStockCount ?? 0} Low Stock • ${stats?.expiringSoonCount ?? 0} Expiring`,
            urgent: actionNeeded > 0 },
        ].map((card) => (
          <StaggerItem key={card.label}>
            <HoverCard className="h-full">
              <KpiCard loading={loading} {...card} />
            </HoverCard>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* Chart + Insights */}
      <FadeIn className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        <Card className="border-border shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales Trend (7 Days)</CardTitle>
            <CardDescription className="text-xs">Revenue over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(175 18% 87%)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(175 20% 48%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(175 20% 48%)' }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v === 0 ? '¢0' : `¢${(v / 100).toFixed(0)}`} width={40} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(175 18% 87%)', fontSize: '12px',
                      boxShadow: '0 4px 12px -4px rgba(0,71,65,0.15)' }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#004741" strokeWidth={2.5}
                    dot={{ fill: '#004741', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#C4A44C', stroke: '#004741', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: '#C4A44C' }} />
              <CardTitle className="text-base font-semibold">AI Insights</CardTitle>
            </div>
            <CardDescription className="text-xs">Smart recommendations</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-4">
            {loading ? (
              <div className="space-y-3 px-6">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : insights.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center px-6">
                <Zap className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">No insights — all good!</p>
              </div>
            ) : (
              <div className="space-y-2 px-4">
                {insights.map((insight, i) => (
                  <div key={i} className="rounded-lg border border-border p-3"
                    style={{ background: 'hsl(175 35% 96%)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md"
                        style={{ background: 'hsl(175 35% 88%)' }}>
                        <Zap className="h-3 w-3" style={{ color: '#004741' }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground flex-1">{insight.title}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        insight.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : insight.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-600'
                      }`}>{insight.severity}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug pl-7">{insight.body}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Recent Sales */}
      <FadeIn>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Sales</CardTitle>
                <CardDescription className="text-xs">Last 5 transactions</CardDescription>
              </div>
              <Link href="/sales">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" style={{ color: '#004741' }}>
                  View all <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {salesLoading ? (
              <div className="space-y-3 px-6 pb-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : recentSales.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShoppingCart className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No sales yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Sale #</th>
                      <th className="hidden px-5 py-2.5 text-left text-xs font-medium text-muted-foreground sm:table-cell">Time</th>
                      <th className="hidden px-5 py-2.5 text-left text-xs font-medium text-muted-foreground md:table-cell">Payment</th>
                      <th className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
                      <th className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recentSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-accent/40 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs font-medium text-foreground">{sale.sale_number}</td>
                        <td className="hidden px-5 py-3 text-xs text-muted-foreground sm:table-cell">
                          {new Date(sale.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="hidden px-5 py-3 text-xs capitalize text-muted-foreground md:table-cell">
                          {sale.payment_method.replace('_', ' ')}
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold text-foreground">
                          {formatCurrency(Number(sale.total_amount), sale.currency_code)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            sale.status === 'completed'
                              ? 'text-[#004741]'
                              : sale.status === 'voided'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-muted text-muted-foreground'
                          }`} style={sale.status === 'completed' ? { background: 'hsl(175 35% 91%)' } : {}}>
                            {sale.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

    </div>
  )
}
