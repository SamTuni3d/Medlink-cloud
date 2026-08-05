'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
} from '@medlink/data-client'
import type { Supplier } from '@medlink/data-client'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

async function resolveSession() {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  const { data: userRow } = await client
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!userRow) return null
  return { client, userId: user.id, organizationId: userRow.organization_id as string }
}

// ── Purchase Orders ────────────────────────────────────────────────────────────

const POItemSchema = z.object({
  medicationId: z.string().uuid(),
  quantityOrdered: z.number().int().min(1),
  unitCost: z.number().min(0),
  currencyCode: z.string().length(3),
  batchNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
})

const CreatePOSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  expectedDate: z.string().nullable().optional(),
  items: z.array(POItemSchema).min(1),
})

export async function createPurchaseOrderAction(
  input: z.infer<typeof CreatePOSchema>
): Promise<ActionResult<{ id: string; po_number: string }>> {
  const parsed = CreatePOSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await createPurchaseOrder(session.client, {
    organizationId: session.organizationId,
    branchId: parsed.data.branchId,
    supplierId: parsed.data.supplierId ?? null,
    notes: parsed.data.notes,
    expectedDate: parsed.data.expectedDate ?? null,
    createdBy: session.userId,
    items: parsed.data.items,
  })

  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/procurement')
  return { ok: true, data: result.data }
}

const ReceiveItemSchema = z.object({
  poItemId: z.string().uuid(),
  medicationId: z.string().uuid(),
  quantityReceived: z.number().int().min(0),
  unitCost: z.number().min(0),
  currencyCode: z.string().length(3),
  batchNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
})

const ReceivePOSchema = z.object({
  poId: z.string().uuid(),
  branchId: z.string().uuid(),
  items: z.array(ReceiveItemSchema).min(1),
})

export async function receivePurchaseOrderAction(
  input: z.infer<typeof ReceivePOSchema>
): Promise<ActionResult<{ received: number }>> {
  const parsed = ReceivePOSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await receivePurchaseOrder(session.client, parsed.data.poId, {
    organizationId: session.organizationId,
    branchId: parsed.data.branchId,
    performedBy: session.userId,
    items: parsed.data.items,
  })

  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/procurement')
  revalidatePath('/inventory')
  return { ok: true, data: result.data }
}

export async function cancelPurchaseOrderAction(poId: string): Promise<ActionResult> {
  if (!poId) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'PO ID required' } }
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await cancelPurchaseOrder(client, poId)
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/procurement')
  return { ok: true, data: undefined }
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

const SupplierBodySchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
})

export async function createSupplierAction(
  input: z.infer<typeof SupplierBodySchema>
): Promise<ActionResult<Supplier>> {
  const parsed = SupplierBodySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await createSupplier(session.client, {
    organization_id: session.organizationId,
    name: parsed.data.name,
    contact_name: parsed.data.contact_name?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    email: parsed.data.email?.trim() || null,
    address: parsed.data.address?.trim() || null,
  })

  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/procurement')
  return { ok: true, data: result.data }
}

const UpdateSupplierSchema = SupplierBodySchema.extend({ id: z.string().uuid() })

export async function updateSupplierAction(
  input: z.infer<typeof UpdateSupplierSchema>
): Promise<ActionResult<Supplier>> {
  const parsed = UpdateSupplierSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const { id, ...body } = parsed.data
  const result = await updateSupplier(client, id, {
    name: body.name,
    contact_name: body.contact_name?.trim() || null,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    address: body.address?.trim() || null,
  })

  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/procurement')
  return { ok: true, data: result.data }
}

export async function softDeleteSupplierAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Supplier ID required' } }
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }

  const result = await softDeleteSupplier(client, id)
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/procurement')
  return { ok: true, data: undefined }
}
