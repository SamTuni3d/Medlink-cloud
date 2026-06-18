'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  RefreshCw,
  CloudOff,
  Loader2,
  ScanBarcode,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart } from '@/hooks/useCart'
import { usePosData } from '@/hooks/usePosData'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useBranch } from '@/hooks/useBranch'
import { useAuth } from '@/providers/auth-provider'
import { completeSale } from '@/lib/pos/completeSale'
import { db } from '@/lib/dexie/db'
import { formatCurrency } from '@/lib/formatCurrency'
import { useToast } from '@/hooks/use-toast'
import type { PosProduct } from '@/hooks/usePosData'

// Metadata can only be exported from a Server Component, so we skip it here.
// The page title is set via the layout tree.

// ─── Payment dialog ───────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'credit'

interface PaymentDialogProps {
  total: number
  currencyCode: string
  onCancel: () => void
  onConfirm: (method: PaymentMethod, tendered: number | null) => void
}

function PaymentDialog({ total, currencyCode, onCancel, onConfirm }: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')

  const change =
    method === 'cash' && tendered
      ? Math.max(0, parseFloat(tendered) - total)
      : null

  const isValid =
    method !== 'cash' ||
    (parseFloat(tendered || '0') >= total)

  const METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'credit', label: 'Credit' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">Payment</h2>

        <div className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">Total due</p>
          <p className="text-3xl font-bold text-primary">
            {formatCurrency(total, currencyCode)}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                method === m.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:border-primary hover:text-primary'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="mb-4 space-y-2">
            <label className="text-sm font-medium">Amount tendered</label>
            <Input
              type="number"
              min={total}
              step="0.01"
              placeholder={String(total)}
              value={tendered}
              onChange={e => setTendered(e.target.value)}
              autoFocus
            />
            {change !== null && change >= 0 && (
              <p className="text-sm text-muted-foreground">
                Change:{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(change, currencyCode)}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!isValid}
            onClick={() =>
              onConfirm(method, method === 'cash' ? parseFloat(tendered) || total : null)
            }
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

interface ReceiptProps {
  saleNumber: string
  items: { name: string; quantity: number; unitPrice: number; currencyCode: string }[]
  total: number
  paymentMethod: string
  currencyCode: string
  onClose: () => void
}

function Receipt({ saleNumber, items, total, paymentMethod, currencyCode, onClose }: ReceiptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xs rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-4 text-center">
          <p className="text-xs text-muted-foreground">MedLink Cloud</p>
          <p className="mt-1 font-mono text-sm font-bold">{saleNumber}</p>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleString()}
          </p>
        </div>

        <Separator className="my-3" />

        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="truncate pr-2">
                {item.name} × {item.quantity}
              </span>
              <span className="shrink-0 font-mono">
                {formatCurrency(item.unitPrice * item.quantity, item.currencyCode)}
              </span>
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(total, currencyCode)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground capitalize">
          Paid via {paymentMethod.replace('_', ' ')}
        </p>

        <Button className="mt-4 w-full" onClick={onClose}>
          New Sale
        </Button>
      </div>
    </div>
  )
}

// ─── Product card ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: PosProduct
  onAdd: (product: PosProduct) => void
}

function ProductCard({ product, onAdd }: ProductCardProps) {
  const noStock = product.available_stock <= 0

  return (
    <button
      onClick={() => onAdd(product)}
      className="group relative rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
    >
      {product.requires_prescription && (
        <Badge variant="secondary" className="absolute right-2 top-2 text-xs">
          Rx
        </Badge>
      )}
      <p className="truncate text-sm font-semibold leading-tight">{product.name}</p>
      {product.strength && (
        <p className="text-xs text-muted-foreground">{product.strength}</p>
      )}
      <p className="mt-2 text-base font-bold text-primary">
        {formatCurrency(product.selling_price, product.currency_code)}
      </p>
      <p className={`text-xs ${noStock ? 'text-amber-500' : 'text-muted-foreground'}`}>
        {noStock ? 'Stock not entered' : `${product.available_stock} ${product.unit_of_measure}`}
      </p>
    </button>
  )
}

// ─── Main POS page ────────────────────────────────────────────────────────────

