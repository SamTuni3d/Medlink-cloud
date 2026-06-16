'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp, ShoppingCart, AlertTriangle, Clock,
  RefreshCw, Bell, CheckCheck, ArrowUpRight, ArrowDownRight,
  Tablet, Package, BarChart2, ChevronRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { formatCurrency } from '@/lib/formatCurrency'
import { createClient } from '@/lib/supabase/client'
import { getNotifications, markAllNotificationsRead, getSales } from '@medlink/data-client'
import type { Notification, Sale } from '@medlink/data-client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChartDay {
  day: string
  amount: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLast7Days(): ChartDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      day: d.toLocaleDateString('en-GH', { weekday: 'short' }),
      amount: 0,
    }
  })
}

function StatCard({
  label, icon: Icon, value, sub, trend, urgent, loading, color,
}: {
  label: string
  icon: typeof TrendingUp
  value: string | null
  sub: string | null
  trend?: number
  urgent?: boolean
  loading?: boolean
  color: string
}) {
  return (
    <Card className={`relative overflow-hidden border-0 shadow-sm transition-shadow hover:shadow-md ${
      urgent ? 'ring-1 ring-destructive/40' : ''
    }`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${
              trend >= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {trend >= 0
                ? <ArrowUpRight className="h-3.5 w-3.5" />
                : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="mt-4">
          {loading || value === null ? (
            <>
              <Skeleton className="h-8 w-28" />
              <Skeleton className="mt-2 h-3.5 w-36" />
            </>
          ) : (
            <>
              <p className={`text-2xl font-bold tracking-tight ${
                urgent ? 'text-destructive' : 'text-slate-900 dark:text-slate-100'
              }`}>
                {value}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
            </>
          )}
        </div>
        <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      </CardContent>
    </Card>
  )
}

function QuickActions() {
  const actions = [
    { label: 'New Sale', href: '/pos', icon: Tablet, color: 'bg-primary' },
    { label: 'Inventory', href: '/inventory', icon: Package, color: 'bg-blue-600' },
    { label: 'Reports', href: '/reports', icon: BarChart2, color: 'bg-violet-600' },
    { label: 'Sales Log', href: '/sales', icon: ShoppingCart, color: 'bg-amber-500' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ label, href, icon: Icon, color }) => (
        <Link key={href} href={href}>
          <div className="flex flex-col items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color} shadow-sm`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeBranch } = useBranch()
  const { organizationId } = useAuth()
  const { stats, loading, error, refresh } = useDashboardStats(
    activeBranch?.id ?? null,
    organizationId
  )

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(true)
  const [markingRead, setMarkingRead] = useState(false)
  const [chartData, setChartData] = useState<ChartDay[]>(getLast7Days())
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!organizationId) { setNotifLoading(false); return }
    setNotifLoading(true)
    const result = await getNotifications(createClient(), organizationId, {
      branchId: activeBranch?.id,
      unreadOnly: false,
      limit: 10,
    })
    if (result.ok) setNotifications(result.data)
    setNotifLoading(false)
  }, [organizationId, activeBranch?.id])

  const loadRecentSales = useCallback(async () => {
    if (!organizationId) { setSalesLoading(false); return }
    setSalesLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const result = await getSales(createClient(), activeBranch?.id ?? '', {
      fromDate: sevenDaysAgo.toISOString(),
      limit: 50,
    })
    if (result.ok) {
      setRecentSales(result.data.slice(0, 5))
      // Build 7-day chart data
      const days = getLast7Days()
      for (const sale of result.data) {
        const saleDay = new Date(sale.created_at).toLocaleDateString('en-GH', { weekday: 'short' })
        const idx = days.findIndex(d => d.day === saleDay)
        const day = days[idx]
        if (idx !== -1 && day) day.amount += Number(sale.total_amount)
      }
      setChartData([...days])
    }
    setSalesLoading(false)
  }, [organizationId, activeBranch?.id])

  useEffect(() => {
    void loadNotifications()
    void loadRecentSales()
  }, [loadNotifications, loadRecentSales])

  async function markAllRead() {
    if (!organizationId) return
    setMarkingRead(true)
    await markAllNotificationsRead(createClient(), organizationId, activeBranch?.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setMarkingRead(false)
    void refresh()
  }

  const currencyCode = stats?.currencyCode ?? 'GHS'
  const unreadCount = notifications.filter(n => !n.is_read).length

  const statCards = [
    {
      label: "Today's Revenue",
      icon: TrendingUp,
      value: loading ? null : formatCurrency(stats?.salesTodayAmount ?? 0, currencyCode),
      sub: `${stats?.transactionCount ?? 0} transactions completed`,
      color: 'bg-primary',
    },
    {
      label: 'Transactions Today',
      icon: ShoppingCart,
      value: loading ? null : String(stats?.transactionCount ?? 0),
      sub: 'sales processed today',
      color: 'bg-blue-600',
    },
    {
      label: 'Low Stock Items',
      icon: AlertTriangle,
      value: loading ? null : String(stats?.lowStockCount ?? 0),
      sub: 'at or below reorder point',
      urgent: (stats?.lowStockCount ?? 0) > 0,
      color: (stats?.lowStockCount ?? 0) > 0 ? 'bg-red-500' : 'bg-slate-400',
    },
    {
      label: 'Expiry Alerts',
      icon: Clock,
      value: loading ? null : String(stats?.expiringSoonCount ?? 0),
      sub: 'unread expiry warnings',
      urgent: (stats?.expiringSoonCount ?? 0) > 0,
      color: (stats?.expiringSoonCount ?? 0) > 0 ? 'bg-amber-500' : 'bg-slate-400',
    },
  ]

  function severityBadge(severity: Notification['severity']) {
    if (severity === 'critical') return 'destructive' as const
    if (severity === 'warning') return 'secondary' as const
    return 'outline' as const
  }

  const today = new Date().toLocaleDateString('en-GH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{today}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { void refresh(); void loadNotifications(); void loadRecentSales() }}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!activeBranch && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Select a branch from the top bar to see live data.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} loading={loading} {...card} />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Actions</h2>
        <QuickActions />
      </div>

      {/* Chart + Notifications row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* 7-day revenue chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">7-Day Revenue</CardTitle>
            <CardDescription className="text-xs">
              {activeBranch ? activeBranch.name : 'All branches'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v === 0 ? '0' : `${(v/1000).toFixed(0)}k`}
                    width={35}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value, currencyCode), 'Revenue']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="amount" fill="#0F7938" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-500" />
                <CardTitle className="text-sm font-semibold">Alerts</CardTitle>
                {unreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void markAllRead()}
                  disabled={markingRead}
                  className="h-7 px-2 text-xs"
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  All read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {notifLoading ? (
              <div className="space-y-2 px-6 pb-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Bell className="h-6 w-6 text-slate-300" />
                <p className="text-xs text-slate-500">No alerts right now</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.slice(0, 6).map(n => (
                  <div key={n.id} className={`flex gap-3 px-5 py-3 ${
                    n.is_read ? 'opacity-50' : ''
                  }`}>
                    <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      n.severity === 'critical' ? 'bg-red-500' :
                      n.severity === 'warning' ? 'bg-amber-500' : 'bg-slate-300'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                          {n.title}
                        </p>
                        <Badge variant={severityBadge(n.severity)} className="shrink-0 text-[10px] px-1 py-0">
                          {n.severity}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{n.body}</p>
                    </div>
                  </div>
                ))}
                {notifications.length > 6 && (
                  <div className="px-5 py-2.5 text-center">
                    <p className="text-xs text-slate-400">{notifications.length - 6} more alerts</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Sales</CardTitle>
              <CardDescription className="text-xs">Last 5 transactions</CardDescription>
            </div>
            <Link href="/sales">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary">
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {salesLoading ? (
            <div className="space-y-3 px-6 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : recentSales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ShoppingCart className="h-6 w-6 text-slate-300" />
              <p className="text-xs text-slate-500">No sales yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-slate-500">Sale #</th>
                    <th className="whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-slate-500 hidden sm:table-cell">Time</th>
                    <th className="whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-slate-500 hidden md:table-cell">Payment</th>
                    <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-medium text-slate-500">Total</th>
                    <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {recentSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                        {sale.sale_number}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 hidden sm:table-cell">
                        {new Date(sale.created_at).toLocaleTimeString('en-GH', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 capitalize hidden md:table-cell">
                        {sale.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(Number(sale.total_amount), sale.currency_code)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          sale.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : sale.status === 'voided'
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
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

    </div>
  )
}
