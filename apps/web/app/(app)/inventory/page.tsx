'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Package, Search, RefreshCw, AlertTriangle, Clock,
  PackagePlus, PackageSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { getInventory } from '@medlink/data-client'
import { formatCurrency } from '@/lib/formatCurrency'
import { StaggerGrid, StaggerItem, HoverCard, SlideInRow } from '@/components/ui/motion-primitives'
import type { InventoryWithBatches } from '@medlink/data-client'

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring'

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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className={`h-5 w-5 ${
          accent === 'amber' ? 'text-amber-400' :
          accent === 'red' ? 'text-red-400' :
          'text-slate-300 dark:text-slate-600'
        }`} />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-28" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      )}
    </div>
  )
}

export default function InventoryPage() {
  const { activeBranch } = useBranch()
  const [rows, setRows] = useState<InventoryWithBatches[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true); setError(null)
    const result = await getInventory(createClient(), activeBranch.id)
    if (result.ok) setRows(result.data)
    else setError(result.error.message)
    setLoading(false)
  }, [activeBranch])

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
      stockFilter === 'all' ? true :
      stockFilter === 'in_stock' ? r.available_stock > r.reorder_point :
      stockFilter === 'low_stock' ? (r.available_stock > 0 && r.available_stock <= r.reorder_point) :
      stockFilter === 'out_of_stock' ? r.available_stock === 0 :
      stockFilter === 'expiring' ? (r.days_to_nearest_expiry !== null && r.days_to_nearest_expiry > 0 && r.days_to_nearest_expiry <= 90) :
      true
    return matchSearch && matchCat && matchStock
  }), [rows, search, categoryFilter, stockFilter])

  // Summary stats
  const totalProducts = rows.length
  const totalValue = rows.reduce((sum, r) => sum + r.available_stock * r.selling_price, 0)
  const lowStockCount = rows.filter(r => r.available_stock <= r.reorder_point).length
  const expiringSoonCount = rows.filter(
    r => r.days_to_nearest_expiry !== null && r.days_to_nearest_expiry > 0 && r.days_to_nearest_expiry <= 90
  ).length
  const currency = rows[0]?.currency_code ?? 'GHS'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your medication stock</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm">
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Medication
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">Select a branch to view inventory.</p>
      )}

      {/* Summary cards */}
      <StaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Products', value: String(totalProducts), icon: Package },
          { label: 'Total Value', value: formatCurrency(totalValue, currency), icon: Package },
          { label: 'Low Stock', value: String(lowStockCount), icon: AlertTriangle, accent: lowStockCount > 0 ? 'amber' as const : undefined },
          { label: 'Expiring Soon', value: String(expiringSoonCount), icon: Clock, accent: expiringSoonCount > 0 ? 'amber' as const : undefined },
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <PackageSearch className="h-10 w-10" />
            <p className="text-sm font-medium">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Category</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Strength / Form</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 xl:table-cell">Batch / Expiry</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th>
                  <th className="hidden px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Selling</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((row, idx) => {
                  const isLowStock = row.available_stock <= row.reorder_point
                  const isOut = row.available_stock === 0
                  const isExpiring = row.days_to_nearest_expiry !== null
                    && row.days_to_nearest_expiry > 0
                    && row.days_to_nearest_expiry <= 90

                  return (
                    <SlideInRow key={row.inventory_id} index={idx}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{row.medication_name}</p>
                        {row.generic_name && (
                          <p className="text-xs text-primary/70 dark:text-primary/60 mt-0.5">{row.generic_name}</p>
                        )}
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        {row.category ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {row.category}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        {row.strength && (
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{row.strength}</p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400">{row.dosage_form}</p>
                      </td>
                      <td className="hidden px-5 py-4 xl:table-cell">
                        {row.nearest_expiry_date ? (
                          <>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {new Date(row.nearest_expiry_date).toLocaleDateString('en-GH', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </p>
                            {isExpiring && (
                              <p className="text-[10px] text-orange-500 mt-0.5">
                                {row.days_to_nearest_expiry}d left
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className={`font-semibold text-base ${
                          isOut ? 'text-red-600 dark:text-red-400' :
                          isLowStock ? 'text-amber-600 dark:text-amber-400' :
                          'text-slate-900 dark:text-slate-100'
                        }`}>
                          {row.available_stock}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold mt-0.5 ${
                          isOut
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : isLowStock
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {isOut ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 text-right lg:table-cell">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatCurrency(row.selling_price, row.currency_code)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          className="rounded-lg p-2 text-slate-400 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 transition-colors"
                          title="Receive stock"
                        >
                          <PackagePlus className="h-4 w-4" />
                        </button>
                      </td>
                    </SlideInRow>
                  )
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-2.5 text-xs text-slate-500">
              Showing {filtered.length} of {rows.length} products
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
