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

function expiryStyle(days: number): { bg: string; color: string } {
  if (days <= 21) return { bg: '#fff1f1', color: '#b91c1c' }
  if (days <= 60) return { bg: '#fef9ee', color: '#b45309' }
  return { bg: '#eff6ff', color: '#1d4ed8' }
}

function payStyle(method: string): { label: string; bg: string; color: string } {
  if (method.includes('mobile') || method.includes('momo') || method.includes('money')) {
    return { label: 'MoMo', bg: '#eff6ff', color: '#1d4ed8' }
  }
  if (method.includes('card')) {
    return { label: 'Card', bg: '#fef9ee', color: '#b45309' }
  }
  return { label: 'Cash', bg: '#f0fdf4', color: '#15803d' }
}

// ── design tokens ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(17,24,39,.08)',
  borderRadius: 10,
  boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.04)',
  overflow: 'hidden',
}

const CARD_HEAD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px 12px',
  borderBottom: '1px solid rgba(17,24,39,.08)',
}

const TAG_BASE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '3px 9px',
  borderRadius: 999, whiteSpace: 'nowrap',
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
    <div style={{ ...CARD, padding: '20px 20px 16px' }}>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>{label}</p>
      {loading ? (
        <>
          <Skeleton className="h-8 w-28 mb-2.5" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <p style={{
            fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            lineHeight: 1, color: numColor ?? '#111827', marginBottom: 9,
          }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: '#9ca3af' }}>{sub}</p>}
        </>
      )}
    </div>
  )
}

// ── chart title/sub ───────────────────────────────────────────────────────────

