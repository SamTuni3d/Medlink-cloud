'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import {
  Search, Plus, BookOpen, Package, Edit2, ToggleLeft,
  ToggleRight, Loader2, Pill, Trash2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { getMedications } from '@medlink/data-client'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Medication } from '@medlink/data-client'
import ImportFromLibraryModal from '@/components/inventory/ImportFromLibraryModal'
import { addCustomMedicationAction, updateMedicationAction, deleteMedicationAction } from './actions'
import { useToast } from '@/hooks/use-toast'

const CATEGORIES = [
  'Analgesics', 'Antibiotics', 'Antifungals', 'Antihistamines',
  'Antimalarials', 'Cardiovascular', 'Dermatology', 'Gastrointestinal',
  'General', 'IV Fluids', 'Medical Supplies', 'Ophthalmology',
  'Respiratory', 'Topicals', 'Vitamins & Supplements', 'Other',
]

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection',
  'Cream', 'Ointment', 'Drops', 'Inhaler', 'Suppository',
  'Patch', 'Powder', 'Gel', 'Solution', 'Other',
]

const UNITS = ['tablets', 'capsules', 'ml', 'mg', 'g', 'units', 'vials', 'sachets', 'pcs']

// ── Edit price dialog ─────────────────────────────────────────────────────────

