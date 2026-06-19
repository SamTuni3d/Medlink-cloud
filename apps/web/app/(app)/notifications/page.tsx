'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Package, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { getInventory } from '@medlink/data-client'
import type { InventoryWithBatches } from '@medlink/data-client'

type AlertTab = 'low_stock' | 'expiring' | 'expired'

const EXPIRING_THRESHOLD = 90 // days

function SummaryCard({
  icon: Icon,
  label,
  count,
  color,
  loading,
}: {
  icon: React.ElementType
  label: string
  count: number
  color: string
  loading: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 bg-white flex items-center gap-4`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-12" />
        ) : (
          <p className="text-3xl font-bold text-foreground">{count}</p>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const { activeBranch } = useBranch()
  const [inventory, setInventory] = useState<InventoryWithBatches[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<AlertTab>('low_stock')

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true)
    const result = await getInventory(createClient(), activeBranch.id)
    if (result.ok) setInventory(result.data)
    setLoading(false)
  }, [activeBranch])

  useEffect(() => { void load() }, [load])

  const lowStock = inventory.filter(i => i.available_stock <= i.reorder_point)
  const expiringSoon = inventory.filter(
    i =>
      i.days_to_nearest_expiry !== null &&
      i.days_to_nearest_expiry > 0 &&
      i.days_to_nearest_expiry <= EXPIRING_THRESHOLD
  )
  const expired = inventory.filter(
    i => i.days_to_nearest_expiry !== null && i.days_to_nearest_expiry <= 0
  )

  const totalActive = lowStock.length + expiringSoon.length + expired.length

  const tabs: { key: AlertTab; label: string; count: number }[] = [
    { key: 'low_stock', label: 'Low Stock', count: lowStock.length },
    { key: 'expiring', label: 'Expiring', count: expiringSoon.length },
    { key: 'expired', label: 'Expired', count: expired.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Critical alerts requiring your attention</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && totalActive > 0 && (
            <Badge variant="destructive" className="h-8 px-3 text-sm">
              {totalActive} Active Alert{totalActive !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to view alerts.</p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={Package}
          label="Low Stock"
          count={lowStock.length}
          color="bg-amber-50 text-amber-600 "
          loading={loading}
        />
        <SummaryCard
          icon={Clock}
          label="Expiring Soon"
          count={expiringSoon.length}
          color="bg-orange-50 text-orange-600 "
          loading={loading}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Expired"
          count={expired.length}
          color="bg-red-50 text-red-600 "
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {activeTab === 'low_stock' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <h2 className="font-semibold text-foreground">Low Stock Alerts</h2>
                  <p className="text-xs text-muted-foreground">Products below their reorder level that need restocking</p>
                </div>
              </div>
            </div>
            <AlertTable items={lowStock} type="low_stock" loading={loading} />
          </div>
        )}
        {activeTab === 'expiring' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <h2 className="font-semibold text-foreground">Expiring Soon</h2>
                  <p className="text-xs text-muted-foreground">Products expiring within {EXPIRING_THRESHOLD} days</p>
                </div>
              </div>
            </div>
            <AlertTable items={expiringSoon} type="expiring" loading={loading} />
          </div>
        )}
        {activeTab === 'expired' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <h2 className="font-semibold text-foreground">Expired Products</h2>
                  <p className="text-xs text-muted-foreground">Products past their expiry date — remove from stock immediately</p>
                </div>
              </div>
            </div>
            <AlertTable items={expired} type="expired" loading={loading} />
          </div>
        )}
      </div>
    </div>
  )
}

function AlertTable({
  items,
  type,
  loading,
}: {
  items: InventoryWithBatches[]
  type: AlertTab
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Bell className="h-10 w-10" />
        <p className="text-sm font-medium">No alerts in this category</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Name</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {type === 'low_stock' ? 'Current Stock' : 'Stock'}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {type === 'low_stock' ? 'Reorder Level' : 'Expiry Date'}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {type === 'low_stock' ? 'Deficit' : 'Days Left'}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => {
            const deficit = item.reorder_point - item.available_stock
            const daysLeft = item.days_to_nearest_expiry

            return (
              <tr key={item.inventory_id} className="hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">
                  {item.medication_name}
                  {item.strength && <span className="ml-1 text-xs text-muted-foreground">{item.strength}</span>}
                </td>
                <td className="px-6 py-4 font-semibold text-amber-600">
                  {item.available_stock}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {type === 'low_stock'
                    ? item.reorder_point
                    : item.nearest_expiry_date
                      ? new Date(item.nearest_expiry_date).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {type === 'low_stock'
                    ? (deficit > 0 ? `${deficit} units short` : '0 units short')
                    : (daysLeft !== null ? (daysLeft <= 0 ? 'Expired' : `${daysLeft} days`) : '—')}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant={type === 'expired' ? 'destructive' : 'secondary'}
                    className={
                      type === 'expired'
                        ? ''
                        : type === 'expiring'
                          ? 'bg-orange-100 text-orange-700 '
                          : 'bg-amber-100 text-amber-700 '
                    }
                  >
                    {type === 'low_stock' ? 'Low Stock' : type === 'expiring' ? 'Expiring Soon' : 'Expired'}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
