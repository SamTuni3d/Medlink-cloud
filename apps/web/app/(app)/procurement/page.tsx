'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Building2, Pencil, Trash2, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
} from '@medlink/data-client'
import type { Supplier, SupplierInsert } from '@medlink/data-client'

type Tab = 'suppliers' | 'purchase_orders'

const EMPTY_FORM: Omit<SupplierInsert, 'organization_id'> = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
}

export default function ProcurementPage() {
  const { organizationId } = useAuth()
  const [tab, setTab] = useState<Tab>('suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) { setLoading(false); return }
    setLoading(true); setError(null)
    const result = await getSuppliers(createClient(), organizationId)
    if (result.ok) setSuppliers(result.data)
    else setError(result.error.message)
    setLoading(false)
  }, [organizationId])

  useEffect(() => { void load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
    })
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setFormError(null)
  }

  async function handleSave() {
    if (!organizationId) return
    if (!form.name.trim()) { setFormError('Supplier name is required'); return }

    setSaving(true); setFormError(null)

    const input: SupplierInsert = {
      organization_id: organizationId,
      name: form.name.trim(),
      contact_name: form.contact_name?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
    }

    const result = editing
      ? await updateSupplier(createClient(), editing.id, input)
      : await createSupplier(createClient(), input)

    if (result.ok) {
      await load()
      closeForm()
    } else {
      setFormError(result.error.message)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this supplier?')) return
    const result = await softDeleteSupplier(createClient(), id)
    if (result.ok) setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Procurement</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage suppliers and purchase orders</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(['suppliers', 'purchase_orders'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t === 'suppliers' ? 'Suppliers' : 'Purchase Orders'}
          </button>
        ))}
      </div>

      {tab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Building2 className="h-12 w-12" />
                <div className="text-center">
                  <p className="font-medium">No suppliers yet</p>
                  <p className="text-sm">Add your first supplier to get started</p>
                </div>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Supplier
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</th>
                    <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Contact Person</th>
                    <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Phone</th>
                    <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Email</th>
                    <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Added</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {suppliers.map(supplier => (
                    <tr key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                            <Building2 className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{supplier.name}</span>
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 text-slate-600 dark:text-slate-400 sm:table-cell">
                        {supplier.contact_name ?? '—'}
                      </td>
                      <td className="hidden px-6 py-4 text-slate-600 dark:text-slate-400 md:table-cell">
                        {supplier.phone ?? '—'}
                      </td>
                      <td className="hidden px-6 py-4 lg:table-cell">
                        {supplier.email
                          ? <a href={`mailto:${supplier.email}`} className="text-primary hover:underline">{supplier.email}</a>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="hidden px-6 py-4 text-slate-500 text-xs lg:table-cell">
                        {new Date(supplier.created_at).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(supplier)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void handleDelete(supplier.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                          >
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
        </div>
      )}

      {tab === 'purchase_orders' && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-24 text-slate-400">
          <Building2 className="h-12 w-12" />
          <div className="text-center">
            <p className="font-medium text-slate-600 dark:text-slate-300">Purchase Orders coming soon</p>
            <p className="text-sm">Track your medication orders from suppliers</p>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {editing ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button onClick={closeForm} className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {formError && (
                <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{formError}</p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. HealthLine Distributors"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact_name">Contact Person</Label>
                <Input
                  id="contact_name"
                  value={form.contact_name ?? ''}
                  onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                  placeholder="e.g. Kofi Boateng"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone ?? ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+233 27 555 0123"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email ?? ''}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="supplier@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address ?? ''}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Street, City, Region"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplier'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
