'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  TrendingUp, ShoppingCart, AlertTriangle, Clock, RefreshCw, Bell, CheckCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { formatCurrency } from '@/lib/formatCurrency'
import { createClient } from '@/lib/supabase/client'
import { getNotifications, markAllNotificationsRead } from '@medlink/data-client'
import type { Notification } from '@medlink/data-client'

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

  const loadNotifications = useCallback(async () => {
    if (!organizationId) { setNotifLoading(false); return }
    setNotifLoading(true)
    const result = await getNotifications(createClient(), organizationId, {
      branchId: activeBranch?.id,
      unreadOnly: false,
      limit: 20,
    })
    if (result.ok) setNotifications(result.data)
    setNotifLoading(false)
  }, [organizationId, activeBranch?.id])

  useEffect(() => { void loadNotifications() }, [loadNotifications])

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
      label: 'Total Sales Today',
      icon: TrendingUp,
      value: loading ? null : formatCurrency(stats?.salesTodayAmount ?? 0, currencyCode),
      sub: loading ? null : `${stats?.transactionCount ?? 0} transactions`,
    },
    {
      label: 'Transactions',
      icon: ShoppingCart,
      value: loading ? null : String(stats?.transactionCount ?? 0),
      sub: 'completed today',
    },
    {
      label: 'Low Stock Alerts',
      icon: AlertTriangle,
      value: loading ? null : String(stats?.lowStockCount ?? 0),
      sub: 'items at or below reorder point',
      urgent: (stats?.lowStockCount ?? 0) > 0,
    },
    {
      label: 'Expiring Soon',
      icon: Clock,
      value: loading ? null : String(stats?.expiringSoonCount ?? 0),
      sub: 'unread expiry alerts',
      urgent: (stats?.expiringSoonCount ?? 0) > 0,
    },
  ]

  function severityVariant(severity: Notification['severity']): 'destructive' | 'secondary' | 'outline' {
    if (severity === 'critical') return 'destructive'
    if (severity === 'warning') return 'secondary'
    return 'outline'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => { void refresh(); void loadNotifications() }} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch from the top bar to see live stats.</p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, icon: Icon, value, sub, urgent }) => (
          <Card key={label} className={urgent ? 'border-destructive/50' : undefined}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {value === null
                ? <Skeleton className="h-9 w-24" />
                : <p className={`text-3xl font-bold ${urgent ? 'text-destructive' : 'text-primary'}`}>{value}</p>}
              {sub === null
                ? <Skeleton className="mt-1 h-4 w-32" />
                : <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notifications panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()} disabled={markingRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {notifLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {activeBranch ? 'No notifications.' : 'Select a branch to see notifications.'}
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id}
                  className={`flex gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    n.is_read ? 'opacity-60' : 'bg-muted/30'
                  }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{n.title}</span>
                      <Badge variant={severityVariant(n.severity)} className="text-xs capitalize">
                        {n.severity}
                      </Badge>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">{n.body}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(n.created_at).toLocaleString('en-GH', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
