'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { RefreshCw, ChevronRight, ShoppingCart } from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { formatCurrency } from '@/lib/formatCurrency'
import { createClient } from '@/lib/supabase/client'
import { getSales } from '@medlink/data-client'
import type { Sale } from '@medlink/data-client'

// ── helpers ───────────────────────────────────────────────────────────────────

interface ChartDay { date: string; amount: number }

function getLast7Days(): ChartDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { date: d.toLocaleDateString('en-GH', { weekday: 'short' }), amount: 0 }
  })
}

function expiryStyle(days: number): string {
  if (days <= 21) return 'bg-red-50 text-red-700'
  if (days <= 60) return 'bg-amber-50 text-amber-700'
  return 'bg-blue-50 text-blue-700'
}

function payStyle(method: string): { label: string; className: string } {
  if (method.includes('mobile') || method.includes('momo') || method.includes('money')) {
    return { label: 'MoMo', className: 'bg-blue-50 text-blue-700' }
  }
  if (method.includes('card')) {
    return { label: 'Card', className: 'bg-amber-50 text-amber-700' }
  }
  return { label: 'Cash', className: 'bg-green-50 text-green-700' }
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, numColor, loading }: {
  label: string
  value: string
  sub?: string
  numColor?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white shadow-sm p-3 sm:p-4 lg:p-5">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 sm:mb-2">{label}</p>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-3 w-20" />
        </>
      ) : (
        <>
          <p
            className="text-[18px] sm:text-xl md:text-2xl lg:text-xl xl:text-2xl font-extrabold leading-tight mb-1 sm:mb-2 break-all"
            style={{ fontVariantNumeric: 'tabular-nums', color: numColor ?? '#111827' }}
          >
            {value}
          </p>
          {sub && <p className="text-[11px] sm:text-xs text-gray-400">{sub}</p>}
        </>
      )}
    </div>
  )
}

// ── section card wrapper ──────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-black/[0.08] bg-white shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

