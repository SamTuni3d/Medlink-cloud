'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addMedicationWithStock, updateMedication } from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

// ── Update selling price ───────────────────────────────────────────────────────

const UpdatePriceSchema = z.object({
  medicationId: z.string().uuid(),
  price: z.number().min(0),
})

export async function updateMedicationPriceAction(
  medicationId: string,
  price: number
): Promise<ActionResult> {
  const parsed = UpdatePriceSchema.safeParse({ medicationId, price })
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid price value.' } }
  }

  const result = await updateMedication(await createClient(), parsed.data.medicationId, {
    selling_price: parsed.data.price,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { ok: true, data: undefined }
}

// ── Ensure every org medication has an inventory row for the branch ───────────
// Idempotent repair: called on every inventory page load so any rows that were
// silently skipped (e.g. wrong onConflict in an older import) get created now.

export async function ensureBranchInventoryAction(
  organizationId: string,
  branchId: string
): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: meds } = await supabase
      .from('medications_master')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (!meds?.length) return

    await supabase
      .from('inventory')
      .upsert(
        meds.map((m: { id: string }) => ({
          organization_id: organizationId,
          branch_id:       branchId,
          medication_id:   m.id,
        })),
        { onConflict: 'branch_id,medication_id', ignoreDuplicates: true }
      )
  } catch {
    // Non-critical: log and continue — inventory read still proceeds
  }
}

// ── Add medication with opening stock ─────────────────────────────────────────

const AddMedicationSchema = z.object({
  organizationId: z.string().uuid(),
  branchId:       z.string().uuid(),
  performedBy:    z.string().uuid(),
  name:           z.string().min(1, 'Product name is required.'),
  genericName:    z.string().nullable().optional(),
  brandName:      z.string().nullable().optional(),
  category:       z.string().nullable().optional(),
  strength:       z.string().nullable().optional(),
  dosageForm:     z.string().nullable().optional(),
  barcode:        z.string().nullable().optional(),
  reorderPoint:   z.number().min(0).default(10),
  sellingPrice:   z.number().min(0).default(0),
  currencyCode:   z.string().default('GHS'),
  batchNumber:    z.string().nullable().optional(),
  expiryDate:     z.string().nullable().optional(),
  purchasePrice:  z.number().min(0).default(0),
  qtyInStock:     z.number().min(0).default(0),
})

export async function addMedicationAction(
  input: z.infer<typeof AddMedicationSchema>
): Promise<ActionResult<{ medicationId: string }>> {
  const parsed = AddMedicationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const result = await addMedicationWithStock(await createClient(), {
    organizationId: parsed.data.organizationId,
    branchId:       parsed.data.branchId,
    performedBy:    parsed.data.performedBy,
    name:           parsed.data.name,
    genericName:    parsed.data.genericName,
    brandName:      parsed.data.brandName,
    category:       parsed.data.category,
    strength:       parsed.data.strength,
    dosageForm:     parsed.data.dosageForm,
    barcode:        parsed.data.barcode,
    reorderPoint:   parsed.data.reorderPoint,
    sellingPrice:   parsed.data.sellingPrice,
    currencyCode:   parsed.data.currencyCode,
    batchNumber:    parsed.data.batchNumber,
    expiryDate:     parsed.data.expiryDate,
    purchasePrice:  parsed.data.purchasePrice,
    qtyInStock:     parsed.data.qtyInStock,
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { ok: true, data: result.data }
}

// ── Update medication details (price + reorder point) ─────────────────────────

const UpdateDetailsSchema = z.object({
  medicationId: z.string().uuid(),
  sellingPrice: z.number().min(0),
  reorderPoint: z.number().int().min(0),
})

export async function updateMedicationDetailsAction(
  input: z.infer<typeof UpdateDetailsSchema>
): Promise<ActionResult> {
  const parsed = UpdateDetailsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('medications_master')
    .update({ selling_price: parsed.data.sellingPrice, reorder_point: parsed.data.reorderPoint })
    .eq('id', parsed.data.medicationId)

  if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { ok: true, data: undefined }
}

// ── Adjust stock (inserts a stock_movement; trigger updates current_stock) ─────

const AdjustStockSchema = z.object({
  medicationId:   z.string().uuid(),
  branchId:       z.string().uuid(),
  organizationId: z.string().uuid(),
  performedBy:    z.string().uuid(),
  delta:          z.number().int(),
  notes:          z.string().default('Manual stock adjustment'),
})

export async function adjustStockAction(
  input: z.infer<typeof AdjustStockSchema>
): Promise<ActionResult> {
  const parsed = AdjustStockSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }
  }
  if (parsed.data.delta === 0) return { ok: true, data: undefined }

  const supabase = await createClient()
  const { error } = await supabase.from('stock_movements').insert({
    organization_id: parsed.data.organizationId,
    branch_id:       parsed.data.branchId,
    medication_id:   parsed.data.medicationId,
    movement_type:   'adjustment',
    delta:           parsed.data.delta,
    notes:           parsed.data.notes,
    performed_by:    parsed.data.performedBy,
  })

  if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { ok: true, data: undefined }
}

// ── Deactivate medication (soft delete — hides from inventory + POS) ──────────

export async function deactivateMedicationAction(
  medicationId: string
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(medicationId)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid medication ID.' } }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('medications_master')
    .update({ is_active: false })
    .eq('id', parsed.data)

  if (error) return { ok: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { ok: true, data: undefined }
}
