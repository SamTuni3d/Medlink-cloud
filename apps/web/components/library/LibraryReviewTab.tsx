'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { CheckCircle2, XCircle, Clock, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { getPendingSuggestions } from '@medlink/data-client'
import type { LibraryEntry } from '@medlink/data-client'
import { approveSuggestionAction, rejectSuggestionAction } from '@/app/(app)/settings/library-actions'
import { useToast } from '@/hooks/use-toast'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1) return `${h}h ago`
  return `${m}m ago`
}

export default function LibraryReviewTab() {
  const { toast } = useToast()
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState<LibraryEntry | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getPendingSuggestions(createClient())
    if (result.ok) setEntries(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function handleApprove(entry: LibraryEntry) {
    startTransition(async () => {
      const result = await approveSuggestionAction(entry.id)
      if (!result.ok) {
        toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
        return
      }
      setEntries(prev => prev.filter(e => e.id !== entry.id))
      toast({ title: 'Approved', description: `${entry.name} is now live in the global library.` })
    })
  }

  function openReject(entry: LibraryEntry) {
    setRejectTarget(entry)
    setRejectNote('')
  }

  function handleReject() {
    if (!rejectTarget) return
    const target = rejectTarget
    startTransition(async () => {
      const result = await rejectSuggestionAction(target.id, rejectNote)
      if (!result.ok) {
        toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
        return
      }
      setEntries(prev => prev.filter(e => e.id !== target.id))
      setRejectTarget(null)
      toast({ title: 'Rejected', description: `${target.name} has been rejected.` })
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Global Library Review</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Approve or reject medication submissions from pharmacies across the platform.
          </p>
        </div>
        {!loading && entries.length > 0 && (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            <Clock className="mr-1.5 h-3 w-3" />
            {entries.length} pending
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
          <p className="font-medium text-muted-foreground">All caught up</p>
          <p className="text-sm text-muted-foreground">No submissions waiting for review.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drug name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Generic</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Form</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{entry.name}</p>
                    {entry.strength && (
                      <p className="text-xs text-muted-foreground">{entry.strength}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                    {entry.generic_name ?? <span className="text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    {entry.category ? (
                      <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {entry.dosage_form ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(entry.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3 text-xs"
                        onClick={() => handleApprove(entry)}
                        disabled={isPending}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                        onClick={() => openReject(entry)}
                        disabled={isPending}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={v => !v && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {rejectTarget && (
              <p className="text-sm text-muted-foreground">
                Rejecting <span className="font-semibold text-foreground">{rejectTarget.name}</span>.
                The submitting pharmacy will not be notified.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Reason (internal only)</Label>
              <textarea
                rows={3}
                placeholder="e.g. Duplicate entry, insufficient detail, incorrect category…"
                value={rejectNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectNote(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRejectTarget(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleReject}
                disabled={isPending || !rejectNote.trim()}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note about privacy */}
      {entries.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Pharmacy identities are never shown here. Approved entries become immediately searchable by all pharmacies.</p>
        </div>
      )}
    </div>
  )
}
