import { z } from 'zod'

export const LibraryEntrySchema = z.object({
  id:                    z.string().uuid(),
  name:                  z.string(),
  generic_name:          z.string().nullable(),
  brand_name:            z.string().nullable(),
  category:              z.string().nullable(),
  dosage_form:           z.string().nullable(),
  strength:              z.string().nullable(),
  barcode:               z.string().nullable(),
  unit_of_measure:       z.string().nullable().optional(),
  requires_prescription: z.boolean().optional().default(false),
  source:                z.string().optional().default('seed'),
  status:                z.string().optional().default('approved'),
  nafdac_number:         z.string().nullable(),
  ghana_fda_code:        z.string().nullable(),
  tags:                  z.array(z.string()),
  is_verified:           z.boolean(),
  suggested_by:          z.string().nullable(),
  reviewed_by:           z.string().nullable(),
  reviewed_at:           z.string().nullable(),
  rejection_note:        z.string().nullable(),
  created_at:            z.string(),
})

export type LibraryEntry = z.infer<typeof LibraryEntrySchema>

export type LibraryEntryWithStatus = LibraryEntry & {
  already_imported: boolean
}

export const LibraryCategorySummarySchema = z.object({
  category: z.string(),
  count:    z.coerce.number(),
})

export type LibraryCategorySummary = z.infer<typeof LibraryCategorySummarySchema>

export const ImportItemSchema = z.object({
  libraryId:     z.string().uuid(),
  sellingPrice:  z.number().min(0.01, 'Selling price is required'),
  purchasePrice: z.number().min(0).optional(),
  reorderPoint:  z.number().int().min(0).default(10),
  openingStock:  z.number().int().min(0).default(0),
})

export type ImportItem = z.infer<typeof ImportItemSchema>

export const SuggestMedicationSchema = z.object({
  name:           z.string().min(1),
  generic_name:   z.string().nullable().optional(),
  brand_name:     z.string().nullable().optional(),
  category:       z.string().nullable().optional(),
  dosage_form:    z.string().nullable().optional(),
  strength:       z.string().nullable().optional(),
  barcode:        z.string().nullable().optional(),
  nafdac_number:  z.string().nullable().optional(),
  ghana_fda_code: z.string().nullable().optional(),
})

export type SuggestMedicationInput = z.infer<typeof SuggestMedicationSchema>
