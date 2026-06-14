'use client'

import { useState, useEffect, useCallback } from 'react'
import { PackageSearch, RefreshCw, AlertTriangle, Clock, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { getInventory } from '@medlink/data-client'
import { scoreExpiryRisk } from '@medlink/business-rules'
import { formatCurrency } from '@/lib/formatCurrency'
import type { InventoryWithBatches } from '@medlink/data-client'

type ExpiryScore = 'critical' | 'high' | 'medium' | 'low' | null

function expiryBadgeVariant(score: ExpiryScore) {
  switch (score) {
    case 'critical': return 'destructive'
    case 'high':     return 'destructive'
    case 'medium':   return 'secondary'
    case 'low':      return 'secondary'
    default:         return 'outline'
  }
}

function expiryBadgeLabel(score: ExpiryScore, daysToExpiry: number | null) {
  if (score === null || daysToExpiry === null) return null
  if (score === 'critical') return `Expires in ${daysToExpiry}d`
  if (score === 'high')     return `Expires in ${daysToExpiry}d`
  return null
}

function computeExpiryScore(row: InventoryWithBatches): ExpiryScore {
  if (!row.nearest_expiry_date) return null
  const result = scoreExpiryRisk({
    expiry_date: new Date(row.nearest_expiry_date),
    quantity_remaining: row.available_stock,
    average_daily_usage: 0, // conservative: assume zero usage for scoring display
  })
  return result.score
}

export default function InventoryPage() {
  const { activeBranch } = useBranch()
  const [rows, setRows] = useState<InventoryWithBatches[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const result = await getInventory(createClient(), activeBranch.id)
    if (result.ok) {
      setRows(result.data)
    } else {
      setError(result.error.message)
    }
    setLoading(false)
  }, [activeBranch])

  useEffect(() => { void load() }, [load])

  const filtered = rows.filter(r => {
    const matchesSearch =
      search === '' ||
      r.medication_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.generic_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesLowStock = !showLowStockOnly || r.available_stock <= r.reorder_point
    return matchesSearch && matchesLowStock
  })

  const lowStockCount = rows.filter(r => r.available_stock <= r.reorder_point).length
  const criticalExpiryCount = rows.filter(r => computeExpiryScore(r) === 'critical').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="ml-auto flex items-center gap-2">
          {lowStockCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {lowStockCount} low stock
            </Badge>
          )}
          {criticalExpiryCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" />
              {criticalExpiryCount} expiring
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!activeBranch && !loading && (
        <p className="text-sm text-muted-foreground">
          Select a branch to view inventory.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search medications…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showLowStockOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowLowStockOnly(v => !v)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Low stock only
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            {loading ? 'Loading…' : `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <PackageSearch className="h-10 w-10" />
              <p className="text-sm">No items found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Medication</th>
                    <th className="pb-2 pr-4 font-medium text-right">In Stock</th>
                    <th className="pb-2 pr-4 font-medium text-right">Reorder At</th>
                    <th className="pb-2 pr-4 font-medium text-right">Price</th>
                    <th className="pb-2 font-medium">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const isLowStock = row.available_stock <= row.reorder_point
                    const expiryScore = computeExpiryScore(row)
                    const expiryLabel = expiryBadgeLabel(
                      expiryScore,
                      row.days_to_nearest_expiry ?? null
                    )

                    return (
                      <tr
                        key={row.inventory_id}
                        className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium">{row.medication_name}</p>
                          {row.generic_name && (
                            <p className="text-xs text-muted-foreground">{row.generic_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {row.dosage_form}
                            {row.strength ? ` · ${row.strength}` : ''}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          <span className={isLowStock ? 'font-bold text-destructive' : ''}>
                            {row.available_stock}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {row.unit_of_measure}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                          {row.reorder_point}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {formatCurrency(row.selling_price, row.currency_code)}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {isLowStock && (
                              <Badge variant="destructive" className="text-xs">
                                Low stock
                              </Badge>
                            )}
                            {expiryLabel && (
                              <Badge
                                variant={expiryBadgeVariant(expiryScore)}
                                className="text-xs"
                              >
                                {expiryLabel}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
