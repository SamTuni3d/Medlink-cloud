'use client'

import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/dexie/db'
import { processSyncQueue } from '@/lib/sync/syncQueue'
import { createClient } from '@/lib/supabase/client'

interface UseSyncQueueReturn {
  pendingCount: number
  failedCount: number
  isSyncing: boolean
  syncNow: () => void
}

export function useSyncQueue(): UseSyncQueueReturn {
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const refreshCounts = useCallback(async () => {
    const [pending, failed] = await Promise.all([
      db.pending_sales.where('sync_status').equals('pending').count(),
      db.pending_sales.where('sync_status').equals('failed').count(),
    ])
    setPendingCount(pending)
    setFailedCount(failed)
  }, [])

  const runSync = useCallback(async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const supabase = createClient()
      await processSyncQueue(supabase)
      // Re-queue any that were stuck as 'syncing' (from a previous crashed attempt)
      await db.pending_sales
        .where('sync_status')
        .equals('syncing')
        .modify({ sync_status: 'pending' })
    } finally {
      setIsSyncing(false)
      await refreshCounts()
    }
  }, [isSyncing, refreshCounts])

  useEffect(() => {
    refreshCounts()

    // Sync on mount if online
    if (navigator.onLine) runSync()

    const onOnline = () => runSync()
    window.addEventListener('online', onOnline)

    // Also poll every 30 s while online
    const interval = setInterval(() => {
      if (navigator.onLine) runSync()
    }, 30_000)

    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { pendingCount, failedCount, isSyncing, syncNow: runSync }
}
