'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSyncQueue } from '@/hooks/useSyncQueue'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [mounted, setMounted] = useState(false)
  const { pendingCount, failedCount, isSyncing, syncNow } = useSyncQueue()

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (!mounted) return null

  // Online and everything synced — show nothing
  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  const hasFailed = failedCount > 0

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all ${
        !isOnline
          ? 'bg-amber-500/10 text-amber-700'
          : hasFailed
            ? 'bg-red-500/10 text-red-700'
            : 'bg-blue-500/10 text-blue-700'
      }`}
    >
      {!isOnline ? (
        <WifiOff className="h-4 w-4 shrink-0" />
      ) : hasFailed ? (
        <AlertCircle className="h-4 w-4 shrink-0" />
      ) : (
        <RefreshCw className={`h-4 w-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
      )}

      <span className="flex-1">
        {!isOnline
          ? `You're offline. ${pendingCount > 0 ? `${pendingCount} sale${pendingCount !== 1 ? 's' : ''} will sync when reconnected.` : 'POS is still available.'}`
          : hasFailed
            ? `${failedCount} sale${failedCount !== 1 ? 's' : ''} failed to sync.`
            : `Syncing ${pendingCount} sale${pendingCount !== 1 ? 's' : ''}…`}
      </span>

      {isOnline && (
        <button
          onClick={syncNow}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-current/30 transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {isSyncing ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing…</>
          ) : (
            <><CheckCircle2 className="h-3 w-3" /> Retry now</>
          )}
        </button>
      )}
    </div>
  )
}
