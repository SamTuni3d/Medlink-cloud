'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSales, getInventory, getNotifications } from '@medlink/data-client'

export interface DashboardStats {
  salesToday: number
  salesTodayAmount: number
  currencyCode: string
  transactionCount: number
  lowStockCount: number
  expiringSoonCount: number
}

export function useDashboardStats(
  branchId: string | null,
  organizationId: string | null
) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!branchId || !organizationId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const client = createClient()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [salesResult, inventoryResult, notificationsResult] = await Promise.all([
      getSales(client, branchId, {
        fromDate: todayStart.toISOString(),
        status: 'completed',
        limit: 500,
      }),
      getInventory(client, branchId),
      getNotifications(client, organizationId, { branchId, unreadOnly: false, limit: 200 }),
    ])

    if (!salesResult.ok) {
      setError(salesResult.error.message)
      setLoading(false)
      return
    }

    const sales = salesResult.data
    const salesTodayAmount = sales.reduce((sum, s) => sum + s.total_amount, 0)
    const currencyCode = sales[0]?.currency_code ?? 'GHS'

    const inventoryRows = inventoryResult.ok ? inventoryResult.data : []
    const lowStockCount = inventoryRows.filter(r => r.available_stock <= r.reorder_point).length

    const notifications = notificationsResult.ok ? notificationsResult.data : []
    const expiringSoonCount = notifications.filter(
      n => n.type === 'expiry_warning' && !n.is_read
    ).length

    setStats({
      salesToday: salesTodayAmount,
      salesTodayAmount,
      currencyCode,
      transactionCount: sales.length,
      lowStockCount,
      expiringSoonCount,
    })
    setLoading(false)
  }, [branchId, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  return { stats, loading, error, refresh: load }
}
