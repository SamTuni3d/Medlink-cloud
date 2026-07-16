'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, FileText, CheckCircle2, XCircle,
  ChevronRight, Pill, User, Stethoscope, Calendar, X, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getMedications } from '@medlink/data-client'
import {
  createPrescriptionAction,
  dispensePrescriptionAction,
  cancelPrescriptionAction,
  getPrescriptionsAction,
  getPrescriptionAction,
} from './actions'
import type { Prescription, PrescriptionWithItems, PrescriptionStatus } from '@medlink/data-client'

type StatusFilter = 'all' | PrescriptionStatus

const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  pending: 'Pending',
  partially_dispensed: 'Partial',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const STATUS_COLORS: Record<PrescriptionStatus, string> = {
  pending: 'text-blue-600 bg-blue-50 border-blue-200',
  partially_dispensed: 'text-amber-600 bg-amber-50 border-amber-200',
  dispensed: 'text-green-600 bg-green-50 border-green-200',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
  expired: 'text-gray-600 bg-gray-50 border-gray-200',
}

interface MedOption {
  id: string
  name: string
  strength: string | null
}

interface NewItem {
  medication_id: string
  medication_name: string
  quantity_prescribed: number
  dosage_instructions: string
  duration_days: string
}

const BLANK_FORM = {
  patient_name: '', patient_dob: '', patient_phone: '',
  prescriber_name: '', prescriber_license: '', prescriber_phone: '',
  diagnosis: '', notes: '',
  issued_date: new Date().toISOString().slice(0, 10),
  expiry_date: '',
}
const BLANK_ITEM: NewItem = { medication_id: '', medication_name: '', quantity_prescribed: 1, dosage_instructions: '', duration_days: '' }

