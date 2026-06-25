'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Package, Search, RefreshCw, AlertTriangle, Clock,
  PackagePlus, PackageSearch, X, Tag, BookOpen, Pencil, Trash2, Scan,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getInventory } from '@medlink/data-client'
import { formatCurrency } from '@/lib/formatCurrency'
import { StaggerGrid, StaggerItem, HoverCard, SlideInRow } from '@/components/ui/motion-primitives'
import type { InventoryWithBatches } from '@medlink/data-client'
import {
  addMedicationAction,
  ensureBranchInventoryAction,
  updateMedicationDetailsAction,
  adjustStockAction,
  deactivateMedicationAction,
} from './actions'
import { seedMedicationsCache, seedInventoryCache } from '@/lib/sync/syncQueue'
import { db } from '@/lib/dexie/db'
import ImportFromLibraryModal from '@/components/inventory/ImportFromLibraryModal'
import BarcodeScanModal from '@/components/inventory/BarcodeScanModal'
import type { BarcodeLookupResult } from './actions'

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring'

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Injection', 'Syrup', 'Drops', 'Cream',
  'Ointment', 'Gel', 'Sachet', 'Solution', 'Powder', 'Suspension',
  'Inhaler', 'IV Fluid', 'Lotion', 'Syringe', 'Spray', 'Suppository',
  'Patch', 'Other',
]

const CATEGORIES = [
  'Analgesics', 'Antibiotics', 'Antihistamines', 'Antimalarials',
  'Antifungals', 'Cardiovascular', 'Contraceptives', 'Dermatology',
  'Diabetes', 'Gastrointestinal', 'General', 'IV Fluids',
  'Medical Supplies', 'Neurology/Psychiatry', 'Ophthalmology',
  'Paediatrics', 'Respiratory', 'Vitamins & Supplements',
]

