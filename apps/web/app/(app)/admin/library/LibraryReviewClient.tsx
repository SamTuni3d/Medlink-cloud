'use client'

import { useState } from 'react'
import {
  BookOpen, CheckCircle2, XCircle, Clock, Loader2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { approveSuggestionAction, rejectSuggestionAction } from '@/app/(app)/inventory/library-actions'
import type { LibraryEntry } from '@medlink/data-client'

interface Props {
  userId: string
  initialSuggestions: LibraryEntry[]
}

export default function LibraryReviewClient({ userId, initialSuggestions }: Props) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [rejectModal, setRejectModal] = useState<LibraryEntry | null>(null)
  const [rejectNote, setRejectNote]   = useState('')
  const [busyId, setBusyId]           = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const { toast } = useToast()

  async function approve(entry: LibraryEntry) {
    setBusyId(entry.id)
    const result = await approveSuggestionAction({ libraryId: entry.id, reviewerId: userId })
    setBusyId(null)
    if (!result.ok) {
      toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
      return
    }
    setSuggestions(prev => prev.filter(s => s.id !== entry.id))
    toast({ title: 'Approved', description: `${entry.name} is now in the library.` })
  }

  async function openReject(entry: LibraryEntry) {
    setRejectModal(entry)
    setRejectNote('')
  }

  async function confirmReject() {
    if (!rejectModal) return
    setSaving(true)
    const result = await rejectSuggestionAction({
      libraryId: rejectModal.id,
      reviewerId: userId,
      note: rejectNote,
    })
    setSaving(false)
    if (!result.ok) {
      toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
      return
    }
    setSuggestions(prev => prev.filter(s => s.id !== rejectModal.id))
    setRejectModal(null)
    toast({ title: 'Rejected', description: `${rejectModal.name} has been rejected.` })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Medication Library — Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject medications suggested by pharmacies.
          </p>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mb-4 text-primary opacity-60" />
          <p className="font-medium text-lg">All caught up!</p>
          <p className="text-sm">No pending suggestions to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            {suggestions.length} pending suggestion{suggestions.length !== 1 ? 's' : ''}
          </p>
          {suggestions.map(entry => (
            <div key={entry.id} className="border border-border rounded-xl p-4 flex items-start gap-4">
              <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{entry.name}</div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3">
                  {entry.generic_name && <span>Generic: {entry.generic_name}</span>}
                  {entry.dosage_form  && <span>Form: {entry.dosage_form}</span>}
                  {entry.strength     && <span>Strength: {entry.strength}</span>}
                  {entry.category     && <Badge variant="secondary" className="text-xs">{entry.category}</Badge>}
                </div>
                {entry.nafdac_number && (
                  <div className="text-xs text-muted-foreground mt-1">NAFDAC: {entry.nafdac_number}</div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[#004741] border-[hsl(175_35%_75%)] hover:bg-[hsl(175_35%_96%)]"
                  onClick={() => approve(entry)}
                  disabled={busyId === entry.id}
                >
                  {busyId === entry.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><CheckCircle2 className="h-4 w-4 mr-1" />Approve</>}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => openReject(entry)}
                  disabled={busyId === entry.id}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectModal} onOpenChange={v => { if (!v) setRejectModal(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Reject Suggestion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting <strong>{rejectModal?.name}</strong>. Provide a reason so the pharmacy knows what to fix.
            </p>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 resize-none"
              placeholder="e.g. Duplicate of Amoxicillin 500mg Capsule already in library…"
              value={rejectNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectNote(e.target.value)}
              rows={3}
              disabled={saving}
            />
            {rejectNote.trim() === '' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                A reason is required
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectNote.trim() || saving}
              onClick={confirmReject}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rejecting…</> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
