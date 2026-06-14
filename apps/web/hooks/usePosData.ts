'use client'

import { useEffect, useState, useCallback } from 'react'
import { db, type MedicationCache, type InventoryCache } from '@/lib/dexie/db'
import { seedMedicationsCache, seedInventoryCache } from '@/lib/sync/syncQueue'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/auth-provider'

export interface PosProduct extends MedicationCache {
  available_stock: number
}

interface UsePosDataReturn {
  products: PosProduct[]
  loading: boolean
  /** Manually trigger a background cache refresh from Supabase */
  refresh: () => void
}

export function usePosData(branchId: string | null): UsePosDataReturn {
  const { organizationId } = useAuth()
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)

  const loadFromCache = useCallback(async () => {
    if (!branchId || !organizationId) return

    const [meds, inventory] = await Promise.all([
      db.medications_cache
        .where('organization_id')
        .equals(organizationId)
        .filter(m => m.is_active)
        .toArray(),
      db.inventory_cache
        .where('branch_id')
        .equals(branchId)
        .toArray(),
    ])

    const inventoryMap = new Map<string, InventoryCache>(
      inventory.map(inv => [inv.medication_id, inv])
    )

    const combined: PosProduct[] = meds.map(med => ({
      ...med,
      available_stock: inventoryMap.get(med.id)?.available_stock ?? 0,
    }))

    setProducts(combined.sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }, [branchId, organizationId])

  const seedFromSupabase = useCallback(async () => {
    if (!branchId || !organizationId || !navigator.onLine) return
    const supabase = createClient()
    await Promise.all([
      seedMedicationsCache(supabase, organizationId),
      seedInventoryCache(supabase, branchId),
    ])
    await loadFromCache()
  }, [branchId, organizationId, loadFromCache])

  useEffect(() => {
    if (!branchId || !organizationId) return

    // Load from Dexie immediately (works offline)
    loadFromCache().then(() => {
      // Then refresh from Supabase in the background if online
      if (navigator.onLine) {
        seedFromSupabase()
      }
    })
  }, [branchId, organizationId, loadFromCache, seedFromSupabase])

  return { products, loading, refresh: seedFromSupabase }
}
