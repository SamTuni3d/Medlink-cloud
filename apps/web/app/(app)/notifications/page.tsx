'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, BellOff, Package, Clock, AlertTriangle, RefreshCw,
  CheckCheck, Info, Wifi,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getInventory, getNotifications } from '@medlink/data-client'
import { markNotificationReadAction, markAllNotificationsReadAction } from './actions'
import type { InventoryWithBatches, Notification } from '@medlink/data-client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type AlertTab = 'feed' | 'low_stock' | 'expiring' | 'expired'

const EXPIRING_THRESHOLD = 90

// ── Severity config ───────────────────────────────────────────────────────────

type SeverityStyle = { dot: string; badge: string; label: string }
const SEVERITY: Record<string, SeverityStyle> = {
  critical: { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    label: 'Critical' },
  warning:  { dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', label: 'Warning' },
  info:     { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-600',    label: 'Info' },
}
const DEFAULT_SEVERITY: SeverityStyle = SEVERITY['info']!

const TYPE_LABEL: Record<string, string> = {
  expiry_warning:              'Expiry Warning',
  reorder_alert:               'Reorder Alert',
  reconciliation_discrepancy:  'Discrepancy',
  system:                      'System',
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, count, colorClass, loading,
}: {
  icon: React.ElementType; label: string; count: number; colorClass: string; loading: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-8 w-12" /> : (
          <p className="text-3xl font-bold text-foreground">{count}</p>
        )}
      </div>
    </div>
  )
}

// ── Notification feed ─────────────────────────────────────────────────────────

