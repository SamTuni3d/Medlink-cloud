'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createMedication,
  updateMedication,
  deleteMedication,
  importFromLibrary,
  submitToLibrary,
  ImportItemSchema,
  upsertMedicationCounseling,
  UpsertCounselingSchema,
} from '@medlink/data-client'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

// ── Add custom medication ─────────────────────────────────────────────────────

const AddCustomSchema = z.object({
  organizationId:        z.string().uuid(),
  name:                  z.string().min(1, 'Name is required'),
  genericName:           z.string().optional(),
  category:              z.string().optional(),
  dosageForm:            z.string().min(1, 'Dosage form is required'),
  strength:              z.string().optional(),
  unitOfMeasure:         z.string().min(1, 'Unit is required'),
  sellingPrice:          z.coerce.number().min(0),
  currencyCode:          z.string().length(3).default('GHS'),
  requiresPrescription:  z.boolean().default(false),
  reorderPoint:          z.coerce.number().int().min(0).default(0),
  reorderQuantity:       z.coerce.number().int().min(1).default(1),
})

export async function addCustomMedicationAction(
  input: z.infer<typeof AddCustomSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddCustomSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const { organizationId, genericName, dosageForm, strength, unitOfMeasure, sellingPrice, currencyCode, requiresPrescription, reorderPoint, reorderQuantity, ...rest } = parsed.data

  const result = await createMedication(await createClient(), {
    organization_id:       organizationId,
    name:                  rest.name,
    generic_name:          genericName ?? null,
    brand_name:            null,
    category:              rest.category ?? null,
    dosage_form:           dosageForm,
    strength:              strength ?? null,
    unit_of_measure:       unitOfMeasure,
    selling_price:         sellingPrice,
    currency_code:         currencyCode,
    requires_prescription: requiresPrescription,
    reorder_point:         reorderPoint,
    reorder_quantity:      reorderQuantity,
    barcode:               null,
  })

  if (!result.ok) return { ok: false, error: result.error }

  // Silently submit to global library for crowdsourcing — errors never block the save.
  // The RPC handles duplicate detection and rate-limiting server-side.
  void submitToLibrary(await createClient(), {
    name:           rest.name,
    genericName:    genericName ?? null,
    brandName:      null,
    category:       rest.category ?? null,
    dosageForm:     dosageForm,
    strength:       strength ?? null,
    organizationId,
  })

  revalidatePath('/medications')
  revalidatePath('/inventory')
  return { ok: true, data: { id: result.data.id } }
}

// ── Update medication price / details ─────────────────────────────────────────

const UpdateSchema = z.object({
  id:             z.string().uuid(),
  sellingPrice:   z.coerce.number().min(0).optional(),
  reorderPoint:   z.coerce.number().int().min(0).optional(),
  reorderQuantity: z.coerce.number().int().min(1).optional(),
  isActive:       z.boolean().optional(),
})

export async function updateMedicationAction(
  input: z.infer<typeof UpdateSchema>
): Promise<ActionResult> {
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const { id, sellingPrice, reorderPoint, reorderQuantity, isActive } = parsed.data

  const result = await updateMedication(await createClient(), id, {
    ...(sellingPrice  !== undefined && { selling_price:   sellingPrice }),
    ...(reorderPoint  !== undefined && { reorder_point:   reorderPoint }),
    ...(reorderQuantity !== undefined && { reorder_quantity: reorderQuantity }),
    ...(isActive      !== undefined && { is_active:       isActive }),
  })

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/medications')
  revalidatePath('/inventory')
  return { ok: true, data: undefined }
}

// ── Delete medication ─────────────────────────────────────────────────────────

export async function deleteMedicationAction(
  id: string
): Promise<ActionResult> {
  if (!id) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'ID is required' } }

  const result = await deleteMedication(await createClient(), id)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/medications')
  revalidatePath('/inventory')
  return { ok: true, data: undefined }
}

// ── Save medication counseling info sheet ──────────────────────────────────────

const CounselingActionSchema = z.object({
  medicationId:   z.string().uuid(),
  organizationId: z.string().uuid(),
  fields:         UpsertCounselingSchema,
})

export async function saveMedicationCounselingAction(
  input: z.infer<typeof CounselingActionSchema>
): Promise<ActionResult> {
  const parsed = CounselingActionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const { medicationId, organizationId, fields } = parsed.data
  const result = await upsertMedicationCounseling(await createClient(), medicationId, organizationId, fields)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/medications')
  return { ok: true, data: undefined }
}

// ── Import from global library ─────────────────────────────────────────────────

const ImportSchema = z.object({
  organizationId: z.string().uuid(),
  branchId:       z.string().uuid(),
  userId:         z.string().uuid(),
  currencyCode:   z.string().min(1).max(10).default('GHS'),
  items:          z.array(ImportItemSchema).min(1),
})

export async function importFromLibraryAction(
  input: z.infer<typeof ImportSchema>
): Promise<ActionResult<{ created: number; skipped: number; errors: string[] }>> {
  const parsed = ImportSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const result = await importFromLibrary(await createClient(), parsed.data)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/medications')
  revalidatePath('/inventory')
  return { ok: true, data: result.data }
}