function CardHead({ title, sub, tag, tagColor }: {
  title: string; sub?: string
  tag?: string; tagColor?: { bg: string; color: string }
}) {
  return (
    <div style={CARD_HEAD}>
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{title}</p>
        {sub && <p style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>{sub}</p>}
      </div>
      {tag && tagColor && (
        <span style={{ ...TAG_BASE, background: tagColor.bg, color: tagColor.color }}>{tag}</span>
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
    { name: 'Healthy',      value: healthyCount,          color: '#16a34a' },
    { name: 'Low stock',    value: stats?.lowStockCount ?? 0, color: '#d97706' },
    { name: 'Out of stock', value: outOfStockCount,        color: '#dc2626' },
  ]

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            {activeBranch ? activeBranch.name : 'Select a branch'} &nbsp;·&nbsp; Overview
          </p>
        </div>
        <button
          onClick={() => { void refresh(); void loadSales() }}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 7,
            border: '1px solid rgba(17,24,39,.08)', background: '#fff',
            fontSize: 12.5, fontWeight: 500, color: '#4b5563',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff1f1', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!activeBranch && !loading && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13 }}>
          Select a branch from the top bar to see live data.
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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

      {/* ── Chart Row: sales (2fr) | donut (1fr) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

        {/* Sales Trend */}
        <div style={CARD}>
          <CardHead
            title="Weekly Sales"
            sub="Revenue over the last 7 days"
            tag="This week"
            tagColor={{ bg: '#f0fdf4', color: '#15803d' }}
          />
          <div style={{ padding: '12px 4px 0 0' }}>
            {salesLoading ? (
              <div style={{ padding: '0 16px 16px' }}><Skeleton className="h-48 w-full" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={188}>
                <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(17,24,39,.06)" strokeDasharray="0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10.5, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false} width={46}
                    tickFormatter={v => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v as number))}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value), currency), 'Revenue']}
                    contentStyle={{
                      borderRadius: 8, border: '1px solid rgba(17,24,39,.08)',
                      fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,.08)',
                    }}
                  />
                  <Area
                    type="monotone" dataKey="amount"
                    stroke="#16a34a" strokeWidth={2.5}
                    fill="url(#salesGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#16a34a', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Stock Health Donut */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
          <CardHead title="Stock Health" sub={`${totalInventory} medications in catalog`} />
          {loading ? (
            <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Skeleton className="w-36 h-36 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 16px' }}>
              <div style={{ position: 'relative', width: 148, height: 148 }}>
                <PieChart width={148} height={148}>
                  <Pie
                    data={donutData}
                    cx={74} cy={74}
                    innerRadius={38} outerRadius={62}
                    startAngle={90} endAngle={-270}
                    paddingAngle={1.5}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                </PieChart>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                    {totalInventory}
                  </span>
                  <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>medications</span>
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-around', width: '100%',
                marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(17,24,39,.08)',
              }}>
                {donutData.map(s => (
                  <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 500, textAlign: 'center', lineHeight: 1.4 }}>
                      {s.name}<br />
                      {totalInventory > 0 ? `${Math.round(s.value / totalInventory * 100)}%` : '0%'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Bottom Row: top meds (1fr) | expiring (1fr) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Top Medications */}
        <div style={CARD}>
          <CardHead
            title="Top Medications"
            sub="By stock value — current inventory"
            tag="By value"
            tagColor={{ bg: '#f0fdf4', color: '#15803d' }}
          />
          <div style={{ padding: '8px 20px 14px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : topMeds.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No inventory data
              </div>
            ) : topMeds.map((m, i) => {
              const val = Number(m.selling_price) * m.available_stock
              const pct = Math.round((val / maxMedVal) * 100)
              return (
                <div key={m.medication_name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < topMeds.length - 1 ? '1px solid rgba(17,24,39,.08)' : 'none',
                }}>
                  <span style={{ width: 16, fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {m.medication_name}
                  </span>
                  <div style={{ width: 70, flexShrink: 0 }}>
                    <div style={{ height: 5, background: 'rgba(17,24,39,.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', borderRadius: 3 }} />
                    </div>
                  </div>
                  <span style={{ width: 70, fontSize: 12, fontWeight: 700, color: '#111827', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(val, currency)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Expiring Soon */}
        <div style={CARD}>
          <CardHead
            title="Expiring Soon"
            sub="Batches within the next 90 days"
            tag={expiringBatches.filter(r => (r.days_to_nearest_expiry ?? 999) <= 21).length > 0
              ? `${expiringBatches.filter(r => (r.days_to_nearest_expiry ?? 999) <= 21).length} critical`
              : `${expiringBatches.length} batches`}
            tagColor={expiringBatches.some(r => (r.days_to_nearest_expiry ?? 999) <= 21)
              ? { bg: '#fff1f1', color: '#b91c1c' }
              : { bg: '#f0fdf4', color: '#15803d' }}
          />
          <div style={{ padding: '8px 20px 14px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : expiringBatches.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No batches expiring within 90 days
              </div>
            ) : expiringBatches.map((r, i) => {
              const days = r.days_to_nearest_expiry ?? 0
              const s = expiryStyle(days)
              return (
                <div key={`${r.medication_name}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0',
                  borderBottom: i < expiringBatches.length - 1 ? '1px solid rgba(17,24,39,.08)' : 'none',
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: days <= 21 ? '#dc2626' : days <= 60 ? '#d97706' : '#3b82f6',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.medication_name}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {r.available_stock} units remaining
                    </p>
                  </div>
                  <span style={{ ...s, ...TAG_BASE }}>
                    {days}d
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Recent Sales Table ── */}
      <div style={CARD}>
        <div style={{ ...CARD_HEAD }}>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>Recent Sales</p>
            <p style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>Last 6 transactions this week</p>
          </div>
          <Link href="/sales" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12.5, fontWeight: 600, color: '#16a34a',
          }}>
            View all <ChevronRight size={13} />
          </Link>
        </div>

        {salesLoading ? (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-11 w-full" />)}
          </div>
        ) : recentSales.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <ShoppingCart size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>No sales recorded yet</p>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid rgba(17,24,39,.08)' }}>
                  {['Receipt', 'Cashier', 'Items', 'Total', 'Payment', 'Status'].map((h, i) => (
                    <th key={h} style={{
                      padding: '9px 20px 8px',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
                      color: '#9ca3af', textAlign: i >= 2 ? 'center' : 'left',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, i) => {
                  const pay = payStyle(sale.payment_method)
                  const done = sale.status === 'completed'
                  return (
                    <tr key={sale.id} style={{
                      borderBottom: i < recentSales.length - 1 ? '1px solid rgba(17,24,39,.06)' : 'none',
                    }}>
                      <td style={{ padding: '12px 20px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                          {sale.sale_number}
                        </p>
                        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                          {new Date(sale.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {/* sale doesn't carry cashier name — show payment method channel */}
                          {sale.payment_method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: 5,
                          border: '1px solid rgba(17,24,39,.08)', background: '#f9fafb',
                          fontSize: 12, fontWeight: 700, color: '#111827',
                        }}>—</span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                          {formatCurrency(Number(sale.total_amount), sale.currency_code)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <span style={{ ...TAG_BASE, background: pay.bg, color: pay.color }}>
                          {pay.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <span style={{
                          ...TAG_BASE,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: done ? '#f0fdf4' : '#fff1f1',
                          color: done ? '#15803d' : '#b91c1c',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                          {done ? 'Completed' : sale.status === 'voided' ? 'Voided' : sale.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px', borderTop: '1px solid rgba(17,24,39,.08)',
              background: '#f9fafb',
            }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Showing {recentSales.length} recent transactions
              </span>
              <Link href="/sales" style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
                View all sales →
              </Link>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