function NotificationFeed({
  items, loading, onMarkRead, onMarkAll,
}: {
  items: Notification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAll: () => void
}) {
  const unreadCount = items.filter(n => !n.is_read).length

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <BellOff className="h-10 w-10" />
        <p className="text-sm font-medium">No system notifications yet</p>
        <p className="text-xs text-center max-w-xs">
          Alerts for low stock, expiring batches, and reconciliation issues will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div>
      {unreadCount > 0 && (
        <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/30">
          <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          <button
            onClick={onMarkAll}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>
      )}
      <ul className="divide-y divide-border">
        {items.map(n => {
          const sev = SEVERITY[n.severity] ?? DEFAULT_SEVERITY
          return (
            <li
              key={n.id}
              className={`flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/20 ${
                !n.is_read ? 'bg-blue-50/40' : ''
              }`}
            >
              <div className="mt-1.5 shrink-0">
                <span className={`block h-2.5 w-2.5 rounded-full ${n.is_read ? 'bg-muted' : sev.dot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <p className={`text-sm font-medium ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {n.title}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.badge}`}>
                    {sev.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {TYPE_LABEL[n.type] ?? n.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString('en-GH', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              {!n.is_read && (
                <button
                  onClick={() => onMarkRead(n.id)}
                  className="shrink-0 mt-1 text-xs text-primary hover:underline"
                  title="Mark as read"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Inventory alert table ─────────────────────────────────────────────────────

function AlertTable({
  items, type, loading,
}: {
  items: InventoryWithBatches[]; type: Exclude<AlertTab, 'feed'>; loading: boolean
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
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {type === 'low_stock' ? 'Stock' : 'Stock'}
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
                <td className="px-6 py-4 font-semibold text-amber-600">{item.available_stock}</td>
                <td className="px-6 py-4 text-muted-foreground">
                  {type === 'low_stock'
                    ? item.reorder_point
                    : item.nearest_expiry_date
                      ? new Date(item.nearest_expiry_date).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {type === 'low_stock'
                    ? `${deficit > 0 ? deficit : 0} units short`
                    : daysLeft !== null
                      ? (daysLeft <= 0 ? 'Expired' : `${daysLeft} days`)
                      : '—'}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant={type === 'expired' ? 'destructive' : 'secondary'}
                    className={
                      type === 'expired' ? '' :
                      type === 'expiring' ? 'bg-orange-100 text-orange-700' :
                      'bg-amber-100 text-amber-700'
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { activeBranch } = useBranch()
  const { organizationId } = useAuth()
  const { toast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [inventory, setInventory] = useState<InventoryWithBatches[]>([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [loadingInventory, setLoadingInventory] = useState(true)
  const [activeTab, setActiveTab] = useState<AlertTab>('feed')
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  const loadFeed = useCallback(async () => {
    if (!organizationId) { setLoadingFeed(false); return }
    setLoadingFeed(true)
    const result = await getNotifications(createClient(), organizationId, {
      branchId: activeBranch?.id,
      limit: 100,
    })
    if (result.ok) setNotifications(result.data)
    setLoadingFeed(false)
  }, [organizationId, activeBranch?.id])

  const loadInventory = useCallback(async () => {
    if (!activeBranch) { setLoadingInventory(false); return }
    setLoadingInventory(true)
    const result = await getInventory(createClient(), activeBranch.id)
    if (result.ok) setInventory(result.data)
    setLoadingInventory(false)
  }, [activeBranch])

  // Initial loads
  useEffect(() => { void loadFeed() }, [loadFeed])
  useEffect(() => { void loadInventory() }, [loadInventory])

  // Realtime subscriptions
  useEffect(() => {
    if (!organizationId || !activeBranch) return

    const supabase = createClient()
    const channels: RealtimeChannel[] = []

    // ── Channel 1: notifications table ──────────────────────────────
    const notifChannel = supabase
      .channel(`notifications:org:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification
          setNotifications(prev => [incoming, ...prev])
          toast({
            title: incoming.title,
            description: incoming.body,
            variant: incoming.severity === 'critical' ? 'destructive' : 'default',
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications(prev =>
            prev.map(n => n.id === updated.id ? { ...n, ...updated } : n)
          )
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    channels.push(notifChannel)

    // ── Channel 2: inventory table (refresh alert tabs on stock changes) ──
    const inventoryChannel = supabase
      .channel(`inventory:branch:${activeBranch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory',
          filter: `branch_id=eq.${activeBranch.id}`,
        },
        () => { void loadInventory() }
      )
      .subscribe()

    channels.push(inventoryChannel)

    return () => {
      channels.forEach(ch => { void supabase.removeChannel(ch) })
      setRealtimeConnected(false)
    }
  }, [organizationId, activeBranch, loadInventory, toast])

  // ── Mark read handlers ────────────────────────────────────────────

  async function handleMarkRead(id: string) {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await markNotificationReadAction(id)
  }

  async function handleMarkAll() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await markAllNotificationsReadAction(activeBranch?.id)
  }

  // ── Derived inventory alerts ──────────────────────────────────────

  const lowStock   = inventory.filter(i => i.reorder_point > 0 && i.available_stock < i.reorder_point)
  const expiring   = inventory.filter(i => i.days_to_nearest_expiry !== null && i.days_to_nearest_expiry > 0 && i.days_to_nearest_expiry <= EXPIRING_THRESHOLD)
  const expired    = inventory.filter(i => i.days_to_nearest_expiry !== null && i.days_to_nearest_expiry <= 0)
  const unreadFeed = notifications.filter(n => !n.is_read).length
  const totalAlerts = lowStock.length + expiring.length + expired.length

  const tabs: { key: AlertTab; label: string; count: number }[] = [
    { key: 'feed',      label: 'Notifications', count: unreadFeed },
    { key: 'low_stock', label: 'Low Stock',      count: lowStock.length },
    { key: 'expiring',  label: 'Expiring',       count: expiring.length },
    { key: 'expired',   label: 'Expired',        count: expired.length },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live alerts for stock, expiry, and system events</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Realtime status pill */}
          <div className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            realtimeConnected
              ? 'bg-[hsl(175_35%_91%)] text-[#004741]'
              : 'bg-muted text-muted-foreground'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? 'bg-[#004741] animate-pulse' : 'bg-muted-foreground'}`} />
            <Wifi className="h-3 w-3" />
            {realtimeConnected ? 'Live' : 'Connecting…'}
          </div>
          {totalAlerts > 0 && !loadingInventory && (
            <Badge variant="destructive" className="h-8 px-3 text-sm">
              {totalAlerts} Inventory Alert{totalAlerts !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => { void loadFeed(); void loadInventory() }} disabled={loadingFeed && loadingInventory}>
            <RefreshCw className={`mr-2 h-4 w-4 ${(loadingFeed || loadingInventory) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!activeBranch && !loadingInventory && (
        <p className="text-sm text-muted-foreground">Select a branch to view alerts.</p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard icon={Info}          label="Unread"        count={unreadFeed}      colorClass="bg-blue-50 text-blue-600"   loading={loadingFeed} />
        <SummaryCard icon={Package}       label="Low Stock"     count={lowStock.length} colorClass="bg-amber-50 text-amber-600"  loading={loadingInventory} />
        <SummaryCard icon={Clock}         label="Expiring Soon" count={expiring.length} colorClass="bg-orange-50 text-orange-600" loading={loadingInventory} />
        <SummaryCard icon={AlertTriangle} label="Expired"       count={expired.length}  colorClass="bg-red-50 text-red-600"     loading={loadingInventory} />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {activeTab === 'feed' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold text-foreground">System Notifications</h2>
                  <p className="text-xs text-muted-foreground">Auto-generated by the system — updates live in real time</p>
                </div>
              </div>
            </div>
            <NotificationFeed
              items={notifications}
              loading={loadingFeed}
              onMarkRead={id => void handleMarkRead(id)}
              onMarkAll={() => void handleMarkAll()}
            />
          </div>
        )}

        {activeTab === 'low_stock' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <h2 className="font-semibold text-foreground">Low Stock Alerts</h2>
                  <p className="text-xs text-muted-foreground">Products below their reorder level · updates live</p>
                </div>
              </div>
            </div>
            <AlertTable items={lowStock} type="low_stock" loading={loadingInventory} />
          </div>
        )}

        {activeTab === 'expiring' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <h2 className="font-semibold text-foreground">Expiring Soon</h2>
                  <p className="text-xs text-muted-foreground">Products expiring within {EXPIRING_THRESHOLD} days · updates live</p>
                </div>
              </div>
            </div>
            <AlertTable items={expiring} type="expiring" loading={loadingInventory} />
          </div>
        )}

        {activeTab === 'expired' && (
          <div>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <h2 className="font-semibold text-foreground">Expired Products</h2>
                  <p className="text-xs text-muted-foreground">Past their expiry date — remove from stock immediately</p>
                </div>
              </div>
            </div>
            <AlertTable items={expired} type="expired" loading={loadingInventory} />
          </div>
        )}
      </div>
    </div>
  )
}