function EditPriceDialog({
  medication,
  open,
  onClose,
  onSaved,
}: {
  medication: Medication
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [price, setPrice] = useState(String(medication.selling_price))
  const [reorderPoint, setReorderPoint] = useState(String(medication.reorder_point))
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setPrice(String(medication.selling_price))
      setReorderPoint(String(medication.reorder_point))
    }
  }, [open, medication])

  function handleSave() {
    startTransition(async () => {
      const result = await updateMedicationAction({
        id: medication.id,
        sellingPrice: parseFloat(price),
        reorderPoint: parseInt(reorderPoint, 10),
      })
      if (!result.ok) {
        toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Saved', description: `${medication.name} updated.` })
      onSaved()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit — {medication.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Selling Price (GH₵)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reorder Point (units)</Label>
            <Input
              type="number"
              min="0"
              value={reorderPoint}
              onChange={e => setReorderPoint(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Alert when stock drops below this number</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add custom medication dialog ──────────────────────────────────────────────

function AddCustomDialog({
  open,
  onClose,
  onAdded,
  organizationId,
  currencyCode,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
  organizationId: string
  currencyCode: string
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '', genericName: '', category: '', dosageForm: 'Tablet',
    strength: '', unitOfMeasure: 'tablets', sellingPrice: '',
    requiresPrescription: false, reorderPoint: '0',
  })

  function update(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleAdd() {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const result = await addCustomMedicationAction({
        organizationId,
        name: form.name.trim(),
        genericName: form.genericName.trim() || undefined,
        category: form.category || undefined,
        dosageForm: form.dosageForm,
        strength: form.strength.trim() || undefined,
        unitOfMeasure: form.unitOfMeasure,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        currencyCode,
        requiresPrescription: form.requiresPrescription,
        reorderPoint: parseInt(form.reorderPoint, 10) || 0,
        reorderQuantity: 1,
      })
      if (!result.ok) {
        toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Medication added', description: form.name })
      setForm({ name: '', genericName: '', category: '', dosageForm: 'Tablet', strength: '', unitOfMeasure: 'tablets', sellingPrice: '', requiresPrescription: false, reorderPoint: '0' })
      onAdded()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Custom Medication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Brand / Trade Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Panadol Extra"
                value={form.name}
                onChange={e => update('name', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Generic Name</Label>
              <Input
                placeholder="e.g. Paracetamol + Caffeine"
                value={form.genericName}
                onChange={e => update('genericName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dosage Form <span className="text-destructive">*</span></Label>
              <Select value={form.dosageForm} onValueChange={v => update('dosageForm', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOSAGE_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Strength</Label>
              <Input
                placeholder="e.g. 500mg"
                value={form.strength}
                onChange={e => update('strength', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => update('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit of Measure <span className="text-destructive">*</span></Label>
              <Select value={form.unitOfMeasure} onValueChange={v => update('unitOfMeasure', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Selling Price (GH₵)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.sellingPrice}
                onChange={e => update('sellingPrice', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reorder Point</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.reorderPoint}
                onChange={e => update('reorderPoint', e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiresPrescription}
              onChange={e => update('requiresPrescription', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Requires prescription</span>
          </label>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleAdd} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Medication
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MedicationsPage() {
  const { organizationId, user } = useAuth()
  const { activeBranch, loading: branchLoading } = useBranch()
  const { toast } = useToast()

  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Medication | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    const result = await getMedications(createClient(), organizationId, {
      activeOnly: !showInactive,
    })
    if (result.ok) setMedications(result.data)
    setLoading(false)
  }, [organizationId, showInactive])

  async function handleDelete(med: Medication) {
    setDeletingId(med.id)
    const result = await deleteMedicationAction(med.id)
    setDeletingId(null)
    setConfirmDelete(null)
    if (!result.ok) {
      toast({ title: 'Could not remove', description: result.error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Removed', description: `${med.name} has been removed from your catalog.` })
    void load()
  }

  function handleImportClick() {
    if (branchLoading) return
    if (!activeBranch) {
      toast({ title: 'No branch found', description: 'Go to Settings → Branches to create your first branch, then come back here.', variant: 'destructive' })
      return
    }
    setShowLibrary(true)
  }

  useEffect(() => { void load() }, [load])

  async function toggleActive(med: Medication) {
    setTogglingId(med.id)
    const result = await updateMedicationAction({ id: med.id, isActive: !med.is_active })
    setTogglingId(null)
    if (!result.ok) {
      toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
      return
    }
    toast({ title: med.is_active ? 'Deactivated' : 'Reactivated', description: med.name })
    void load()
  }

  const filtered = medications.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      (m.generic_name ?? '').toLowerCase().includes(q) ||
      (m.strength ?? '').toLowerCase().includes(q)
    const matchCat = categoryFilter === 'all' || m.category === categoryFilter
    return matchSearch && matchCat
  })

  const activeCount   = medications.filter(m => m.is_active).length
  const inactiveCount = medications.filter(m => !m.is_active).length

  const currencyCode = activeBranch ? 'GHS' : 'GHS'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? 'Loading your catalog…'
              : !organizationId
              ? 'Preparing…'
              : `${activeCount} active medication${activeCount !== 1 ? 's' : ''} in your catalog${inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleImportClick} disabled={branchLoading}>
            <BookOpen className="mr-2 h-4 w-4" />
            Import from Library
          </Button>
          <Button onClick={() => setShowCustom(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Custom
          </Button>
        </div>
      </div>

      {/* Empty state for new pharmacies */}
      {!loading && medications.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 py-20 text-center">
          <Pill className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No medications yet</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Build your catalog by importing from the MedLink library of 645+ Ghanaian medications, or add your own custom ones.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={handleImportClick} disabled={branchLoading}>
              <BookOpen className="mr-2 h-4 w-4" />
              Browse Library (645+ medications)
            </Button>
            <Button variant="outline" onClick={() => setShowCustom(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Medication
            </Button>
          </div>
        </div>
      )}

      {/* Filters — only show when there are medications */}
      {medications.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, generic name or strength…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            Show inactive
          </label>
        </div>
      )}

      {/* Table */}
      {medications.length > 0 && (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Package className="h-10 w-10" />
              <p className="text-sm font-medium">No medications match your search</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Form / Strength</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Category</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Reorder</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(med => (
                    <tr key={med.id} className={`hover:bg-muted/20 transition-colors ${!med.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{med.name}</p>
                        {med.generic_name && (
                          <p className="text-xs text-muted-foreground">{med.generic_name}</p>
                        )}
                        {med.requires_prescription && (
                          <Badge variant="secondary" className="mt-0.5 text-[10px] px-1.5 py-0">Rx</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                        {med.dosage_form}
                        {med.strength && <span className="ml-1 text-xs">{med.strength}</span>}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {med.category ? (
                          <Badge variant="outline" className="text-xs">{med.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground">
                        {med.selling_price > 0
                          ? formatCurrency(med.selling_price, med.currency_code)
                          : <span className="text-muted-foreground font-normal text-xs">Not set</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground hidden sm:table-cell">
                        {med.reorder_point > 0 ? med.reorder_point : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge
                          variant={med.is_active ? 'secondary' : 'outline'}
                          className={med.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'text-muted-foreground'}
                        >
                          {med.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit price"
                            onClick={() => setEditing(med)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={med.is_active ? 'Deactivate' : 'Reactivate'}
                            onClick={() => void toggleActive(med)}
                            disabled={togglingId === med.id}
                          >
                            {togglingId === med.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : med.is_active
                                ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
                                : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                            title="Remove from catalog"
                            onClick={() => setConfirmDelete(med)}
                            disabled={deletingId === med.id}
                          >
                            {deletingId === med.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Import from Library modal — only mounts when org+branch are ready */}
      {organizationId && activeBranch && (
        <ImportFromLibraryModal
          open={showLibrary}
          onClose={() => setShowLibrary(false)}
          onImported={count => {
            toast({ title: `${count} medication${count !== 1 ? 's' : ''} added to your catalog` })
            void load()
          }}
          organizationId={organizationId}
          branchId={activeBranch.id}
          userId={user?.id ?? ''}
          currencyCode="GHS"
        />
      )}

      {/* Add custom modal */}
      <AddCustomDialog
        open={showCustom && !!organizationId}
        onClose={() => setShowCustom(false)}
        onAdded={() => void load()}
        organizationId={organizationId ?? ''}
        currencyCode="GHS"
      />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <Dialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Remove medication?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{confirmDelete.name}</span> will be permanently removed from your catalog. This cannot be undone.
              </p>
              <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                If this medication has existing sales or stock records, consider <strong>deactivating</strong> it instead using the toggle button — that hides it without deleting history.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)} disabled={!!deletingId}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => void handleDelete(confirmDelete)}
                  disabled={!!deletingId}
                >
                  {deletingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Remove
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit price modal */}
      {editing && (
        <EditPriceDialog
          medication={editing}
          open={!!editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