export default function PrescriptionsPage() {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)

  // New prescription form state
  const [newOpen, setNewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [medications, setMedications] = useState<MedOption[]>([])
  const [form, setForm] = useState(BLANK_FORM)
  const [items, setItems] = useState<NewItem[]>([{ ...BLANK_ITEM }])

  // Detail / dispense state
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRx, setSelectedRx] = useState<PrescriptionWithItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [dispenseOpen, setDispenseOpen] = useState(false)
  const [dispensing, setDispensing] = useState(false)
  const [dispenseQtys, setDispenseQtys] = useState<Record<string, number>>({})

  const orgId = user?.app_metadata?.organization_id as string | undefined

  const load = useCallback(async () => {
    if (!activeBranch?.id) return
    setLoading(true)
    const result = await getPrescriptionsAction(activeBranch.id, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: search.trim() || undefined,
    })
    if (result.ok) setPrescriptions(result.data)
    setLoading(false)
  }, [activeBranch?.id, statusFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!newOpen || !orgId) return
    const client = createClient()
    getMedications(client, orgId, { activeOnly: true }).then(r => {
      if (r.ok) setMedications(r.data.map(m => ({ id: m.id, name: m.name, strength: m.strength })))
    })
  }, [newOpen, orgId])

  function addItem() {
    setItems(prev => [...prev, { ...BLANK_ITEM }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, patch: Partial<NewItem>) {
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, ...patch }))
  }

  function onMedSelect(idx: number, medId: string) {
    const med = medications.find(m => m.id === medId)
    updateItem(idx, { medication_id: medId, medication_name: med?.name ?? '' })
  }

  async function handleCreate() {
    if (!activeBranch?.id) return
    if (items.some(i => !i.medication_id)) {
      toast({ title: 'Select a medication for each item', variant: 'destructive' })
      return
    }
    setSaving(true)
    const result = await createPrescriptionAction({
      branch_id: activeBranch.id,
      ...form,
      patient_dob: form.patient_dob || undefined,
      patient_phone: form.patient_phone || undefined,
      prescriber_license: form.prescriber_license || undefined,
      prescriber_phone: form.prescriber_phone || undefined,
      diagnosis: form.diagnosis || undefined,
      notes: form.notes || undefined,
      expiry_date: form.expiry_date || undefined,
      items: items.map(item => ({
        medication_id: item.medication_id,
        medication_name: item.medication_name,
        quantity_prescribed: item.quantity_prescribed,
        dosage_instructions: item.dosage_instructions || undefined,
        duration_days: item.duration_days ? parseInt(item.duration_days) : undefined,
      })),
    })
    setSaving(false)
    if (!result.ok) { toast({ title: result.error.message, variant: 'destructive' }); return }
    toast({ title: `Prescription ${result.data.rx_number} created` })
    setNewOpen(false)
    setForm(BLANK_FORM)
    setItems([{ ...BLANK_ITEM }])
    load()
  }

  async function openDetail(id: string) {
    setSelectedRx(null)
    setDetailLoading(true)
    setDetailOpen(true)
    const result = await getPrescriptionAction(id)
    if (result.ok) {
      setSelectedRx(result.data)
      const initial: Record<string, number> = {}
      result.data.items.filter(i => i.status !== 'dispensed' && i.status !== 'cancelled').forEach(i => {
        initial[i.id] = i.quantity_prescribed - i.quantity_dispensed
      })
      setDispenseQtys(initial)
    }
    setDetailLoading(false)
  }

  async function handleDispense() {
    if (!selectedRx) return
    const dispenseItems = Object.entries(dispenseQtys)
      .filter(([, qty]) => qty > 0)
      .map(([item_id, quantity_to_dispense]) => ({ item_id, quantity_to_dispense }))
    if (dispenseItems.length === 0) { toast({ title: 'No items to dispense', variant: 'destructive' }); return }

    setDispensing(true)
    const result = await dispensePrescriptionAction({ prescription_id: selectedRx.id, items: dispenseItems })
    setDispensing(false)
    if (!result.ok) { toast({ title: result.error.message, variant: 'destructive' }); return }
    toast({ title: 'Prescription dispensed' })
    setDispenseOpen(false)
    setDetailOpen(false)
    load()
  }

  async function handleCancel(id: string) {
    const result = await cancelPrescriptionAction(id)
    if (!result.ok) { toast({ title: result.error.message, variant: 'destructive' }); return }
    toast({ title: 'Prescription cancelled' })
    setDetailOpen(false)
    load()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and dispense patient prescriptions</p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />New Prescription
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, doctor, Rx number…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partially_dispensed">Partially Dispensed</SelectItem>
            <SelectItem value="dispensed">Dispensed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white py-24 text-muted-foreground">
          <FileText className="h-14 w-14 text-muted" />
          <div className="text-center">
            <p className="font-medium text-muted-foreground">No prescriptions found</p>
            <p className="mt-0.5 text-sm">
              {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create a new prescription to get started'}
            </p>
          </div>
          {!search && statusFilter === 'all' && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />New Prescription
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {prescriptions.map(rx => (
            <button
              key={rx.id}
              onClick={() => openDetail(rx.id)}
              className="w-full rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{rx.patient_name}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[rx.status]}`}>
                      {STATUS_LABELS[rx.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{rx.rx_number}</span>
                    <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{rx.prescriber_name}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(rx.issued_date).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── New Prescription Sheet ── */}
      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>New Prescription</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-5">
            {/* Patient */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />Patient
              </p>
              <div className="space-y-3">
                <div>
                  <Label>Patient Name *</Label>
                  <Input value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} placeholder="Full name" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date of Birth</Label>
                    <Input type="date" value={form.patient_dob} onChange={e => setForm(f => ({ ...f, patient_dob: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.patient_phone} onChange={e => setForm(f => ({ ...f, patient_phone: e.target.value }))} placeholder="0XX XXX XXXX" className="mt-1" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Prescriber */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5" />Prescriber
              </p>
              <div className="space-y-3">
                <div>
                  <Label>Doctor / Prescriber Name *</Label>
                  <Input value={form.prescriber_name} onChange={e => setForm(f => ({ ...f, prescriber_name: e.target.value }))} placeholder="Dr. Name" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>License No.</Label>
                    <Input value={form.prescriber_license} onChange={e => setForm(f => ({ ...f, prescriber_license: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.prescriber_phone} onChange={e => setForm(f => ({ ...f, prescriber_phone: e.target.value }))} className="mt-1" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Details */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />Details
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Issue Date *</Label>
                    <Input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Diagnosis</Label>
                  <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Medications */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Pill className="h-3.5 w-3.5" />Medications *
                </p>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Add
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="relative rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="absolute right-2 top-2 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div>
                      <Label className="text-xs">Medication</Label>
                      <Select value={item.medication_id} onValueChange={v => onMedSelect(idx, v)}>
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue placeholder="Select medication…" />
                        </SelectTrigger>
                        <SelectContent>
                          {medications.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}{m.strength ? ` ${m.strength}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input type="number" min={1} value={item.quantity_prescribed}
                          onChange={e => updateItem(idx, { quantity_prescribed: parseInt(e.target.value) || 1 })}
                          className="mt-1 h-9" />
                      </div>
                      <div>
                        <Label className="text-xs">Duration (days)</Label>
                        <Input type="number" min={1} value={item.duration_days}
                          onChange={e => updateItem(idx, { duration_days: e.target.value })}
                          className="mt-1 h-9" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Dosage Instructions</Label>
                      <Input value={item.dosage_instructions}
                        onChange={e => updateItem(idx, { dosage_instructions: e.target.value })}
                        placeholder="e.g. 1 tablet twice daily after meals"
                        className="mt-1 h-9" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pb-4">
              <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !form.patient_name || !form.prescriber_name}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Create Prescription'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Detail Sheet ── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detailLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedRx ? (
            <>
              <SheetHeader><SheetTitle>{selectedRx.rx_number}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLORS[selectedRx.status]}`}>
                  {STATUS_LABELS[selectedRx.status]}
                </span>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Patient</p>
                    <p className="font-medium">{selectedRx.patient_name}</p>
                    {selectedRx.patient_phone && <p className="text-xs text-muted-foreground">{selectedRx.patient_phone}</p>}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prescriber</p>
                    <p className="font-medium">{selectedRx.prescriber_name}</p>
                    {selectedRx.prescriber_license && <p className="text-xs text-muted-foreground">{selectedRx.prescriber_license}</p>}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Issued</p>
                    <p className="font-medium">{new Date(selectedRx.issued_date).toLocaleDateString()}</p>
                  </div>
                  {selectedRx.expiry_date && (
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p className="font-medium">{new Date(selectedRx.expiry_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedRx.diagnosis && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Diagnosis</p>
                      <p className="font-medium">{selectedRx.diagnosis}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-semibold">Medications</p>
                  <div className="space-y-2">
                    {selectedRx.items.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.medication_name}</p>
                          {item.dosage_instructions && <p className="mt-0.5 text-xs text-muted-foreground">{item.dosage_instructions}</p>}
                          {item.duration_days && <p className="text-xs text-muted-foreground">{item.duration_days} days</p>}
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          item.status === 'dispensed' ? 'text-green-600 bg-green-50 border-green-200'
                          : item.status === 'partial' ? 'text-amber-600 bg-amber-50 border-amber-200'
                          : item.status === 'cancelled' ? 'text-red-600 bg-red-50 border-red-200'
                          : 'text-blue-600 bg-blue-50 border-blue-200'
                        }`}>
                          {item.quantity_dispensed}/{item.quantity_prescribed}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedRx.notes && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{selectedRx.notes}</div>
                )}

                {(selectedRx.status === 'pending' || selectedRx.status === 'partially_dispensed') && (
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => setDispenseOpen(true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Dispense
                    </Button>
                    <Button variant="outline" onClick={() => handleCancel(selectedRx.id)}>
                      <XCircle className="mr-2 h-4 w-4" />Cancel Rx
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Dispense Dialog ── */}
      <Dialog open={dispenseOpen} onOpenChange={setDispenseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispense Prescription</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {selectedRx?.items
              .filter(i => i.status !== 'dispensed' && i.status !== 'cancelled')
              .map(item => {
                const remaining = item.quantity_prescribed - item.quantity_dispensed
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.medication_name}</p>
                      <p className="text-xs text-muted-foreground">{remaining} remaining to dispense</p>
                    </div>
                    <Input
                      type="number" min={0} max={remaining}
                      value={dispenseQtys[item.id] ?? remaining}
                      onChange={e => setDispenseQtys(prev => ({ ...prev, [item.id]: Math.min(parseInt(e.target.value) || 0, remaining) }))}
                      className="w-20 h-9 text-center"
                    />
                  </div>
                )
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispenseOpen(false)}>Cancel</Button>
            <Button onClick={handleDispense} disabled={dispensing}>
              {dispensing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Dispense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
