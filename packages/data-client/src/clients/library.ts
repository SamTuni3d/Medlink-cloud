import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ok, err, type Result } from '../lib/result'
import { toAppError } from '../lib/errors'
import {
  LibraryEntrySchema,
  LibraryCategorySummarySchema,
  SuggestMedicationSchema,
  type LibraryEntry,
  type LibraryEntryWithStatus,
  type LibraryCategorySummary,
  type ImportItem,
  type SuggestMedicationInput,
  type LibrarySubmissionResult,
} from '../schemas/library'

export interface SearchLibraryParams {
  query?: string
  category?: string
  organizationId: string
  limit?: number
  offset?: number
}

export interface ImportFromLibraryResult {
  created: number
  skipped: number
  errors: string[]
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function searchLibrary(
  client: SupabaseClient,
  params: SearchLibraryParams
): Promise<Result<LibraryEntryWithStatus[]>> {
  try {
    const { query, category, organizationId, limit = 50, offset = 0 } = params

    let q = client
      .from('medications_library')
      .select('*')
      .eq('status', 'approved')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (query && query.trim()) {
      const like = `%${query.trim()}%`
      q = q.or(`name.ilike.${like},generic_name.ilike.${like},brand_name.ilike.${like}`)
    }
    if (category) {
      q = q.eq('category', category)
    }

    const { data, error } = await q
    if (error) return err(toAppError(error))

    const parsed = z.array(LibraryEntrySchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    // Determine which library entries the org has already imported
    const ids = parsed.data.map(e => e.id)
    const { data: imported } = await client
      .from('medications_master')
      .select('library_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .in('library_id', ids)

    const importedSet = new Set(
      (imported ?? []).map((r: { library_id: string | null }) => r.library_id).filter(Boolean)
    )

    return ok(
      parsed.data.map(entry => ({
        ...entry,
        already_imported: importedSet.has(entry.id),
      }))
    )
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getLibraryByCategory(
  client: SupabaseClient,
  params: SearchLibraryParams
): Promise<Result<LibraryEntryWithStatus[]>> {
  return searchLibrary(client, params)
}

export async function getLibraryCategorySummary(
  client: SupabaseClient
): Promise<Result<LibraryCategorySummary[]>> {
  try {
    const { data, error } = await client
      .from('medications_library')
      .select('category')
      .eq('status', 'approved')
      .not('category', 'is', null)

    if (error) return err(toAppError(error))

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const cat = (row as { category: string }).category
      counts[cat] = (counts[cat] ?? 0) + 1
    }

    const summaries = Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category))

    const parsed = z.array(LibraryCategorySummarySchema).safeParse(summaries)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getPendingSuggestions(
  client: SupabaseClient
): Promise<Result<LibraryEntry[]>> {
  try {
    const { data, error } = await client
      .from('medications_library')
      .select('id, name, generic_name, brand_name, category, dosage_form, strength, barcode, unit_of_measure, requires_prescription, source, status, times_used, nafdac_number, ghana_fda_code, tags, is_verified, suggested_by, reviewed_by, reviewed_at, rejection_note, created_at')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })

    if (error) return err(toAppError(error))

    const parsed = z.array(LibraryEntrySchema).safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function getPendingSuggestionsCount(
  client: SupabaseClient
): Promise<Result<number>> {
  try {
    const { count, error } = await client
      .from('medications_library')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review')

    if (error) return err(toAppError(error))
    return ok(count ?? 0)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function searchLibraryByBarcode(
  client: SupabaseClient,
  barcode: string
): Promise<Result<LibraryEntry | null>> {
  try {
    const { data, error } = await client
      .from('medications_library')
      .select('*')
      .eq('status', 'approved')
      .eq('barcode', barcode.trim())
      .maybeSingle()

    if (error) return err(toAppError(error))
    if (!data) return ok(null)

    const parsed = LibraryEntrySchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function importFromLibrary(
  client: SupabaseClient,
  input: {
    organizationId: string
    branchId: string
    userId: string
    currencyCode: string
    items: ImportItem[]
  }
): Promise<Result<ImportFromLibraryResult>> {
  const { organizationId, branchId, userId, currencyCode, items } = input
  const result: ImportFromLibraryResult = { created: 0, skipped: 0, errors: [] }

  for (const item of items) {
    try {
      // Fetch library entry
      const { data: libEntry, error: libErr } = await client
        .from('medications_library')
        .select('*')
        .eq('id', item.libraryId)
        .single()

      if (libErr || !libEntry) {
        result.errors.push(`Library entry ${item.libraryId} not found`)
        continue
      }

      const entry = libEntry as LibraryEntry

      // Check if already imported for this org
      const { data: existing } = await client
        .from('medications_master')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('library_id', entry.id)
        .eq('is_active', true)
        .maybeSingle()

      let medicationId: string

      if (existing) {
        // Already exists — just ensure inventory row exists for this branch
        medicationId = (existing as { id: string }).id
        result.skipped++
      } else {
        // Create medications_master row
        const { data: med, error: medErr } = await client
          .from('medications_master')
          .insert({
            organization_id:      organizationId,
            library_id:           entry.id,
            name:                 entry.name,
            generic_name:         entry.generic_name,
            brand_name:           entry.brand_name,
            category:             entry.category,
            dosage_form:          entry.dosage_form ?? 'Other',
            strength:             entry.strength,
            barcode:              entry.barcode,
            unit_of_measure:      'units',
            requires_prescription: false,
            reorder_point:        item.reorderPoint ?? 10,
            reorder_quantity:     Math.max(item.reorderPoint ?? 10, 10),
            selling_price:        item.sellingPrice,
            currency_code:        currencyCode,
            is_active:            true,
          })
          .select('id')
          .single()

        if (medErr || !med) {
          result.errors.push(`Failed to create ${entry.name}: ${medErr?.message ?? 'unknown error'}`)
          continue
        }

        medicationId = (med as { id: string }).id
        result.created++

        // Increment the library's usage counter (fire-and-forget; failure is non-fatal)
        void client.rpc('increment_library_times_used', { p_library_id: entry.id })
      }

      // Ensure inventory row exists for this branch
      // onConflict must match the table's actual UNIQUE constraint: (branch_id, medication_id)
      await client
        .from('inventory')
        .upsert(
          { organization_id: organizationId, branch_id: branchId, medication_id: medicationId },
          { onConflict: 'branch_id,medication_id', ignoreDuplicates: true }
        )

      // If opening stock was specified, create a batch + stock movement.
      // The trigger trg_stock_movement_update_inventory fires on the movement
      // insert and updates inventory.current_stock — never set it directly.
      if ((item.openingStock ?? 0) > 0) {
        const { data: batch } = await client
          .from('inventory_batches')
          .insert({
            organization_id:    organizationId,
            branch_id:          branchId,
            medication_id:      medicationId,
            batch_number:       `OPEN-${Date.now()}`,
            quantity_received:  item.openingStock,
            quantity_remaining: item.openingStock,
            cost_price:         item.purchasePrice ?? 0,
            currency_code:      currencyCode,
            created_by:         userId,
          })
          .select('id')
          .single()

        if (batch) {
          await client
            .from('stock_movements')
            .insert({
              organization_id: organizationId,
              branch_id:       branchId,
              medication_id:   medicationId,
              batch_id:        (batch as { id: string }).id,
              movement_type:   'opening_stock',
              delta:           item.openingStock,
              notes:           'Opening stock from library import',
              performed_by:    userId,
            })
        }
      }
    } catch (e) {
      result.errors.push(`Unexpected error for item ${item.libraryId}`)
    }
  }

  return ok(result)
}

export async function suggestMedication(
  client: SupabaseClient,
  input: SuggestMedicationInput & { suggestedBy: string }
): Promise<Result<LibraryEntry>> {
  try {
    const validated = SuggestMedicationSchema.safeParse(input)
    if (!validated.success) return err(toAppError(validated.error))

    const { data, error } = await client
      .from('medications_library')
      .insert({
        ...validated.data,
        is_verified:  false,
        suggested_by: input.suggestedBy,
      })
      .select()
      .single()

    if (error) return err(toAppError(error))

    const parsed = LibraryEntrySchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))

    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function approveSuggestion(
  client: SupabaseClient,
  input: { libraryId: string; reviewerId: string }
): Promise<Result<void>> {
  try {
    const { error } = await client
      .from('medications_library')
      .update({
        status:         'approved',
        reviewed_by:    input.reviewerId,
        reviewed_at:    new Date().toISOString(),
        rejection_note: null,
      })
      .eq('id', input.libraryId)
      .eq('status', 'pending_review')

    if (error) return err(toAppError(error))
    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}

export async function rejectSuggestion(
  client: SupabaseClient,
  input: { libraryId: string; reviewerId: string; note: string }
): Promise<Result<void>> {
  try {
    const { error } = await client
      .from('medications_library')
      .update({
        status:         'rejected',
        reviewed_by:    input.reviewerId,
        reviewed_at:    new Date().toISOString(),
        rejection_note: input.note,
      })
      .eq('id', input.libraryId)
      .eq('status', 'pending_review')

    if (error) return err(toAppError(error))
    return ok(undefined)
  } catch (e) {
    return err(toAppError(e))
  }
}

// ── Crowdsourced submission ───────────────────────────────────────────────────

export interface SubmitToLibraryInput {
  name: string
  genericName?: string | null
  brandName?: string | null
  category?: string | null
  dosageForm?: string | null
  strength?: string | null
  organizationId: string
}

export async function submitToLibrary(
  client: SupabaseClient,
  input: SubmitToLibraryInput
): Promise<Result<LibrarySubmissionResult>> {
  try {
    const { data, error } = await client.rpc('submit_to_library', {
      p_name:            input.name,
      p_generic_name:    input.genericName   ?? null,
      p_brand_name:      input.brandName     ?? null,
      p_category:        input.category      ?? null,
      p_dosage_form:     input.dosageForm    ?? null,
      p_strength:        input.strength      ?? null,
      p_organization_id: input.organizationId,
    })

    if (error) return err(toAppError(error))
    return ok(data as LibrarySubmissionResult)
  } catch (e) {
    return err(toAppError(e))
  }
}