function CardHead({ title, sub, tag, tagClass }: {
  title: string; sub?: string; tag?: string; tagClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-black/[0.08]">
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-gray-900 truncate">{title}</p>
        {sub && <p className="text-[11.5px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
      {tag && (
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tagClass ?? 'bg-green-50 text-green-700'}`}>
          {tag}
        </span>
      )}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeBranch } = useBranch()
  const { organizationId } = useAuth()
  const { stats, loading, error, refresh } = useDashboardStats(activeBranch?.id ?? null, organizationId)
  const [chartData, setChartData] = useState<ChartDay[]>(getLast7Days())
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(true)

  const loadSales = useCallback(async () => {
    if (!activeBranch) { setSalesLoading(false); return }
    setSalesLoading(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const result = await getSales(createClient(), activeBranch.id, {
      fromDate: sevenDaysAgo.toISOString(), limit: 50,
    })
    if (result.ok) {
      setRecentSales(result.data.slice(0, 6))
      const days = getLast7Days()
      for (const sale of result.data) {
        if (sale.status !== 'completed') continue
        const label = new Date(sale.created_at).toLocaleDateString('en-GH', { weekday: 'short' })
        const bucket = days.find(d => d.date === label)
        if (bucket) bucket.amount += Number(sale.total_amount)
      }
      setChartData([...days])
    }
    setSalesLoading(false)
  }, [activeBranch])

  useEffect(() => { void loadSales() }, [loadSales])

  const currency = stats?.currencyCode ?? 'GHS'

  const topMeds = useMemo(() => {
    if (!stats?.inventoryRows) return []
    return [...stats.inventoryRows]
      .filter(r => r.available_stock > 0)
      .sort((a, b) => (Number(b.selling_price) * b.available_stock) - (Number(a.selling_price) * a.available_stock))
      .slice(0, 6)
  }, [stats])

  const maxMedVal = topMeds[0]
    ? Number(topMeds[0].selling_price) * topMeds[0].available_stock
    : 1

  const expiringBatches = useMemo(() => {
    if (!stats?.inventoryRows) return []
    return [...stats.inventoryRows]
      .filter(r => r.days_to_nearest_expiry !== null && r.days_to_nearest_expiry > 0 && r.days_to_nearest_expiry <= 90)
      .sort((a, b) => (a.days_to_nearest_expiry ?? 999) - (b.days_to_nearest_expiry ?? 999))
      .slice(0, 6)
  }, [stats])

  const totalInventory = stats?.inventoryRows.length ?? 0
  const outOfStockCount = stats?.inventoryRows.filter(r => r.available_stock === 0).length ?? 0
  const healthyCount = totalInventory - (stats?.lowStockCount ?? 0) - outOfStockCount

  const donutData = [
    { name: 'Healthy',      value: healthyCount,              color: '#16a34a' },
    { name: 'Low stock',    value: stats?.lowStockCount ?? 0, color: '#d97706' },
    { name: 'Out of stock', value: outOfStockCount,           color: '#dc2626' },
  ]

  const criticalExpiring = expiringBatches.filter(r => (r.days_to_nearest_expiry ?? 999) <= 21).length

  return (
    <div className="mx-auto max-w-screen-xl flex flex-col gap-3 sm:gap-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-1">
            {activeBranch ? activeBranch.name : 'Select a branch'} &nbsp;·&nbsp; Overview
          </p>
        </div>
        <button
          onClick={() => { void refresh(); void loadSales() }}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-opacity disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}
      {!activeBranch && !loading && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
          Select a branch from the top bar to see live data.
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Revenue Today"
          value={formatCurrency(stats?.salesTodayAmount ?? 0, currency)}
          sub={`${stats?.transactionCount ?? 0} transactions`}
          numColor="#15803d"
          loading={loading}
        />
        <KpiCard
          label="Monthly Revenue"
          value={formatCurrency(stats?.grossProfitMonth ?? 0, currency)}
          sub="Month to date"
          numColor="#1d4ed8"
          loading={loading}
        />
        <KpiCard
          label="Low Stock Alerts"
          value={String(stats?.lowStockCount ?? 0)}
          sub="Need reorder"
          numColor={(stats?.lowStockCount ?? 0) > 0 ? '#b45309' : '#111827'}
          loading={loading}
        />
        <KpiCard
          label="Expiring Soon"
          value={String(stats?.expiringSoonCount ?? 0)}
          sub="Within 90 days"
          numColor={(stats?.expiringSoonCount ?? 0) > 0 ? '#b91c1c' : '#111827'}
          loading={loading}
        />
      </div>

      {/* ── Chart Row: sales area (wide) + donut ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

        {/* Sales Trend — takes 2/3 on large screens */}
        <Card className="lg:col-span-2">
          <CardHead
            title="Weekly Sales"
            sub="Revenue over the last 7 days"
            tag="This week"
            tagClass="bg-green-50 text-green-700"
          />
          <div className="pt-3 pr-1">
            {salesLoading ? (
              <div className="px-4 pb-4"><Skeleton className="h-44 w-full" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(17,24,39,.06)" strokeDasharray="0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44}
                    tickFormatter={v => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v as number))}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value), currency), 'Revenue']}
                    contentStyle={{ borderRadius: 8, border: '1px solid rgba(17,24,39,.08)', fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5, fill: '#16a34a', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Stock Health Donut */}
        <Card className="flex flex-col">
          <CardHead title="Stock Health" sub={`${totalInventory} medications in catalog`} />
          {loading ? (
            <div className="flex flex-col items-center gap-3 p-5">
              <Skeleton className="h-36 w-36 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center p-4 sm:p-5">
              <div className="relative" style={{ width: 148, height: 148 }}>
                <PieChart width={148} height={148}>
                  <Pie
                    data={donutData} cx={74} cy={74}
                    innerRadius={38} outerRadius={62}
                    startAngle={90} endAngle={-270}
                    paddingAngle={1.5} dataKey="value" strokeWidth={0}
                  >
                    {donutData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                </PieChart>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] font-extrabold leading-none text-gray-900">{totalInventory}</span>
                  <span className="mt-1 text-[10px] text-gray-400">medications</span>
                </div>
              </div>
              <div className="mt-4 flex w-full justify-around border-t border-black/[0.08] pt-4">
                {donutData.map(s => (
                  <div key={s.name} className="flex flex-1 flex-col items-center gap-1">
                    <div className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    <span className="text-base font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                    <span className="text-center text-[10.5px] leading-snug text-gray-400">
                      {s.name}<br />{totalInventory > 0 ? `${Math.round(s.value / totalInventory * 100)}%` : '0%'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom Row: top meds + expiring ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

        {/* Top Medications */}
        <Card>
          <CardHead title="Top Medications" sub="By stock value — current inventory" tag="By value" tagClass="bg-green-50 text-green-700" />
          <div className="px-4 sm:px-5 pb-3">
            {loading ? (
              <div className="flex flex-col gap-2 pt-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : topMeds.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No inventory data</div>
            ) : topMeds.map((m, i) => {
              const val = Number(m.selling_price) * m.available_stock
              const pct = Math.round((val / maxMedVal) * 100)
              return (
                <div
                  key={m.medication_name}
                  className={`flex items-center gap-3 py-2.5 ${i < topMeds.length - 1 ? 'border-b border-black/[0.06]' : ''}`}
                >
                  <span className="w-4 shrink-0 text-right text-[11px] font-bold text-gray-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-600">{m.medication_name}</span>
                  <div className="hidden sm:block w-16 shrink-0">
                    <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs font-bold text-gray-900 tabular-nums">
                    {formatCurrency(val, currency)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHead
            title="Expiring Soon"
            sub="Batches within the next 90 days"
            tag={criticalExpiring > 0 ? `${criticalExpiring} critical` : `${expiringBatches.length} batches`}
            tagClass={criticalExpiring > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}
          />
          <div className="px-4 sm:px-5 pb-3">
            {loading ? (
              <div className="flex flex-col gap-2 pt-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : expiringBatches.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No batches expiring within 90 days</div>
            ) : expiringBatches.map((r, i) => {
              const days = r.days_to_nearest_expiry ?? 0
              return (
                <div
                  key={`${r.medication_name}-${i}`}
                  className={`flex items-center gap-3 py-2.5 ${i < expiringBatches.length - 1 ? 'border-b border-black/[0.06]' : ''}`}
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: days <= 21 ? '#dc2626' : days <= 60 ? '#d97706' : '#3b82f6' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-600">{r.medication_name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{r.available_stock} units remaining</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${expiryStyle(days)}`}>
                    {days}d
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ── Recent Sales ── */}
      <Card>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-black/[0.08]">
          <div>
            <p className="text-[13.5px] font-bold text-gray-900">Recent Sales</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">Last 6 transactions this week</p>
          </div>
          <Link href="/sales" className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-green-700">
            View all <ChevronRight size={13} />
          </Link>
        </div>

        {salesLoading ? (
          <div className="flex flex-col gap-2.5 p-4 sm:p-5">{[1,2,3,4].map(i => <Skeleton key={i} className="h-11 w-full" />)}</div>
        ) : recentSales.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
            <ShoppingCart size={28} className="opacity-30" />
            <p className="text-sm">No sales recorded yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] bg-gray-50">
                    {[
                      { label: 'Receipt', align: 'left', cls: '' },
                      { label: 'Payment', align: 'left', cls: 'hidden sm:table-cell' },
                      { label: 'Total', align: 'right', cls: '' },
                      { label: 'Status', align: 'center', cls: 'hidden sm:table-cell' },
                    ].map(h => (
                      <th
                        key={h.label}
                        className={`px-4 sm:px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 text-${h.align} ${h.cls}`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale, i) => {
                    const pay = payStyle(sale.payment_method)
                    const done = sale.status === 'completed'
                    return (
                      <tr key={sale.id} className={i < recentSales.length - 1 ? 'border-b border-black/[0.05]' : ''}>
                        <td className="px-4 sm:px-5 py-3">
                          <p className="text-xs font-bold text-gray-900 tabular-nums">{sale.sale_number}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(sale.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="hidden sm:table-cell px-4 sm:px-5 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pay.className}`}>
                            {pay.label}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-right">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            {formatCurrency(Number(sale.total_amount), sale.currency_code)}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 sm:px-5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${done ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {done ? 'Completed' : sale.status === 'voided' ? 'Voided' : sale.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-black/[0.08] bg-gray-50 px-4 sm:px-5 py-2.5">
              <span className="text-xs text-gray-400">Showing {recentSales.length} recent transactions</span>
              <Link href="/sales" className="text-xs font-semibold text-green-700">View all sales →</Link>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
