import type { SupabaseClient } from '@supabase/supabase-js'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import { MedicationCounselingSchema, type MedicationCounseling, type UpsertCounselingInput } from '../schemas/counseling'

export async function getMedicationCounseling(
  client: SupabaseClient,
  medicationId: string
): Promise<Result<MedicationCounseling | null>> {
  try {
    const { data, error } = await client
      .from('medication_counseling')
      .select(
        'id, medication_id, organization_id, purpose, dosage_instructions, frequency, duration, how_to_take, missed_dose, expected_benefits, common_side_effects, serious_side_effects, warnings_precautions, drug_interactions, food_alcohol, storage_instructions, monitoring_required, contact_doctor_when, adherence_note, created_at, updated_at'
      )
      .eq('medication_id', medicationId)
      .maybeSingle()

    if (error) return err(toAppError(error))
    if (!data) return ok(null)

    const parsed = MedicationCounselingSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function upsertMedicationCounseling(
  client: SupabaseClient,
  medicationId: string,
  organizationId: string,
  fields: UpsertCounselingInput
): Promise<Result<MedicationCounseling>> {
  try {
    const { data, error } = await client
      .from('medication_counseling')
      .upsert(
        { medication_id: medicationId, organization_id: organizationId, ...fields },
        { onConflict: 'medication_id' }
      )
      .select(
        'id, medication_id, organization_id, purpose, dosage_instructions, frequency, duration, how_to_take, missed_dose, expected_benefits, common_side_effects, serious_side_effects, warnings_precautions, drug_interactions, food_alcohol, storage_instructions, monitoring_required, contact_doctor_when, adherence_note, created_at, updated_at'
      )
      .single()

    if (error) return err(toAppError(error))

    const parsed = MedicationCounselingSchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
