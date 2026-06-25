'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, BookOpen, CheckCircle2, Plus, ChevronRight,
  ChevronLeft, Loader2, AlertCircle, Sparkles, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  searchLibrary,
  getLibraryCategorySummary,
  type LibraryEntryWithStatus,
  type LibraryCategorySummary,
  type ImportItem,
} from '@medlink/data-client'
import { importFromLibraryAction } from '@/app/(app)/inventory/library-actions'

interface ImportFromLibraryModalProps {
  open: boolean
  onClose: () => void
  onImported: (count: number) => void
  organizationId: string
  branchId: string
  userId: string
  currencyCode: string
  /** When set, the modal opens with this library entry pre-selected (from barcode scan) */
  preselectId?: string | null
}

interface SelectedItem {
  entry: LibraryEntryWithStatus
  sellingPrice: string
  reorderPoint: string
  openingStock: string
}

type Step = 'browse' | 'prices'

export default function ImportFromLibraryModal({
  open, onClose, onImported,
  organizationId, branchId, userId, currencyCode,
  preselectId,
}: ImportFromLibraryModalProps) {
  const [step, setStep]             = useState<Step>('browse')
  const [query, setQuery]           = useState('')
  const [category, setCategory]     = useState<string>('')
  const [entries, setEntries]       = useState<LibraryEntryWithStatus[]>([])
  const [categories, setCategories] = useState<LibraryCategorySummary[]>([])
  const [selected, setSelected]     = useState<SelectedItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [offset, setOffset]         = useState(0)
  const [hasMore, setHasMore]       = useState(false)

  const LIMIT = 40
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEntries = useCallback(async (q: string, cat: string, off: number) => {
    setLoading(true)
    setError(null)
    const result = await searchLibrary(createClient(), {
      query: q, category: cat || undefined, organizationId, limit: LIMIT + 1, offset: off,
    })
    setLoading(false)
    if (!result.ok) { setError(result.error.message); return }
    const data = result.data
    setHasMore(data.length > LIMIT)
    setEntries(off === 0 ? data.slice(0, LIMIT) : prev => [...prev, ...data.slice(0, LIMIT)])
  }, [organizationId])

  const fetchCategories = useCallback(async () => {
    const result = await getLibraryCategorySummary(createClient())
    if (result.ok) setCategories(result.data)
  }, [])

  useEffect(() => {
    if (!open) return
    fetchCategories()
    fetchEntries('', '', 0)
  }, [open, fetchCategories, fetchEntries])

  // When opened from a barcode scan, auto-select the matching entry
  useEffect(() => {
    if (!open || !preselectId) return
    const supabase = createClient()
    void supabase
      .from('medications_library')
      .select('*')
      .eq('id', preselectId)
      .eq('status', 'approved')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const entry = { ...(data as LibraryEntryWithStatus), already_imported: false }
        setSelected([{ entry, sellingPrice: '', reorderPoint: '10', openingStock: '0' }])
        setStep('prices')
      })
  }, [open, preselectId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      fetchEntries(query, category, 0)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category, fetchEntries])

  function handleClose() {
    setStep('browse')
    setQuery('')
    setCategory('')
    setSelected([])
    setOffset(0)
    setError(null)
    onClose()
  }

  function toggleEntry(entry: LibraryEntryWithStatus) {
    if (entry.already_imported) return
    setSelected(prev => {
      const exists = prev.find(s => s.entry.id === entry.id)
      if (exists) return prev.filter(s => s.entry.id !== entry.id)
      return [...prev, { entry, sellingPrice: '', reorderPoint: '10', openingStock: '0' }]
    })
  }

  function isSelected(id: string) {
    return selected.some(s => s.entry.id === id)
  }

  function updatePrice(id: string, field: 'sellingPrice' | 'reorderPoint' | 'openingStock', value: string) {
    setSelected(prev => prev.map(s =>
      s.entry.id === id ? { ...s, [field]: value } : s
    ))
  }

  function removeEntry(id: string) {
    setSelected(prev => prev.filter(s => s.entry.id !== id))
  }

  function canProceed() {
    return selected.length > 0
  }

  function canSave() {
    return selected.every(s => {
      const p = parseFloat(s.sellingPrice)
      return !isNaN(p) && p > 0
    })
  }

  async function handleImport() {
    setSaving(true)
    setError(null)
    const items: ImportItem[] = selected.map(s => ({
      libraryId:    s.entry.id,
      sellingPrice: parseFloat(s.sellingPrice),
      reorderPoint: parseInt(s.reorderPoint, 10) || 10,
      openingStock: Math.max(0, parseInt(s.openingStock, 10) || 0),
    }))

    const result = await importFromLibraryAction({
      organizationId, branchId, userId, currencyCode, items,
    })

    setSaving(false)
    if (!result.ok) { setError(result.error.message); return }

    const { created, errors } = result.data
    if (errors.length > 0) {
      setError(`Partial import: ${errors.join('; ')}`)
    } else {
      onImported(created)
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <DialogTitle>Import from Medication Library</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StepPip active={step === 'browse'} done={step === 'prices'} label="1. Browse" />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <StepPip active={step === 'prices'} done={false} label="2. Set Prices" />
          </div>
        </DialogHeader>

        {step === 'browse' ? (
          <BrowseStep
            query={query} setQuery={setQuery}
            category={category} setCategory={setCategory}
            categories={categories}
            entries={entries}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={() => {
              const next = offset + LIMIT
              setOffset(next)
              fetchEntries(query, category, next)
            }}
            isSelected={isSelected}
            onToggle={toggleEntry}
            selectedCount={selected.length}
            error={error}
          />
        ) : (
          <PricesStep
            selected={selected}
            currencyCode={currencyCode}
            onUpdatePrice={updatePrice}
            onRemove={removeEntry}
            error={error}
            saving={saving}
          />
        )}

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {selected.length > 0
              ? `${selected.length} medication${selected.length !== 1 ? 's' : ''} selected`
              : 'Select medications to import'}
          </div>
          <div className="flex gap-2">
            {step === 'prices' && (
              <Button variant="outline" onClick={() => setStep('browse')} disabled={saving}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
            {step === 'browse' ? (
              <Button onClick={() => setStep('prices')} disabled={!canProceed()}>
                Next: Set Prices
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleImport} disabled={!canSave() || saving}>
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
                  : <><Plus className="h-4 w-4 mr-2" />Import {selected.length} Medication{selected.length !== 1 ? 's' : ''}</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Step pip ──────────────────────────────────────────────────────────────────

function StepPip({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      active ? 'bg-primary text-primary-foreground'
      : done  ? 'bg-[hsl(175_35%_91%)] text-[#004741]'
      : 'text-muted-foreground'
    }`}>
      {label}
    </span>
  )
}

// ── Browse step ───────────────────────────────────────────────────────────────

interface BrowseStepProps {
  query: string; setQuery: (v: string) => void
  category: string; setCategory: (v: string) => void
  categories: LibraryCategorySummary[]
  entries: LibraryEntryWithStatus[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  isSelected: (id: string) => boolean
  onToggle: (e: LibraryEntryWithStatus) => void
  selectedCount: number
  error: string | null
}

function BrowseStep({
  query, setQuery, category, setCategory, categories,
  entries, loading, hasMore, onLoadMore,
  isSelected, onToggle, error,
}: BrowseStepProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-6 py-3 flex gap-2 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, generic, or brand…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category || '__all__'} onValueChange={v => setCategory(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.category} value={c.category}>
                {c.category} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
        {loading && entries.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
          ))
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No medications found</p>
            <p className="text-sm">Try a different search term or category</p>
          </div>
        ) : (
          entries.map(entry => (
            <LibraryRow
              key={entry.id}
              entry={entry}
              selected={isSelected(entry.id)}
              onToggle={() => onToggle(entry)}
            />
          ))
        )}

        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-2 text-sm text-primary hover:underline disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}

function LibraryRow({
  entry, selected, onToggle,
}: {
  entry: LibraryEntryWithStatus
  selected: boolean
  onToggle: () => void
}) {
  const disabled = entry.already_imported
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
        ${disabled
          ? 'opacity-50 cursor-not-allowed bg-muted/30'
          : selected
            ? 'bg-primary/10 border border-primary/30'
            : 'hover:bg-muted/50 border border-transparent'}`}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
        ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
        {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {entry.name}
          {entry.strength && <span className="text-muted-foreground ml-1.5 font-normal">{entry.strength}</span>}
        </div>
        <div className="text-xs text-muted-foreground flex gap-2">
          {entry.dosage_form && <span>{entry.dosage_form}</span>}
          {entry.generic_name && entry.generic_name !== entry.name && <span>· {entry.generic_name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {entry.category && (
          <Badge variant="secondary" className="text-xs">{entry.category}</Badge>
        )}
        {entry.already_imported && (
          <Badge className="text-xs bg-[hsl(175_35%_91%)] text-[#004741] border-0">
            Imported
          </Badge>
        )}
      </div>
    </button>
  )
}

// ── Prices step ───────────────────────────────────────────────────────────────

interface PricesStepProps {
  selected: SelectedItem[]
  currencyCode: string
  onUpdatePrice: (id: string, field: 'sellingPrice' | 'reorderPoint' | 'openingStock', value: string) => void
  onRemove: (id: string) => void
  error: string | null
  saving: boolean
}

function PricesStep({ selected, currencyCode, onUpdatePrice, onRemove, error, saving }: PricesStepProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Set a selling price and opening stock for each medication. Use the trash icon to remove one.
      </p>
      {selected.map(({ entry, sellingPrice, reorderPoint, openingStock }) => {
        const priceInvalid = sellingPrice !== '' && parseFloat(sellingPrice) <= 0
        return (
          <div key={entry.id} className="border border-border rounded-lg p-4 space-y-3">
            {/* Header row: name + unit badge + remove button */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {entry.name}
                  {entry.strength && (
                    <span className="text-muted-foreground ml-1.5 font-normal">{entry.strength}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  {entry.dosage_form && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{entry.dosage_form}</Badge>
                  )}
                  {entry.generic_name && entry.generic_name !== entry.name && (
                    <span>{entry.generic_name}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                disabled={saving}
                title="Remove"
                className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Fields — selling price spans full width, qty fields sit side-by-side below */}
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Selling price ({currencyCode}) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={e => onUpdatePrice(entry.id, 'sellingPrice', e.target.value)}
                  disabled={saving}
                  className={priceInvalid
                    ? 'border-destructive/60 focus-visible:ring-destructive/40' : ''}
                />
                {/* fixed-height slot so the row below never shifts */}
                <p className={`text-xs text-destructive transition-opacity ${priceInvalid ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  Must be greater than 0
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Opening stock (qty)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={openingStock}
                    onChange={e => onUpdatePrice(entry.id, 'openingStock', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reorder point (qty)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="10"
                    value={reorderPoint}
                    onChange={e => onUpdatePrice(entry.id, 'reorderPoint', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
