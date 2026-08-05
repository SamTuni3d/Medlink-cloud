import { z } from 'zod'

export const MedicationCounselingSchema = z.object({
  id:                   z.string().uuid(),
  medication_id:        z.string().uuid(),
  organization_id:      z.string().uuid(),

  purpose:              z.string().nullable(),
  dosage_instructions:  z.string().nullable(),
  frequency:            z.string().nullable(),
  duration:             z.string().nullable(),
  how_to_take:          z.string().nullable(),
  missed_dose:          z.string().nullable(),
  expected_benefits:    z.string().nullable(),
  common_side_effects:  z.string().nullable(),
  serious_side_effects: z.string().nullable(),
  warnings_precautions: z.string().nullable(),
  drug_interactions:    z.string().nullable(),
  food_alcohol:         z.string().nullable(),
  storage_instructions: z.string().nullable(),
  monitoring_required:  z.string().nullable(),
  contact_doctor_when:  z.string().nullable(),
  adherence_note:       z.string().nullable(),

  created_at:           z.string(),
  updated_at:           z.string(),
})

export type MedicationCounseling = z.infer<typeof MedicationCounselingSchema>

export const UpsertCounselingSchema = MedicationCounselingSchema
  .pick({
    purpose:              true,
    dosage_instructions:  true,
    frequency:            true,
    duration:             true,
    how_to_take:          true,
    missed_dose:          true,
    expected_benefits:    true,
    common_side_effects:  true,
    serious_side_effects: true,
    warnings_precautions: true,
    drug_interactions:    true,
    food_alcohol:         true,
    storage_instructions: true,
    monitoring_required:  true,
    contact_doctor_when:  true,
    adherence_note:       true,
  })
  .partial()

export type UpsertCounselingInput = z.infer<typeof UpsertCounselingSchema>