const EMPTY_FORM = {
  name: '',
  genericName: '',
  brandName: '',
  category: '',
  strength: '',
  dosageForm: '',
  batchNumber: '',
  expiryDate: '',
  purchasePrice: '0',
  sellingPrice: '0',
  qtyInStock: '0',
  reorderLevel: '10',
  barcode: '',
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, icon: Icon, accent, loading,
}: {
  label: string
  value: string
  icon: typeof Package
  accent?: 'amber' | 'red'
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-5 w-5 ${
          accent === 'amber' ? 'text-amber-400' :
          accent === 'red'   ? 'text-red-400' :
          'text-muted-foreground/30'
        }`} />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-28" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      )}
    </div>
  )
}

// ── Add Medication Modal ──────────────────────────────────────────────────────
function AddMedicationModal({
  open,
  onClose,
  onAdded,
  organizationId,
  branchId,
  userId,
  currency,
  initialBarcode,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
  organizationId: string
  branchId: string
  userId: string
  currency: string
  initialBarcode?: string
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    barcode: initialBarcode ?? '',
  }))

  useEffect(() => {
    if (open) setForm({ ...EMPTY_FORM, barcode: initialBarcode ?? '' })
  }, [open, initialBarcode])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { toast } = useToast()

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Product name is required'); return }
    setFormError(null)
    setSaving(true)

    const result = await addMedicationAction({
      organizationId,
      branchId,
      performedBy: userId,
      name: form.name.trim(),
      genericName: form.genericName.trim() || null,
      brandName: form.brandName.trim() || null,
      category: form.category || null,
      strength: form.strength.trim() || null,
      dosageForm: form.dosageForm || null,
      barcode: form.barcode.trim() || null,
      reorderPoint: Math.max(0, parseInt(form.reorderLevel) || 10),
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      currencyCode: currency,
      batchNumber: form.batchNumber.trim() || null,
      expiryDate: form.expiryDate || null,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      qtyInStock: Math.max(0, parseInt(form.qtyInStock) || 0),
    })

    setSaving(false)

    if (!result.ok) {
      setFormError(result.error.message)
      return
    }

    // Sync Dexie so the POS shows the new medication and price immediately
    const supabase = createClient()
    void Promise.all([
      seedMedicationsCache(supabase, organizationId),
      seedInventoryCache(supabase, branchId),
    ])

    toast({ title: 'Medication added', description: `${form.name.trim()} was added to inventory.` })
    setForm(EMPTY_FORM)
    onAdded()
    onClose()
  }

  function handleClose() {
    if (saving) return
    setForm(EMPTY_FORM)
    setFormError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Medication</DialogTitle>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-sm p-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <form onSubmit={e => { void handleSubmit(e) }} className="space-y-4 pt-2">
          {/* Row 1: Name + Generic */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-name">Product Name <span className="text-destructive">*</span></Label>
              <Input
                id="med-name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Paracetamol 500mg"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-generic">Generic Name</Label>
              <Input
                id="med-generic"
                value={form.genericName}
                onChange={e => set('genericName', e.target.value)}
                placeholder="e.g. Acetaminophen"
              />
            </div>
          </div>

          {/* Row 2: Brand + Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-brand">Brand Name</Label>
              <Input
                id="med-brand"
                value={form.brandName}
                onChange={e => set('brandName', e.target.value)}
                placeholder="e.g. Panadol"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Strength + Dosage form */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-strength">Strength</Label>
              <Input
                id="med-strength"
                value={form.strength}
                onChange={e => set('strength', e.target.value)}
                placeholder="e.g. 500mg"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dosage Form</Label>
              <Select value={form.dosageForm} onValueChange={v => set('dosageForm', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {DOSAGE_FORMS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Batch + Expiry */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-batch">Batch Number</Label>
              <Input
                id="med-batch"
                value={form.batchNumber}
                onChange={e => set('batchNumber', e.target.value)}
                placeholder="e.g. BT-2025-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-expiry">Expiry Date</Label>
              <Input
                id="med-expiry"
                type="date"
                value={form.expiryDate}
                onChange={e => set('expiryDate', e.target.value)}
              />
            </div>
          </div>

          {/* Row 5: Purchase + Selling price */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-cost">Purchase Price ({currency === 'GHS' ? '₵' : currency})</Label>
              <Input
                id="med-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={e => set('purchasePrice', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-sell">Selling Price ({currency === 'GHS' ? '₵' : currency})</Label>
              <Input
                id="med-sell"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={e => set('sellingPrice', e.target.value)}
              />
            </div>
          </div>

          {/* Row 6: Qty + Reorder */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-qty">Qty in Stock</Label>
              <Input
                id="med-qty"
                type="number"
                min="0"
                value={form.qtyInStock}
                onChange={e => set('qtyInStock', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-reorder">Reorder Level</Label>
              <Input
                id="med-reorder"
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={e => set('reorderLevel', e.target.value)}
              />
            </div>
          </div>

          {/* Row 7: Barcode */}
          <div className="space-y-1.5">
            <Label htmlFor="med-barcode">Barcode (optional)</Label>
            <Input
              id="med-barcode"
              value={form.barcode}
              onChange={e => set('barcode', e.target.value)}
              placeholder="Scan or enter barcode"
            />
          </div>

          {formError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add Medication'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Medication Modal ─────────────────────────────────────────────────────
function EditMedicationModal({
  open, onClose, onSaved,
  row, currency,
  organizationId, branchId, userId,
}: {
  open: boolean
  onClose: () => void
  onSaved: (medicationId: string, updates: { sellingPrice?: number; newStock?: number; reorderPoint?: number }) => void
  row: InventoryWithBatches
  currency: string
  organizationId: string
  branchId: string
  userId: string
}) {
  const [price, setPrice]        = useState(String(row.selling_price))
  const [newQty, setNewQty]      = useState(String(row.available_stock))
  const [reorder, setReorder]    = useState(String(row.reorder_point))
  const [saving, setSaving]      = useState(false)
  const [error, setError]        = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setPrice(String(row.selling_price))
      setNewQty(String(row.available_stock))
      setReorder(String(row.reorder_point))
      setError(null)
    }
  }, [open, row])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedPrice   = parseFloat(price)
    const parsedQty     = parseInt(newQty, 10)
    const parsedReorder = parseInt(reorder, 10)

    if (isNaN(parsedPrice) || parsedPrice < 0) { setError('Enter a valid selling price'); return }
    if (isNaN(parsedQty)   || parsedQty < 0)   { setError('Quantity must be 0 or more'); return }
    if (isNaN(parsedReorder) || parsedReorder < 0) { setError('Reorder point must be 0 or more'); return }

    setError(null)
    setSaving(true)

    const delta = parsedQty - row.available_stock
    const priceChanged   = parsedPrice   !== row.selling_price
    const reorderChanged = parsedReorder !== row.reorder_point

    const actions: Promise<{ ok: boolean; error?: { message: string } }>[] = []

    if (priceChanged || reorderChanged) {
      actions.push(updateMedicationDetailsAction({
        medicationId: row.medication_id,
        sellingPrice: parsedPrice,
        reorderPoint: parsedReorder,
      }))
    }

    if (delta !== 0) {
      actions.push(adjustStockAction({
        medicationId:   row.medication_id,
        branchId,
        organizationId,
        performedBy:    userId,
        delta,
        notes:          'Manual stock adjustment from inventory',
      }))
    }

    const results = await Promise.all(actions)
    setSaving(false)

    const failed = results.find(r => !r.ok)
    if (failed && !failed.ok && failed.error) { setError(failed.error.message); return }

    toast({ title: 'Medication updated', description: row.medication_name })
    onSaved(row.medication_id, {
      sellingPrice: parsedPrice,
      newStock:     parsedQty,
      reorderPoint: parsedReorder,
    })
    onClose()
  }

  const delta = parseInt(newQty, 10) - row.available_stock

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit Medication</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1 truncate">{row.medication_name}</p>

        <form onSubmit={e => { void handleSubmit(e) }} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="em-price">Selling Price ({currency === 'GHS' ? '₵' : currency})</Label>
            <Input
              id="em-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="em-qty">
              Stock Quantity
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                Current: {row.available_stock}
              </span>
            </Label>
            <Input
              id="em-qty"
              type="number"
              min="0"
              step="1"
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
            />
            {!isNaN(delta) && delta !== 0 && (
              <p className={`text-xs ${delta > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {delta > 0 ? `+${delta} units will be added` : `${Math.abs(delta)} units will be removed`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="em-reorder">Reorder Point (qty)</Label>
            <Input
              id="em-reorder"
              type="number"
              min="0"
              step="1"
              value={reorder}
              onChange={e => setReorder(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Confirm Deactivate Dialog ─────────────────────────────────────────────────
function ConfirmDeactivateDialog({
  open, onClose, onConfirmed,
  medicationName,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: () => void
  medicationName: string
}) {
  const [removing, setRemoving] = useState(false)

  async function handleConfirm() {
    setRemoving(true)
    await onConfirmed()
    setRemoving(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !removing) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Remove Medication?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{medicationName}</span> will be hidden from
          your inventory and POS. Stock history is kept. You can re-add it later.
        </p>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={removing}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => { void handleConfirm() }}
            disabled={removing}
          >
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { activeBranch } = useBranch()
  const { user, organizationId } = useAuth()
  const [rows, setRows] = useState<InventoryWithBatches[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [showAddModal, setShowAddModal]         = useState(false)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [showScanModal, setShowScanModal]       = useState(false)
  const [editMed, setEditMed]     = useState<InventoryWithBatches | null>(null)
  const [deactivateMed, setDeactivateMed] = useState<InventoryWithBatches | null>(null)
  // When a barcode scan finds a library entry, pre-open ImportFromLibraryModal at that entry
  const [preselectLibraryId, setPreselectLibraryId] = useState<string | null>(null)
  // When a scan finds nothing, pre-fill the Add modal with the barcode
  const [prescannedBarcode, setPrescannedBarcode] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeBranch || !organizationId) { setLoading(false); return }
    setLoading(true); setError(null)
    // Backfill any inventory rows that were missed by earlier imports (idempotent)
    await ensureBranchInventoryAction(organizationId, activeBranch.id)
    const result = await getInventory(createClient(), activeBranch.id)
    if (result.ok) setRows(result.data)
    else setError(result.error.message)
    setLoading(false)
  }, [activeBranch, organizationId])

  useEffect(() => { void load() }, [load])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const r of rows) if (r.category) cats.add(r.category)
    return Array.from(cats).sort()
  }, [rows])

  const filtered = useMemo(() => rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || r.medication_name.toLowerCase().includes(q)
      || (r.generic_name ?? '').toLowerCase().includes(q)
      || (r.barcode ?? '').toLowerCase().includes(q)
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter
    const matchStock =
      stockFilter === 'all'         ? true :
      stockFilter === 'in_stock'    ? r.available_stock > r.reorder_point :
      stockFilter === 'low_stock'   ? (r.available_stock > 0 && r.available_stock <= r.reorder_point) :
      stockFilter === 'out_of_stock'? r.available_stock === 0 :
      stockFilter === 'expiring'    ? (r.days_to_nearest_expiry !== null && r.days_to_nearest_expiry > 0 && r.days_to_nearest_expiry <= 90) :
      true
    return matchSearch && matchCat && matchStock
  }), [rows, search, categoryFilter, stockFilter])

  const totalProducts     = rows.length
  const totalValue        = rows.reduce((sum, r) => sum + r.available_stock * r.selling_price, 0)
  const lowStockCount     = rows.filter(r => r.available_stock <= r.reorder_point).length
  const expiringSoonCount = rows.filter(
    r => r.days_to_nearest_expiry !== null && r.days_to_nearest_expiry > 0 && r.days_to_nearest_expiry <= 90
  ).length
  const currency = rows[0]?.currency_code ?? 'GHS'

  function handleBarcodeResult(barcode: string, result: BarcodeLookupResult) {
    if (result.foundIn === 'master') {
      // Already in this org's inventory — find and open edit modal
      const found = rows.find(r => r.medication_id === result.medicationId)
      if (found) setEditMed(found)
    } else if (result.foundIn === 'library') {
      // In global library — open import modal pre-selected at this entry
      setPreselectLibraryId(result.libraryId)
      setShowLibraryModal(true)
    } else {
      // Not found anywhere — open Add modal with barcode pre-filled
      setPrescannedBarcode(barcode)
      setShowAddModal(true)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your medication stock</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowScanModal(true)} disabled={!activeBranch}>
            <Scan className="mr-2 h-4 w-4" />
            Scan
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowLibraryModal(true)} disabled={!activeBranch}>
            <BookOpen className="mr-2 h-4 w-4" />
            Import from Library
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)} disabled={!activeBranch}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Medication
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No branch selected</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create a branch first, then come back to add medications.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: '#004741' }}
          >
            Go to Settings → Branches
          </a>
        </div>
      )}

      {/* Summary cards */}
      <StaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Products',  value: String(totalProducts),                    icon: Package },
          { label: 'Total Value',     value: formatCurrency(totalValue, currency),      icon: Package },
          { label: 'Low Stock',       value: String(lowStockCount),    icon: AlertTriangle, accent: lowStockCount > 0     ? 'amber' as const : undefined },
          { label: 'Expiring Soon',   value: String(expiringSoonCount),icon: Clock,         accent: expiringSoonCount > 0 ? 'amber' as const : undefined },
        ].map(card => (
          <StaggerItem key={card.label}>
            <HoverCard className="h-full">
              <SummaryCard {...card} loading={loading} />
            </HoverCard>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, generic, brand, barcode…"
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={v => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            <SelectItem value="expiring">Expiring Soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          /* ── True empty inventory — show the 3 ways to add ── */
          <div className="p-8 space-y-6">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/25 mb-3" />
              <p className="font-semibold text-foreground">Your inventory is empty</p>
              <p className="text-sm text-muted-foreground mt-1">Add medications using one of the options below</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                onClick={() => setShowLibraryModal(true)}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="rounded-xl bg-primary/10 p-3">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Browse Library</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Import from 260+ medications</p>
                </div>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="rounded-xl bg-primary/10 p-3">
                  <PackagePlus className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Add Manually</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter medication details</p>
                </div>
              </button>
              <button
                onClick={() => setShowScanModal(true)}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="rounded-xl bg-primary/10 p-3">
                  <Scan className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Scan Barcode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">USB scanner or camera</p>
                </div>
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <PackageSearch className="h-10 w-10" />
            <p className="text-sm font-medium">No items match your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Category</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Strength / Form</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Batch / Expiry</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stock</th>
                  <th className="hidden px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Selling</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((row) => {
                  const isLowStock = row.available_stock <= row.reorder_point
                  const isOut      = row.available_stock === 0
                  const isExpiring = row.days_to_nearest_expiry !== null
                    && row.days_to_nearest_expiry > 0
                    && row.days_to_nearest_expiry <= 90

                  return (
                    <SlideInRow key={row.inventory_id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-foreground">{row.medication_name}</p>
                        {row.generic_name && (
                          <p className="text-xs text-primary/70 mt-0.5">{row.generic_name}</p>
                        )}
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        {row.category ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {row.category}
                          </span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        {row.strength && (
                          <p className="text-xs font-medium text-foreground">{row.strength}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{row.dosage_form}</p>
                      </td>
                      <td className="hidden px-5 py-4 xl:table-cell">
                        {row.nearest_expiry_date ? (
                          <>
                            <p className="text-xs font-medium text-muted-foreground">
                              {new Date(row.nearest_expiry_date).toLocaleDateString('en-GH', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </p>
                            {isExpiring && (
                              <p className="text-[10px] text-orange-500 mt-0.5">{row.days_to_nearest_expiry}d left</p>
                            )}
                          </>
                        ) : <span className="text-muted-foreground/50 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <p className={`font-semibold text-base ${
                          isOut      ? 'text-red-600' :
                          isLowStock ? 'text-amber-600' :
                          'text-foreground'
                        }`}>
                          {row.available_stock}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold mt-0.5 ${
                          isOut
                            ? 'bg-red-100 text-red-700'
                            : isLowStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'text-[#004741]'
                        }`} style={!isOut && !isLowStock ? { background: 'hsl(175 35% 91%)' } : {}}>
                          {isOut ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 text-right lg:table-cell">
                        <button
                          onClick={() => setEditMed(row)}
                          className="group flex items-center justify-end gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                          title="Edit medication"
                        >
                          {formatCurrency(row.selling_price, row.currency_code)}
                          <Tag className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditMed(row)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                            title="Edit medication"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeactivateMed(row)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Remove medication"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </SlideInRow>
                  )
                })}
              </tbody>
            </table>
            <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
              Showing {filtered.length} of {rows.length} products
            </div>
          </div>
        )}
      </div>

      {/* Barcode Scan Modal */}
      {activeBranch && organizationId && (
        <BarcodeScanModal
          open={showScanModal}
          onClose={() => setShowScanModal(false)}
          organizationId={organizationId}
          onResult={handleBarcodeResult}
        />
      )}

      {/* Import from Library Modal */}
      {activeBranch && organizationId && user && (
        <ImportFromLibraryModal
          open={showLibraryModal}
          onClose={() => { setShowLibraryModal(false); setPreselectLibraryId(null) }}
          preselectId={preselectLibraryId}
          onImported={() => {
            void load()
            setShowLibraryModal(false)
            // Sync Dexie so POS reflects imported medications immediately
            const supabase = createClient()
            void Promise.all([
              seedMedicationsCache(supabase, organizationId),
              seedInventoryCache(supabase, activeBranch.id),
            ])
          }}
          organizationId={organizationId}
          branchId={activeBranch.id}
          userId={user.id}
          currencyCode={currency}
        />
      )}

      {/* Add Medication Modal */}
      {activeBranch && organizationId && user && (
        <AddMedicationModal
          open={showAddModal}
          onClose={() => { setShowAddModal(false); setPrescannedBarcode(null) }}
          onAdded={() => void load()}
          organizationId={organizationId}
          branchId={activeBranch.id}
          userId={user.id}
          currency={currency}
          initialBarcode={prescannedBarcode ?? undefined}
        />
      )}

      {/* Edit Medication Modal */}
      {editMed && activeBranch && organizationId && user && (
        <EditMedicationModal
          open={!!editMed}
          onClose={() => setEditMed(null)}
          onSaved={(id, updates) => {
            setRows(prev => prev.map(r => {
              if (r.medication_id !== id) return r
              return {
                ...r,
                selling_price:   updates.sellingPrice  ?? r.selling_price,
                available_stock: updates.newStock       ?? r.available_stock,
                reorder_point:   updates.reorderPoint   ?? r.reorder_point,
              }
            }))
            setEditMed(null)
            if (updates.sellingPrice !== undefined) {
              void db.medications_cache.update(id, { selling_price: updates.sellingPrice })
            }
            if (updates.newStock !== undefined) {
              const supabase = createClient()
              void seedInventoryCache(supabase, activeBranch.id)
            }
          }}
          row={editMed}
          currency={currency}
          organizationId={organizationId}
          branchId={activeBranch.id}
          userId={user.id}
        />
      )}

      {/* Confirm Deactivate Dialog */}
      {deactivateMed && (
        <ConfirmDeactivateDialog
          open={!!deactivateMed}
          onClose={() => setDeactivateMed(null)}
          onConfirmed={async () => {
            const result = await deactivateMedicationAction(deactivateMed.medication_id)
            if (result.ok) {
              setRows(prev => prev.filter(r => r.medication_id !== deactivateMed.medication_id))
              // Remove from Dexie so POS no longer shows it
              void db.medications_cache.delete(deactivateMed.medication_id)
            }
            setDeactivateMed(null)
          }}
          medicationName={deactivateMed.medication_name}
        />
      )}
    </div>
  )
}
