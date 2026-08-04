'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Timer, LogIn, LogOut, Users, RefreshCw, Clock, History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'
import { useToast } from '@/hooks/use-toast'
import {
  clockInAction,
  clockOutAction,
  getActiveDutySessionsAction,
  getDutyHistoryAction,
} from './actions'
import type { DutySessionWithUser } from '@medlink/data-client'

// ── Duration helpers ──────────────────────────────────────────────────────────

function formatDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : new Date()
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Live ticker component ─────────────────────────────────────────────────────

function LiveDuration({ startIso }: { startIso: string }) {
  const [label, setLabel] = useState(() => formatDuration(startIso))
  useEffect(() => {
    const id = setInterval(() => setLabel(formatDuration(startIso)), 30_000)
    return () => clearInterval(id)
  }, [startIso])
  return <span>{label}</span>
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DutySessionsPage() {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { toast } = useToast()

  const [activeSessions, setActiveSessions] = useState<DutySessionWithUser[]>([])
  const [history, setHistory] = useState<DutySessionWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  const mySession = activeSessions.find(s => s.user_id === user?.id)

  const loadActive = useCallback(async () => {
    if (!activeBranch?.id) return
    const result = await getActiveDutySessionsAction(activeBranch.id)
    if (result.ok) setActiveSessions(result.data)
    setLoading(false)
  }, [activeBranch?.id])

  const loadHistory = useCallback(async () => {
    if (!activeBranch?.id) return
    setHistoryLoading(true)
    const result = await getDutyHistoryAction(activeBranch.id, 30)
    if (result.ok) setHistory(result.data.filter(s => s.clocked_out_at !== null))
    setHistoryLoading(false)
  }, [activeBranch?.id])

  useEffect(() => {
    setLoading(true)
    loadActive()
    loadHistory()
  }, [loadActive, loadHistory])

  async function handleClockIn() {
    if (!activeBranch?.id) return
    setActioning('in')
    const result = await clockInAction(activeBranch.id)
    setActioning(null)
    if (!result.ok) {
      toast({ title: result.error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Clocked in successfully' })
    loadActive()
  }

  async function handleClockOut(sessionId: string, name?: string) {
    setActioning(sessionId)
    const result = await clockOutAction(sessionId)
    setActioning(null)
    if (!result.ok) {
      toast({ title: result.error.message, variant: 'destructive' })
      return
    }
    toast({ title: name ? `${name} clocked out` : 'Clocked out' })
    loadActive()
    loadHistory()
  }

  const isSelf = (session: DutySessionWithUser) => session.user_id === user?.id

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Duty Sessions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track staff shift times for this branch</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { loadActive(); loadHistory() }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>

      {/* ── Your Status Card ── */}
      <div className={`rounded-xl border p-5 ${mySession
        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
        : 'border-border bg-card'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              mySession ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'
            }`}>
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {mySession ? 'You are on duty' : 'You are off duty'}
              </p>
              {mySession ? (
                <p className="text-xs text-muted-foreground">
                  Since {formatTime(mySession.clocked_in_at)} · <LiveDuration startIso={mySession.clocked_in_at} />
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not clocked in</p>
              )}
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-9 w-28" />
          ) : mySession ? (
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
              disabled={actioning === mySession.id}
              onClick={() => handleClockOut(mySession.id)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {actioning === mySession.id ? 'Clocking out…' : 'Clock Out'}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={actioning === 'in'}
              onClick={handleClockIn}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {actioning === 'in' ? 'Clocking in…' : 'Clock In'}
            </Button>
          )}
        </div>
      </div>

      {/* ── On Duty Now ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">On Duty Now</h2>
          {!loading && (
            <Badge variant="secondary">{activeSessions.length}</Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-muted-foreground">
            <Clock className="h-8 w-8 text-muted" />
            <p className="text-sm">No staff currently on duty</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map(session => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground uppercase">
                    {session.user_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.user_name}
                      {isSelf(session) && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      In at {formatTime(session.clocked_in_at)} · <LiveDuration startIso={session.clocked_in_at} />
                    </p>
                  </div>
                </div>

                {isSelf(session) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={actioning === session.id}
                    onClick={() => handleClockOut(session.id)}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Recent History</h2>
        </div>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No completed sessions yet</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Out</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map(session => (
                  <tr key={session.id} className="bg-card hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{session.user_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(session.clocked_in_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTime(session.clocked_in_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {session.clocked_out_at ? formatTime(session.clocked_out_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {session.clocked_out_at
                        ? formatDuration(session.clocked_in_at, session.clocked_out_at)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
