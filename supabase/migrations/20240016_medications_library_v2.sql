-- ============================================================
-- Migration 016: Medications Library V2
-- Adds unit_of_measure, requires_prescription, source,
-- submitted_by_org_id, status columns; pg_trgm fuzzy search
-- index; unique drug constraint; updated RLS policies.
-- ============================================================

BEGIN;

-- 1. Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add new columns
ALTER TABLE public.medications_library
  ADD COLUMN IF NOT EXISTS unit_of_measure       TEXT,
  ADD COLUMN IF NOT EXISTS requires_prescription  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source                TEXT        NOT NULL DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS submitted_by_org_id   UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status                TEXT        NOT NULL DEFAULT 'approved';

-- 3. Check constraints
ALTER TABLE public.medications_library
  ADD CONSTRAINT chk_library_status CHECK (status IN ('approved', 'pending_review', 'rejected')),
  ADD CONSTRAINT chk_library_source CHECK (source IN ('seed', 'import', 'suggested'));

-- 4. Populate status from existing is_verified
UPDATE public.medications_library
SET status = CASE
  WHEN is_verified = true                              THEN 'approved'
  WHEN is_verified = false AND reviewed_at IS NOT NULL THEN 'rejected'
  ELSE 'pending_review'
END;

-- 5. Trigger: keep is_verified in sync with status (backward compat for existing queries)
CREATE OR REPLACE FUNCTION public.trg_sync_library_is_verified()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_verified := (NEW.status = 'approved');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_library_verified
  BEFORE INSERT OR UPDATE OF status
  ON public.medications_library
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_library_is_verified();

-- 6. Remove duplicate rows before creating the unique index.
--    Keep the row with the most data (has generic_name) or earliest created_at.
DELETE FROM public.medications_library
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY
               lower(name),
               lower(COALESCE(dosage_form, '')),
               lower(COALESCE(strength, ''))
             ORDER BY
               (generic_name IS NOT NULL) DESC,
               created_at ASC
           ) AS rn
    FROM public.medications_library
  ) sub
  WHERE rn > 1
);

-- 7. Unique index — prevents duplicate (name + form + strength) entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_library_unique_drug
  ON public.medications_library (
    lower(name),
    lower(COALESCE(dosage_form, '')),
    lower(COALESCE(strength, ''))
  );

-- 8. GIN trigram index for fast fuzzy name search
CREATE INDEX IF NOT EXISTS idx_medications_library_name_trgm
  ON public.medications_library USING GIN (name gin_trgm_ops);

-- 9. Status and barcode indexes for filtered lookups
CREATE INDEX IF NOT EXISTS idx_medications_library_status
  ON public.medications_library (status);

CREATE INDEX IF NOT EXISTS idx_medications_library_barcode
  ON public.medications_library (barcode)
  WHERE barcode IS NOT NULL;

-- 10. Replace old is_verified-based RLS with status-based policies
DROP POLICY IF EXISTS "library_select"  ON public.medications_library;
DROP POLICY IF EXISTS "library_suggest" ON public.medications_library;
DROP POLICY IF EXISTS "library_review"  ON public.medications_library;

-- Any authenticated user sees all approved entries (open library)
CREATE POLICY "library_select" ON public.medications_library
  FOR SELECT USING (
    status = 'approved'
    OR suggested_by        = auth.uid()
    OR submitted_by_org_id = get_user_organization_id()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- Authenticated users can suggest a medication
CREATE POLICY "library_suggest" ON public.medications_library
  FOR INSERT WITH CHECK (
    status       = 'pending_review'
    AND suggested_by = auth.uid()
  );

-- Only super_admin can approve / reject
CREATE POLICY "library_review" ON public.medications_library
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

COMMIT;
