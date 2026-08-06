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
  Printer,
  Camera,
  CameraOff,
  X,
  LogOut,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { signOutAction } from '@/app/(app)/actions'
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

interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  currencyCode: string
}

interface ReceiptProps {
  saleNumber: string
  branchName: string
  branchAddress: string | null
  cashierName: string
  saleTime: string
  items: ReceiptItem[]
  subtotal: number
  total: number
  paymentMethod: string
  amountTendered: number | null
  change: number | null
  currencyCode: string
  onClose: () => void
}

function Receipt({
  saleNumber, branchName, branchAddress, cashierName, saleTime,
  items, subtotal, total, paymentMethod, amountTendered, change,
  currencyCode, onClose,
}: ReceiptProps) {
  const date = new Date(saleTime)
  const dateStr = date.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const methodLabel = paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  function handlePrint() {
    const win = window.open('', '_blank', 'toolbar=0,menubar=0,scrollbars=0,width=420,height=720')
    if (!win) { window.print(); return }

    const rows = items.map(item => `
      <tr>
        <td style="padding:2px 0;vertical-align:top;font-size:11px">${item.name}</td>
        <td style="padding:2px 4px;text-align:right;white-space:nowrap;font-size:11px;color:#555">
          ${item.quantity} × ${formatCurrency(item.unitPrice, item.currencyCode)}
        </td>
        <td style="padding:2px 0;text-align:right;font-weight:600;white-space:nowrap;font-size:11px">
          ${formatCurrency(item.unitPrice * item.quantity, item.currencyCode)}
        </td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${saleNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; background: #fff; color: #111; }
    @page { size: 80mm auto; margin: 4mm; }
    .header { background: #004741 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;
              color: #fff; text-align: center; padding: 12px 16px 10px; }
    .header .brand { color: #C4A44C; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .header .branch { font-size: 14px; font-weight: 700; margin-top: 2px; }
    .header .address { font-size: 10px; opacity: 0.75; margin-top: 2px; }
    .body { padding: 10px 14px; }
    .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-bottom: 10px; }
    .meta .label { font-weight: 600; color: #111; }
    .divider { border: none; border-top: 1px dashed #bbb; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    thead th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
               color: #555; padding-bottom: 4px; }
    thead th:first-child { text-align: left; }
    thead th:not(:first-child) { text-align: right; }
    .totals { font-size: 12px; }
    .totals tr td { padding: 2px 0; }
    .totals .total-row td { font-size: 14px; font-weight: 700; padding-top: 4px; }
    .footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
    .footer .thanks { font-weight: 700; color: #111; font-size: 11px; margin-bottom: 3px; }
    .footer .powered { font-size: 9px; opacity: 0.5; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">MedLink Pharmacy</div>
    <div class="branch">${branchName}</div>
    ${branchAddress ? `<div class="address">${branchAddress}</div>` : ''}
  </div>
  <div class="body">
    <div class="meta">
      <div>
        <div><span class="label">Date:</span> ${dateStr}</div>
        <div><span class="label">Time:</span> ${timeStr}</div>
        <div><span class="label">Cashier:</span> ${cashierName}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;font-size:11px">${saleNumber}</div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Official Receipt</div>
      </div>
    </div>
    <hr class="divider">
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty × Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="divider">
    <table class="totals">
      <tr>
        <td style="color:#555">Subtotal</td>
        <td style="text-align:right">${formatCurrency(subtotal, currencyCode)}</td>
      </tr>
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right">${formatCurrency(total, currencyCode)}</td>
      </tr>
    </table>
    <hr class="divider">
    <table>
      <tr>
        <td style="color:#555;font-size:11px">Payment Method</td>
        <td style="text-align:right;font-weight:600;text-transform:capitalize;font-size:11px">${methodLabel}</td>
      </tr>
      ${amountTendered !== null ? `<tr>
        <td style="color:#555;font-size:11px">Amount Tendered</td>
        <td style="text-align:right;font-size:11px">${formatCurrency(amountTendered, currencyCode)}</td>
      </tr>` : ''}
      ${change !== null && change >= 0 ? `<tr>
        <td style="font-weight:700;color:#004741;font-size:11px">Change</td>
        <td style="text-align:right;font-weight:700;color:#004741;font-size:11px">${formatCurrency(change, currencyCode)}</td>
      </tr>` : ''}
    </table>
    <hr class="divider">
    <div class="footer">
      <div class="thanks">Thank you for your purchase!</div>
      <div>Goods sold are not returnable unless defective.</div>
      <div>Keep this receipt as proof of purchase.</div>
      <div class="powered">Powered by MedLink Cloud</div>
    </div>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); window.close(); }, 250); });<\/script>
</body>
</html>`)
    win.document.close()
    win.focus()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:bg-transparent print:p-0 print:inset-auto print:fixed-none">
      <div
        id="receipt-print"
        className="w-full max-w-xs rounded-xl border bg-white shadow-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-full"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 text-center" style={{ background: '#004741' }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#C4A44C' }}>
            MedLink Pharmacy
          </p>
          <p className="mt-0.5 text-base font-bold text-white">{branchName}</p>
          {branchAddress && (
            <p className="mt-0.5 text-[11px] text-white/70">{branchAddress}</p>
          )}
        </div>

        <div className="px-5 py-3">
          {/* Receipt meta */}
          <div className="flex items-start justify-between text-[11px] text-muted-foreground">
            <div>
              <p><span className="font-medium text-foreground">Date:</span> {dateStr}</p>
              <p><span className="font-medium text-foreground">Time:</span> {timeStr}</p>
              <p><span className="font-medium text-foreground">Cashier:</span> {cashierName}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-xs text-foreground">{saleNumber}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide">Official Receipt</p>
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-border" />

          {/* Column headers */}
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            <span>Item</span>
            <span className="shrink-0">Qty × Price</span>
            <span className="shrink-0 w-20 text-right">Amount</span>
          </div>

          {/* Line items */}
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <span className="flex-1 leading-tight">{item.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                  {item.quantity} × {formatCurrency(item.unitPrice, item.currencyCode)}
                </span>
                <span className="shrink-0 w-20 text-right font-mono font-medium">
                  {formatCurrency(item.unitPrice * item.quantity, item.currencyCode)}
                </span>
              </div>
            ))}
          </div>

          <div className="my-3 border-t border-dashed border-border" />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal, currencyCode)}</span>
            </div>
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span className="font-mono">{formatCurrency(total, currencyCode)}</span>
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-border" />

          {/* Payment */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium capitalize">{methodLabel}</span>
            </div>
            {amountTendered !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Tendered</span>
                <span className="font-mono">{formatCurrency(amountTendered, currencyCode)}</span>
              </div>
            )}
            {change !== null && change >= 0 && (
              <div className="flex justify-between font-semibold" style={{ color: '#004741' }}>
                <span>Change</span>
                <span className="font-mono">{formatCurrency(change, currencyCode)}</span>
              </div>
            )}
          </div>

          <div className="my-3 border-t border-dashed border-border" />

          {/* Footer */}
          <div className="text-center text-[10px] text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground text-xs">Thank you for your purchase!</p>
            <p>Goods sold are not returnable unless defective.</p>
            <p>Keep this receipt as proof of purchase.</p>
            <p className="mt-1 font-mono text-[9px] opacity-60">Powered by MedLink Cloud</p>
          </div>

          {/* Actions — hidden when printing */}
          <div className="mt-4 flex gap-2 print:hidden">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button size="sm" className="flex-1" onClick={onClose}>
              New Sale
            </Button>
          </div>
        </div>
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
      <p className="line-clamp-2 text-sm font-semibold leading-tight">{product.name}</p>
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

  const barcodeRef   = useRef<HTMLInputElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef   = useRef<any>(null)
  const scannedRef   = useRef(false)
  const [barcodeInput, setBarcodeInput]       = useState('')
  const [search, setSearch]                   = useState('')
  const [showPayment, setShowPayment]         = useState(false)
  const [showCartSheet, setShowCartSheet]     = useState(false)
  const [showCamera, setShowCamera]           = useState(false)
  const [cameraActive, setCameraActive]       = useState(false)
  const [cameraErr, setCameraErr]             = useState<string | null>(null)
  const [receipt, setReceipt] = useState<null | {
    saleNumber: string
    branchName: string
    branchAddress: string | null
    cashierName: string
    saleTime: string
    items: ReceiptItem[]
    subtotal: number
    total: number
    paymentMethod: string
    amountTendered: number | null
    change: number | null
    currencyCode: string
  }>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOutAction()
    // signOutAction redirects to /login — no further state needed
  }

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

  function stopPosCamera() {
    try { scannerRef.current?.reset() } catch { /* ignore */ }
    scannerRef.current = null
    setCameraActive(false)
    scannedRef.current = false
  }

  async function startPosCamera() {
    setCameraErr(null)
    scannedRef.current = false
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      scannerRef.current = reader
      if (!videoRef.current) return
      await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result && !scannedRef.current) {
          scannedRef.current = true
          stopPosCamera()
          setShowCamera(false)
          void handleBarcodeScan(result.getText())
        }
        if (err && err.name !== 'NotFoundException') {
          setCameraErr('Scanner error. Try typing the barcode instead.')
        }
      })
      setCameraActive(true)
    } catch {
      setCameraErr('Camera access denied. Please allow camera access.')
    }
  }

  function openPosCamera() {
    setShowCamera(true)
    setCameraErr(null)
    setCameraActive(false)
    // Small delay so the video element is mounted before starting
    setTimeout(() => { void startPosCamera() }, 150)
  }

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

        const cashChange = method === 'cash' && tendered !== null
          ? Math.max(0, tendered - totals.total)
          : null

        // Show receipt, then clear cart
        setReceipt({
          saleNumber,
          branchName:     activeBranch.name,
          branchAddress:  activeBranch.address ?? null,
          cashierName:    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Cashier',
          saleTime:       new Date().toISOString(),
          items: items.map(i => ({
            name:        i.medicationName,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
            currencyCode: i.currencyCode,
          })),
          subtotal:       totals.subtotal,
          total:          totals.total,
          paymentMethod:  method,
          amountTendered: tendered,
          change:         cashChange,
          currencyCode:   items[0]?.currencyCode ?? 'GHS',
        })
        clearCart()
      } finally {
        setIsCompleting(false)
      }
    },
    [activeBranch, organizationId, user, items, totals.total, totals.subtotal, clearCart]
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

        {/* Shift user + sign-out — always visible so any cashier can end their shift */}
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="max-w-[140px] truncate text-xs font-medium">
            {(user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Cashier'}
          </span>
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Sign out / end shift"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — product search */}
        <div className="flex flex-1 flex-col overflow-hidden border-r">
          {/* Barcode scanner — auto-focused; USB scanners send Enter after each scan */}
          <div className="border-b bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <Button
                variant="outline"
                size="icon"
                onClick={openPosCamera}
                title="Scan with camera"
                className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-100"
              >
                <Camera className="h-4 w-4" />
              </Button>
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

          <div className="flex-1 overflow-y-auto px-3 pb-3 md:pb-3 pb-24">
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

        {/* Right — cart (desktop only) */}
        <div className="hidden md:flex w-72 shrink-0 flex-col bg-card lg:w-80">
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
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 1) updateQty(item.medicationId, v)
                      }}
                      className="w-10 rounded border border-border bg-background text-center text-sm font-medium py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
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

      {/* Mobile cart bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-card shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-center text-sm text-muted-foreground">Cart is empty</div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setShowCartSheet(true)}
              className="flex flex-1 items-center gap-3 min-w-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs text-muted-foreground">View cart</p>
                <p className="text-sm font-bold text-primary">
                  {formatCurrency(totals.total, items[0]?.currencyCode ?? 'GHS')}
                </p>
              </div>
            </button>
            <Button
              size="sm"
              className="shrink-0 px-6"
              onClick={() => setShowPayment(true)}
              disabled={isCompleting}
            >
              {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay'}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile cart sheet */}
      {showCartSheet && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCartSheet(false)}
          />
          <div className="relative flex max-h-[80vh] flex-col rounded-t-2xl bg-card shadow-2xl">
            {/* Sheet header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold">Cart</span>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <button
                onClick={() => setShowCartSheet(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.map(item => (
                <div
                  key={item.medicationId}
                  className="flex items-start gap-2 rounded-lg border bg-background p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{item.medicationName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(item.unitPrice, item.currencyCode)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(item.medicationId, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded border hover:bg-accent"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 1) updateQty(item.medicationId, v)
                      }}
                      className="w-10 rounded border border-border bg-background text-center text-sm font-medium py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => updateQty(item.medicationId, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded border hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeItem(item.medicationId)}
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals + actions */}
            <div className="border-t p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatCurrency(totals.subtotal, items[0]?.currencyCode ?? 'GHS')}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="font-mono text-primary">{formatCurrency(totals.total, items[0]?.currencyCode ?? 'GHS')}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { clearCart(); setShowCartSheet(false) }}>
                  Clear
                </Button>
                <Button className="flex-1" onClick={() => { setShowCartSheet(false); setShowPayment(true) }}>
                  Pay
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showPayment && items.length > 0 && (
        <PaymentDialog
          total={totals.total}
          currencyCode={items[0]?.currencyCode ?? 'GHS'}
          onCancel={() => setShowPayment(false)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {/* Camera scanner dialog */}
      <Dialog open={showCamera} onOpenChange={open => { if (!open) { stopPosCamera(); setShowCamera(false) } }}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-primary" />
              Scan to Add
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {cameraActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-28 w-56 rounded border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                </div>
              )}
              {!cameraActive && !cameraErr && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                </div>
              )}
            </div>
            {cameraActive && (
              <p className="text-center text-xs text-muted-foreground">
                Hold barcode steady inside the frame — item adds to cart automatically
              </p>
            )}
            {cameraErr && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraErr}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => { stopPosCamera(); setShowCamera(false) }}>
              <CameraOff className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {receipt && (
        <Receipt
          saleNumber={receipt.saleNumber}
          branchName={receipt.branchName}
          branchAddress={receipt.branchAddress}
          cashierName={receipt.cashierName}
          saleTime={receipt.saleTime}
          items={receipt.items}
          subtotal={receipt.subtotal}
          total={receipt.total}
          paymentMethod={receipt.paymentMethod}
          amountTendered={receipt.amountTendered}
          change={receipt.change}
          currencyCode={receipt.currencyCode}
          onClose={handleCloseReceipt}
        />
      )}

      {/* Sign-out / end-shift confirmation */}
      <Dialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-destructive" />
              End shift &amp; sign out?
            </DialogTitle>
            <DialogDescription>
              {pendingCount > 0
                ? `You have ${pendingCount} sale${pendingCount !== 1 ? 's' : ''} waiting to sync. They are saved locally and will upload automatically when the next cashier signs in and goes online.`
                : 'Any unsynced sales are saved locally and will upload when you next sign in.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSignOutConfirm(false)} disabled={signingOut}>
              Stay signed in
            </Button>
            <Button variant="destructive" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
