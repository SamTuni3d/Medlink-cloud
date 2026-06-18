-- ============================================================
-- Migration 015: Medications Library
-- Platform-wide drug catalogue that pharmacies browse and import
-- from instead of typing drug names manually.
-- ============================================================

BEGIN;

-- 1. Global library table (not org-scoped — platform-wide)
CREATE TABLE IF NOT EXISTS public.medications_library (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  generic_name    TEXT,
  brand_name      TEXT,
  category        TEXT,
  dosage_form     TEXT,
  strength        TEXT,
  barcode         TEXT,
  nafdac_number   TEXT,
  ghana_fda_code  TEXT,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  is_verified     BOOLEAN     NOT NULL DEFAULT false,
  suggested_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Link medications_master rows back to the library
ALTER TABLE public.medications_master
  ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES public.medications_library(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_medications_library_name     ON public.medications_library(lower(name));
CREATE INDEX IF NOT EXISTS idx_medications_library_category ON public.medications_library(category);
CREATE INDEX IF NOT EXISTS idx_medications_library_verified ON public.medications_library(is_verified);
CREATE INDEX IF NOT EXISTS idx_medications_master_library   ON public.medications_master(library_id);

-- 4. RLS — library is global; policies are role-based, not org-based
ALTER TABLE public.medications_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_select" ON public.medications_library
  FOR SELECT USING (
    is_verified = true
    OR suggested_by = auth.uid()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "library_suggest" ON public.medications_library
  FOR INSERT WITH CHECK (
    is_verified = false
    AND suggested_by = auth.uid()
  );

CREATE POLICY "library_review" ON public.medications_library
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- 5. Seed verified entries from existing medications_master (deduplicated by name+form+strength)
INSERT INTO public.medications_library (
  name, generic_name, brand_name, category, dosage_form, strength, barcode, is_verified
)
SELECT DISTINCT ON (lower(name), COALESCE(lower(dosage_form), ''), COALESCE(lower(strength), ''))
  name, generic_name, brand_name, category, dosage_form, strength, barcode, true
FROM public.medications_master
WHERE is_active = true
ORDER BY
  lower(name),
  COALESCE(lower(dosage_form), ''),
  COALESCE(lower(strength), ''),
  created_at;

-- 6. Back-link existing medications_master rows to their seeded library entry
UPDATE public.medications_master mm
SET library_id = ml.id
FROM public.medications_library ml
WHERE mm.library_id IS NULL
  AND lower(mm.name)                          = lower(ml.name)
  AND COALESCE(lower(mm.dosage_form), '')     = COALESCE(lower(ml.dosage_form), '')
  AND COALESCE(lower(mm.strength),    '')     = COALESCE(lower(ml.strength),    '');

COMMIT;
