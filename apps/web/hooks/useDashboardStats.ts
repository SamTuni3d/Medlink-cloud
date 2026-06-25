'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSales, getInventory } from '@medlink/data-client'
import type { InventoryWithBatches } from '@medlink/data-client'

export interface DashboardStats {
  salesToday: number
  salesTodayAmount: number
  grossProfitMonth: number
  inventoryValue: number
  currencyCode: string
  transactionCount: number
  lowStockCount: number
  expiringSoonCount: number
  inventoryRows: InventoryWithBatches[]
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

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [todaySalesResult, monthSalesResult, inventoryResult] = await Promise.all([
      getSales(client, branchId, {
        fromDate: todayStart.toISOString(),
        status: 'completed',
        limit: 500,
      }),
      getSales(client, branchId, {
        fromDate: monthStart.toISOString(),
        status: 'completed',
        limit: 2000,
      }),
      getInventory(client, branchId),
    ])

    if (!todaySalesResult.ok) {
      setError(todaySalesResult.error.message)
      setLoading(false)
      return
    }

    const sales = todaySalesResult.data
    const salesTodayAmount = sales.reduce((sum, s) => sum + s.total_amount, 0)
    const currencyCode = sales[0]?.currency_code ?? 'GHS'

    const monthSales = monthSalesResult.ok ? monthSalesResult.data : []
    const grossProfitMonth = monthSales.reduce((sum, s) => sum + s.total_amount, 0)

    const inventoryRows = inventoryResult.ok ? inventoryResult.data : []
    const inventoryValue = inventoryRows.reduce(
      (sum, r) => sum + r.available_stock * r.selling_price,
      0
    )
    const lowStockCount = inventoryRows.filter(r => r.reorder_point > 0 && r.available_stock < r.reorder_point).length
    const expiringSoonCount = inventoryRows.filter(
      r => r.days_to_nearest_expiry !== null && r.days_to_nearest_expiry > 0 && r.days_to_nearest_expiry <= 90
    ).length

    setStats({
      salesToday: salesTodayAmount,
      salesTodayAmount,
      grossProfitMonth,
      inventoryValue,
      currencyCode,
      transactionCount: sales.length,
      lowStockCount,
      expiringSoonCount,
      inventoryRows,
    })
    setLoading(false)
  }, [branchId, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  return { stats, loading, error, refresh: load }
}