export default function POSPage() {
  const { user, organizationId } = useAuth()
  const { activeBranch } = useBranch()
  const { items, totals, addItem, removeItem, updateQty, clearCart } = useCart()
  const { products, loading, refresh } = usePosData(activeBranch?.id ?? null)
  const { pendingCount, isSyncing } = useSyncQueue()
  const { toast } = useToast()

  const barcodeRef = useRef<HTMLInputElement>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [receipt, setReceipt] = useState<null | {
    saleNumber: string
    items: { name: string; quantity: number; unitPrice: number; currencyCode: string }[]
    total: number
    paymentMethod: string
    currencyCode: string
  }>(null)
  const [isCompleting, setIsCompleting] = useState(false)

  // Auto-focus the barcode input when the page mounts (works with USB scanners)
  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  const filtered = products.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.generic_name?.toLowerCase().includes(q) ||
      p.barcode === search
    )
  })

  const handleAddProduct = useCallback(
    async (product: PosProduct) => {
      // Pick first FEFO batch (earliest expiry with stock)
      let batchId: string | null = null
      if (activeBranch) {
        const batches = await db.inventory_batches_cache
          .where('[branch_id+medication_id]')
          .equals([activeBranch.id, product.id])
          .filter(b => b.quantity_remaining > 0)
          .sortBy('expiry_date')
        batchId = batches[0]?.id ?? null
      }

      addItem({
        medicationId: product.id,
        medicationName: product.name,
        batchId,
        quantity: 1,
        unitPrice: product.selling_price,
        currencyCode: product.currency_code,
        discountPercent: 0,
      })
    },
    [activeBranch, addItem]
  )

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim()
      if (!trimmed) return

      const product = products.find(p => p.barcode === trimmed)

      if (!product) {
        toast({
          title: 'Barcode not found',
          description: `No medication matched barcode "${trimmed}".`,
          variant: 'destructive',
        })
        setBarcodeInput('')
        barcodeRef.current?.focus()
        return
      }

      if (product.available_stock <= 0) {
        toast({
          title: 'Out of stock',
          description: `${product.name} has no stock available.`,
          variant: 'destructive',
        })
        setBarcodeInput('')
        barcodeRef.current?.focus()
        return
      }

      await handleAddProduct(product)
      toast({ title: 'Added to cart', description: product.name })
      setBarcodeInput('')
      barcodeRef.current?.focus()
    },
    [products, handleAddProduct, toast]
  )

  const handleConfirmPayment = useCallback(
    async (method: 'cash' | 'card' | 'mobile_money' | 'credit', tendered: number | null) => {
      if (!activeBranch || !organizationId || !user || items.length === 0) return

      setIsCompleting(true)
      setShowPayment(false)

      try {
        // Rule 2: this writes to Dexie only — never awaits Supabase
        const { saleNumber } = await completeSale({
          branchId: activeBranch.id,
          organizationId,
          cashierId: user.id,
          items,
          paymentMethod: method,
          amountTendered: tendered,
          customerName: null,
          prescriptionNumber: null,
          currencyCode: items[0]?.currencyCode ?? 'GHS',
        })

        // Show receipt, then clear cart
        setReceipt({
          saleNumber,
          items: items.map(i => ({
            name: i.medicationName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            currencyCode: i.currencyCode,
          })),
          total: totals.total,
          paymentMethod: method,
          currencyCode: items[0]?.currencyCode ?? 'GHS',
        })
        clearCart()
      } finally {
        setIsCompleting(false)
      }
    },
    [activeBranch, organizationId, user, items, totals.total, clearCart]
  )

  const handleCloseReceipt = useCallback(() => {
    setReceipt(null)
    setSearch('')
  }, [])

  if (!activeBranch) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a branch to use the POS.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* POS topbar */}
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <span className="text-sm font-medium">{activeBranch.name}</span>
        <div className="flex-1" />
        {pendingCount > 0 && (
          <Badge variant="outline" className="gap-1 text-xs">
            {isSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CloudOff className="h-3 w-3" />
            )}
            {pendingCount} pending
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          title="Refresh product cache"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — product search */}
        <div className="flex flex-1 flex-col overflow-hidden border-r">
          {/* Barcode scanner — auto-focused; USB scanners send Enter after each scan */}
          <div className="border-b bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2">
            <div className="relative">
              <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600 dark:text-amber-500" />
              <Input
                ref={barcodeRef}
                className="pl-9 font-mono text-sm border-amber-200 dark:border-amber-800 focus-visible:ring-amber-400"
                placeholder="Scan barcode…"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleBarcodeScan(barcodeInput)
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, generic name, or barcode…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                {search ? 'No products match your search.' : 'No products in cache. Connect to sync.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleAddProduct}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — cart */}
        <div className="flex w-72 shrink-0 flex-col bg-card lg:w-80">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShoppingCart className="h-4 w-4" />
            <span className="font-semibold">Cart</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {items.length}
              </Badge>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Cart is empty
            </div>
          ) : (
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {items.map(item => (
                <div
                  key={item.medicationId}
                  className="flex items-start gap-2 rounded-lg border bg-background p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.medicationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unitPrice, item.currencyCode)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.medicationId, item.quantity - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border hover:bg-accent"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.medicationId, item.quantity + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeItem(item.medicationId)}
                      className="ml-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cart totals & actions */}
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">
                {formatCurrency(totals.subtotal, items[0]?.currencyCode ?? 'GHS')}
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="font-mono text-primary">
                {formatCurrency(totals.total, items[0]?.currencyCode ?? 'GHS')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearCart}
                disabled={items.length === 0}
              >
                Clear
              </Button>
              <Button
                className="flex-1"
                onClick={() => setShowPayment(true)}
                disabled={items.length === 0 || isCompleting}
              >
                {isCompleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Pay
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPayment && items.length > 0 && (
        <PaymentDialog
          total={totals.total}
          currencyCode={items[0]?.currencyCode ?? 'GHS'}
          onCancel={() => setShowPayment(false)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {receipt && (
        <Receipt
          saleNumber={receipt.saleNumber}
          items={receipt.items}
          total={receipt.total}
          paymentMethod={receipt.paymentMethod}
          currencyCode={receipt.currencyCode}
          onClose={handleCloseReceipt}
        />
      )}
    </div>
  )
}
