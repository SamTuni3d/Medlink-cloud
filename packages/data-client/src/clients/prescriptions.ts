import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  PrescriptionSchema,
  PrescriptionItemSchema,
  PrescriptionWithItemsSchema,
  PrescriptionInsertSchema,
  DispensePrescriptionSchema,
  type Prescription,
  type PrescriptionWithItems,
  type PrescriptionInsert,
  type DispensePrescriptionInput,
  type PrescriptionStatus,
} from '../schemas/prescriptions'

export interface GetPrescriptionsOptions {
  status?: PrescriptionStatus
  search?: string
  limit?: number
  offset?: number
}

export async function getPrescriptions(
  client: SupabaseClient,
  branchId: string,
  opts: GetPrescriptionsOptions = {}
): Promise<Result<Prescription[]>> {
  try {
    let query = client
      .from('prescriptions')
      .select(
        'id,organization_id,branch_id,rx_number,patient_name,patient_dob,' +
        'patient_phone,prescriber_name,prescriber_license,prescriber_phone,' +
        'diagnosis,status,notes,issued_date,expiry_date,dispensed_by,' +
        'dispensed_at,created_by,created_at,updated_at'
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (opts.status) query = query.eq('status', opts.status)
    if (opts.search) {
      query = query.or(
        `patient_name.ilike.%${opts.search}%,` +
        `prescriber_name.ilike.%${opts.search}%,` +
        `rx_number.ilike.%${opts.search}%`
      )
    }

    const limit = Math.min(opts.limit ?? 50, 200)
    query = query.limit(limit)
    if (opts.offset) query = query.range(opts.offset, opts.offset + limit - 1)

    const { data, error } = await query
    if (error) return err(toAppError(error))

    const parsed = z.array(PrescriptionSchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getPrescription(
  client: SupabaseClient,
  id: string
): Promise<Result<PrescriptionWithItems>> {
  try {
    const { data: rx, error: rxError } = await client
      .from('prescriptions')
      .select(
        'id,organization_id,branch_id,rx_number,patient_name,patient_dob,' +
        'patient_phone,prescriber_name,prescriber_license,prescriber_phone,' +
        'diagnosis,status,notes,issued_date,expiry_date,dispensed_by,' +
        'dispensed_at,created_by,created_at,updated_at'
      )
      .eq('id', id)
      .single()

    if (rxError) return err(toAppError(rxError))

    const { data: items, error: itemsError } = await client
      .from('prescription_items')
      .select(
        'id,prescription_id,organization_id,medication_id,medication_name,' +
        'quantity_prescribed,quantity_dispensed,dosage_instructions,' +
        'duration_days,status,sale_id,created_at,updated_at'
      )
      .eq('prescription_id', id)
      .order('created_at', { ascending: true })

    if (itemsError) return err(toAppError(itemsError))

    const parsed = PrescriptionWithItemsSchema.safeParse({ ...(rx as object), items: items ?? [] })
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function createPrescription(
  client: SupabaseClient,
  organizationId: string,
  userId: string,
  input: PrescriptionInsert
): Promise<Result<{ id: string; rx_number: string }>> {
  try {
    const validated = PrescriptionInsertSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    // Generate Rx number via RPC
    const { data: rxNumber, error: rxError } = await client
      .rpc('fn_next_rx_number', { p_organization_id: organizationId })
    if (rxError) return err(toAppError(rxError))

    const d = validated.data

    const { data: rx, error: insertError } = await client
      .from('prescriptions')
      .insert({
        organization_id: organizationId,
        branch_id: d.branch_id,
        rx_number: rxNumber as string,
        patient_name: d.patient_name,
        patient_dob: d.patient_dob ?? null,
        patient_phone: d.patient_phone ?? null,
        prescriber_name: d.prescriber_name,
        prescriber_license: d.prescriber_license ?? null,
        prescriber_phone: d.prescriber_phone ?? null,
        diagnosis: d.diagnosis ?? null,
        notes: d.notes ?? null,
        issued_date: d.issued_date,
        expiry_date: d.expiry_date ?? null,
        created_by: userId,
      })
      .select('id,rx_number')
      .single()

    if (insertError) return err(toAppError(insertError))

    const { id } = rx as { id: string; rx_number: string }

    const itemRows = d.items.map(item => ({
      prescription_id: id,
      organization_id: organizationId,
      medication_id: item.medication_id,
      medication_name: item.medication_name,
      quantity_prescribed: item.quantity_prescribed,
      dosage_instructions: item.dosage_instructions ?? null,
      duration_days: item.duration_days ?? null,
    }))

    const { error: itemsError } = await client
      .from('prescription_items')
      .insert(itemRows)

    if (itemsError) return err(toAppError(itemsError))

    return ok({ id, rx_number: (rx as { id: string; rx_number: string }).rx_number })
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function dispensePrescription(
  client: SupabaseClient,
  userId: string,
  input: DispensePrescriptionInput
): Promise<Result<void>> {
  try {
    const validated = DispensePrescriptionSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { prescription_id, items } = validated.data

    // Fetch current items to validate quantities
    const { data: currentItems, error: fetchError } = await client
      .from('prescription_items')
      .select('id,quantity_prescribed,quantity_dispensed,status')
      .eq('prescription_id', prescription_id)
      .in('id', items.map(i => i.item_id))

    if (fetchError) return err(toAppError(fetchError))

    // Update each item's dispensed quantity
    for (const dispenseItem of items) {
      const current = (currentItems as Array<{
        id: string
        quantity_prescribed: number
        quantity_dispensed: number
        status: string
      }>).find(ci => ci.id === dispenseItem.item_id)

      if (!current) continue

      const newDispensed = current.quantity_dispensed + dispenseItem.quantity_to_dispense
      const newStatus = newDispensed >= current.quantity_prescribed ? 'dispensed' : 'partial'

      const { error: updateError } = await client
        .from('prescription_items')
        .update({ quantity_dispensed: newDispensed, status: newStatus })
        .eq('id', dispenseItem.item_id)

      if (updateError) return err(toAppError(updateError))
    }

    // Recalculate prescription status based on items
    const { data: allItems, error: allError } = await client
      .from('prescription_items')
      .select('status')
      .eq('prescription_id', prescription_id)
      .neq('status', 'cancelled')

    if (allError) return err(toAppError(allError))

    const statuses = (allItems as Array<{ status: string }>).map(i => i.status)
    let newPrescriptionStatus: PrescriptionStatus = 'partially_dispensed'
    if (statuses.every(s => s === 'dispensed')) {
      newPrescriptionStatus = 'dispensed'
    } else if (statuses.every(s => s === 'pending')) {
      newPrescriptionStatus = 'pending'
    }

    const updatePayload: Record<string, unknown> = { status: newPrescriptionStatus }
    if (newPrescriptionStatus === 'dispensed') {
      updatePayload.dispensed_by = userId
      updatePayload.dispensed_at = new Date().toISOString()
    }

    const { error: rxUpdateError } = await client
      .from('prescriptions')
      .update(updatePayload)
      .eq('id', prescription_id)

    if (rxUpdateError) return err(toAppError(rxUpdateError))

    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function cancelPrescription(
  client: SupabaseClient,
  id: string
): Promise<Result<void>> {
  try {
    const { error } = await client
      .from('prescriptions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .in('status', ['pending', 'partially_dispensed'])

    if (error) return err(toAppError(error))
    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}
