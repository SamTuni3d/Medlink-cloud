'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Truck, Plus, RefreshCw, Building2, PackageCheck,
  Clock, CheckCircle2, XCircle, X, Search, Pencil, Trash2,
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
import {
  getSuppliers, createSupplier, updateSupplier, softDeleteSupplier,
  getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder,
  cancelPurchaseOrder, getPurchaseOrderItems, getMedications,
} from '@medlink/data-client'
import type {
  Supplier, SupplierInsert, PurchaseOrder, PurchaseOrderItem,
  Medication, POStatus,
} from '@medlink/data-client'

type Tab = 'purchase_orders' | 'suppliers'

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<POStatus, { label: string; className: string; Icon: typeof Clock }> = {
  draft:      { label: 'Draft',     className: 'bg-muted text-muted-foreground',           Icon: Clock },
  ordered:    { label: 'Ordered',   className: 'bg-blue-100 text-blue-700',               Icon: Truck },
  partial:    { label: 'Partial',   className: 'bg-amber-100 text-amber-700',             Icon: PackageCheck },
  received:   { label: 'Received',  className: 'bg-[hsl(175_35%_91%)] text-[#004741]',   Icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled', className: 'bg-red-100 text-red-600',                 Icon: XCircle },
}

function StatusBadge({ status }: { status: POStatus }) {
  const { label, className, Icon } = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ── Create PO modal ───────────────────────────────────────────────────────────

interface POLineItem {
  medicationId: string
  quantityOrdered: string
  unitCost: string
  batchNumber: string
  expiryDate: string
}

function CreatePOModal({
  open, onClose, onCreated, suppliers, medications, currency,
  organizationId, branchId, userId,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
  suppliers: Supplier[]; medications: Medication[]; currency: string
  organizationId: string; branchId: string; userId: string
}) {
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<POLineItem[]>([{ medicationId: '', quantityOrdered: '1', unitCost: '0', batchNumber: '', expiryDate: '' }])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { toast } = useToast()

  function addLine() {
    setItems(p => [...p, { medicationId: '', quantityOrdered: '1', unitCost: '0', batchNumber: '', expiryDate: '' }])
  }

  function removeLine(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof POLineItem, value: string) {
    setItems(p => p.map((item, i) => i !== idx ? item : { ...item, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = items.filter(i => i.medicationId && parseInt(i.quantityOrdered) > 0)
    if (valid.length === 0) { setFormError('Add at least one item with a medication and quantity.'); return }
    setFormError(null); setSaving(true)

    const result = await createPurchaseOrder(createClient(), {
      organizationId, branchId, createdBy: userId,
      supplierId: supplierId || null,
      notes: notes.trim() || undefined,
      expectedDate: expectedDate || null,
      items: valid.map(i => ({
        medicationId: i.medicationId,
        quantityOrdered: Math.max(1, parseInt(i.quantityOrdered) || 1),
        unitCost: parseFloat(i.unitCost) || 0,
        currencyCode: currency,
        batchNumber: i.batchNumber.trim() || null,
        expiryDate: i.expiryDate || null,
      })),
    })

    setSaving(false)
    if (!result.ok) { setFormError(result.error.message); return }

    toast({ title: 'Purchase order created', description: `${result.data.po_number} placed.` })
    setSupplierId(''); setExpectedDate(''); setNotes('')
    setItems([{ medicationId: '', quantityOrdered: '1', unitCost: '0', batchNumber: '', expiryDate: '' }])
    onCreated(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            New Purchase Order
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { void handleSubmit(e) }} className="space-y-5 pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-date">Expected Date</Label>
              <Input id="po-date" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-notes">Notes</Label>
              <Input id="po-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Items <span className="text-destructive">*</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  {/* Row 1: Medication selector */}
                  <div className="space-y-1">
                    {idx === 0 && <p className="text-xs text-muted-foreground font-medium">Medication</p>}
                    <Select value={item.medicationId} onValueChange={v => updateLine(idx, 'medicationId', v)}>
                      <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select medication…" /></SelectTrigger>
                      <SelectContent>
                        {medications.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.name}{m.strength ? ` ${m.strength}` : ''}{m.dosage_form ? ` — ${m.dosage_form}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Row 2: Qty / Unit Cost / Delete */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground font-medium">Qty <span className="text-destructive">*</span></p>}
                      <Input
                        className="h-8 text-xs text-center font-semibold"
                        type="number" min="1"
                        value={item.quantityOrdered}
                        onChange={e => updateLine(idx, 'quantityOrdered', e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground font-medium">Unit Cost</p>}
                      <Input className="h-8 text-xs" type="number" min="0" step="0.01" value={item.unitCost} onChange={e => updateLine(idx, 'unitCost', e.target.value)} />
                    </div>
                    <div className="col-span-4 space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground font-medium">Expiry</p>}
                      <Input className="h-8 text-xs" type="date" value={item.expiryDate} onChange={e => updateLine(idx, 'expiryDate', e.target.value)} />
                    </div>
                  </div>
                  {/* Row 3: Batch + remove */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      {idx === 0 && <p className="text-xs text-muted-foreground font-medium">Batch # (optional)</p>}
                      <Input className="h-8 text-xs" value={item.batchNumber} onChange={e => updateLine(idx, 'batchNumber', e.target.value)} placeholder="e.g. BT-2025-001" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={items.length === 1}
                      className="mb-0.5 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : <><Truck className="mr-2 h-4 w-4" />Place Order</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Receive PO modal ──────────────────────────────────────────────────────────

function ReceivePOModal({
  po, items, open, onClose, onReceived, organizationId, branchId, userId, currency,
}: {
  po: PurchaseOrder; items: PurchaseOrderItem[]; open: boolean
  onClose: () => void; onReceived: () => void
  organizationId: string; branchId: string; userId: string; currency: string
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const init: Record<string, string> = {}
    for (const item of items) init[item.id] = String(Math.max(0, item.quantity_ordered - item.quantity_received))
    setQuantities(init)
  }, [items])

  async function handleReceive() {
    setSaving(true)
    const result = await receivePurchaseOrder(createClient(), po.id, {
      organizationId, branchId, performedBy: userId,
      items: items.map(item => ({
        poItemId: item.id,
        medicationId: item.medication_id,
        quantityReceived: Math.max(0, parseInt(quantities[item.id] ?? '0') || 0),
        unitCost: item.unit_cost,
        currencyCode: currency,
        batchNumber: item.batch_number,
        expiryDate: item.expiry_date,
      })),
    })
    setSaving(false)
    if (!result.ok) { toast({ title: 'Error', description: result.error.message, variant: 'destructive' }); return }
    toast({ title: 'Stock received', description: `${result.data.received} items added to inventory.` })
    onReceived(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-[#004741]" />
            Receive Stock — {po.po_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">Enter the actual quantity received for each item.</p>
          <div className="space-y-2">
            {items.map(item => {
              const remaining = item.quantity_ordered - item.quantity_received
              return (
                <div key={item.id} className={`rounded-lg border p-3 grid grid-cols-12 gap-3 items-center ${remaining <= 0 ? 'opacity-50 border-border' : 'border-border'}`}>
                  <div className="col-span-6">
                    <p className="text-sm font-medium text-foreground">{item.medication_name}</p>
                    <p className="text-xs text-muted-foreground">Ordered: {item.quantity_ordered} · Received: {item.quantity_received}</p>
                    {item.batch_number && <p className="text-xs font-mono text-muted-foreground">Batch: {item.batch_number}</p>}
                  </div>
                  <div className="col-span-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Pending</p>
                    <p className="text-sm font-semibold text-foreground">{remaining}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-xs text-muted-foreground mb-1">Receive now</p>
                    <Input
                      type="number" min="0" max={remaining} className="h-8 text-xs text-center"
                      value={quantities[item.id] ?? '0'}
                      onChange={e => setQuantities(p => ({ ...p, [item.id]: e.target.value }))}
                      disabled={remaining <= 0}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleReceive()} disabled={saving} className="bg-[#004741] hover:bg-[#006B60] text-white">
            {saving ? 'Receiving…' : <><PackageCheck className="mr-2 h-4 w-4" />Confirm Receipt</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_SUPPLIER: Omit<SupplierInsert, 'organization_id'> = {
  name: '', contact_name: '', phone: '', email: '', address: '',
}

export default function ProcurementPage() {
  const { activeBranch } = useBranch()
  const { user, organizationId } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState<Tab>('purchase_orders')
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreatePO, setShowCreatePO] = useState(false)
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null)
  const [receivePOItems, setReceivePOItems] = useState<PurchaseOrderItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all')

  // Supplier CRUD state
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeBranch || !organizationId) { setLoading(false); return }
    setLoading(true)
    const [poRes, supRes, medRes] = await Promise.all([
      getPurchaseOrders(createClient(), activeBranch.id),
      getSuppliers(createClient(), organizationId),
      getMedications(createClient(), organizationId, { activeOnly: true }),
    ])
    if (poRes.ok)  setOrders(poRes.data)
    if (supRes.ok) setSuppliers(supRes.data)
    if (medRes.ok) setMedications(medRes.data)
    setLoading(false)
  }, [activeBranch, organizationId])

  useEffect(() => { void load() }, [load])

  async function openReceive(po: PurchaseOrder) {
    setReceivePO(po); setLoadingItems(true)
    const result = await getPurchaseOrderItems(createClient(), po.id)
    if (result.ok) setReceivePOItems(result.data)
    setLoadingItems(false)
  }

  async function handleCancelPO(po: PurchaseOrder) {
    const result = await cancelPurchaseOrder(createClient(), po.id)
    if (!result.ok) { toast({ title: 'Error', description: result.error.message, variant: 'destructive' }); return }
    toast({ title: 'Order cancelled', description: `${po.po_number} has been cancelled.` })
    void load()
  }

  async function handleSaveSupplier() {
    if (!organizationId) return
    if (!supplierForm.name.trim()) { setSupplierFormError('Supplier name is required'); return }
    setSavingSupplier(true); setSupplierFormError(null)

    const input: SupplierInsert = {
      organization_id: organizationId,
      name: supplierForm.name.trim(),
      contact_name: supplierForm.contact_name?.trim() || null,
      phone: supplierForm.phone?.trim() || null,
      email: supplierForm.email?.trim() || null,
      address: supplierForm.address?.trim() || null,
    }

    const result = editingSupplier
      ? await updateSupplier(createClient(), editingSupplier.id, input)
      : await createSupplier(createClient(), input)

    setSavingSupplier(false)
    if (!result.ok) { setSupplierFormError(result.error.message); return }
    await load()
    setShowSupplierForm(false); setEditingSupplier(null); setSupplierForm(EMPTY_SUPPLIER)
  }

  async function handleDeleteSupplier(id: string) {
    if (!confirm('Remove this supplier?')) return
    const result = await softDeleteSupplier(createClient(), id)
    if (result.ok) setSuppliers(p => p.filter(s => s.id !== id))
    else toast({ title: 'Error', description: result.error.message, variant: 'destructive' })
  }

  const filteredOrders = useMemo(() => orders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || o.po_number.toLowerCase().includes(q) || (o.supplier_name ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  }), [orders, search, statusFilter])

  const currency = medications[0]?.currency_code ?? 'GHS'
  // medications_master rows carry currency_code; fall back to GHS (Phase 1 market)
  const activePOs = orders.filter(o => ['ordered', 'partial'].includes(o.status)).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Procurement
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create purchase orders and manage suppliers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {tab === 'purchase_orders' && (
            <Button size="sm" onClick={() => setShowCreatePO(true)} disabled={!activeBranch}>
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          )}
          {tab === 'suppliers' && (
            <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierForm(EMPTY_SUPPLIER); setShowSupplierForm(true) }}>
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Orders', value: orders.length },
          { label: 'Active Orders', value: activePOs, color: activePOs > 0 ? 'text-blue-600' : '' },
          { label: 'Received', value: orders.filter(o => o.status === 'received').length, color: 'text-[#004741]' },
          { label: 'Suppliers', value: suppliers.length },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color ?? 'text-foreground'}`}>
              {loading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {(['purchase_orders', 'suppliers'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'purchase_orders' ? 'Purchase Orders' : 'Suppliers'}
          </button>
        ))}
      </div>

      {/* Purchase Orders tab */}
      {tab === 'purchase_orders' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO number or supplier…" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as POStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(STATUS_CONFIG) as POStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-white overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Truck className="h-10 w-10" />
                <p className="text-sm font-medium">
                  {orders.length === 0 ? 'No purchase orders yet.' : 'No orders match your filter.'}
                </p>
                {orders.length === 0 && (
                  <Button size="sm" className="mt-2" onClick={() => setShowCreatePO(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Order
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Number</th>
                      <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">Supplier</th>
                      <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Expected</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map(po => (
                      <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-mono text-sm font-semibold text-foreground">{po.po_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(po.created_at).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </td>
                        <td className="hidden px-5 py-4 sm:table-cell text-sm text-foreground">
                          {po.supplier_name ?? <span className="text-muted-foreground">No supplier</span>}
                        </td>
                        <td className="hidden px-5 py-4 md:table-cell text-sm text-muted-foreground">
                          {po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-4 text-center"><StatusBadge status={po.status} /></td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {['ordered', 'partial'].includes(po.status) && (
                              <Button size="sm" className="h-7 text-xs bg-[#004741] hover:bg-[#006B60] text-white" onClick={() => void openReceive(po)} disabled={loadingItems}>
                                <PackageCheck className="mr-1 h-3.5 w-3.5" /> Receive
                              </Button>
                            )}
                            {['ordered', 'draft'].includes(po.status) && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => void handleCancelPO(po)}>
                                Cancel
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
                  {filteredOrders.length} of {orders.length} orders
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppliers tab */}
      {tab === 'suppliers' && (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <Building2 className="h-12 w-12" />
              <div className="text-center">
                <p className="font-medium">No suppliers yet</p>
                <p className="text-sm">Add your first supplier to get started</p>
              </div>
              <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierForm(EMPTY_SUPPLIER); setShowSupplierForm(true) }}>
                <Plus className="mr-2 h-4 w-4" /> Add Supplier
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">Contact</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Phone</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Email</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{s.name}</span>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-muted-foreground sm:table-cell">{s.contact_name ?? '—'}</td>
                    <td className="hidden px-6 py-4 text-muted-foreground md:table-cell">{s.phone ?? '—'}</td>
                    <td className="hidden px-6 py-4 lg:table-cell">
                      {s.email ? <a href={`mailto:${s.email}`} className="text-primary hover:underline">{s.email}</a> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, contact_name: s.contact_name ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' }); setShowSupplierForm(true) }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => void handleDeleteSupplier(s.id)} className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create PO modal */}
      {activeBranch && organizationId && user && (
        <CreatePOModal
          open={showCreatePO} onClose={() => setShowCreatePO(false)} onCreated={() => void load()}
          suppliers={suppliers} medications={medications} currency={currency}
          organizationId={organizationId} branchId={activeBranch.id} userId={user.id}
        />
      )}

      {/* Receive PO modal */}
      {receivePO && activeBranch && organizationId && user && (
        <ReceivePOModal
          po={receivePO} items={receivePOItems} open={!!receivePO}
          onClose={() => { setReceivePO(null); setReceivePOItems([]) }}
          onReceived={() => void load()}
          organizationId={organizationId} branchId={activeBranch.id} userId={user.id} currency={currency}
        />
      )}

      {/* Add/Edit Supplier modal */}
      {showSupplierForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button onClick={() => setShowSupplierForm(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {supplierFormError && <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{supplierFormError}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Supplier Name *</Label>
                <Input id="s-name" value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HealthLine Distributors" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-contact">Contact Person</Label>
                <Input id="s-contact" value={supplierForm.contact_name ?? ''} onChange={e => setSupplierForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-phone">Phone</Label>
                  <Input id="s-phone" value={supplierForm.phone ?? ''} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233 27 555 0123" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-email">Email</Label>
                  <Input id="s-email" type="email" value={supplierForm.email ?? ''} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-address">Address</Label>
                <Input id="s-address" value={supplierForm.address ?? ''} onChange={e => setSupplierForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City, Region" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setShowSupplierForm(false)} disabled={savingSupplier}>Cancel</Button>
              <Button onClick={() => void handleSaveSupplier()} disabled={savingSupplier}>
                {savingSupplier ? 'Saving…' : editingSupplier ? 'Save Changes' : 'Add Supplier'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
