-- ============================================================
-- Migration 019: Crowdsourced Medication Library
-- Adds times_used counter, rate-limit log, and server-side
-- submission/increment RPCs for the crowdsourced library flow.
-- ============================================================

BEGIN;

-- 1. Add times_used counter to existing medications_library table
ALTER TABLE public.medications_library
  ADD COLUMN IF NOT EXISTS times_used INTEGER NOT NULL DEFAULT 0;

-- Index for popularity-sorted search
CREATE INDEX IF NOT EXISTS idx_medications_library_times_used
  ON public.medications_library(times_used DESC);

-- 2. Rate-limit table: one row per (org, drug_name) per 24-hour window
CREATE TABLE IF NOT EXISTS public.library_submission_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drug_name_norm   TEXT        NOT NULL,   -- lowercased + trimmed for comparison
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_log_org_time
  ON public.library_submission_log(organization_id, submitted_at);

-- RLS: each org can only see/insert its own log rows
ALTER TABLE public.library_submission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_own_log" ON public.library_submission_log
  FOR ALL USING (organization_id = get_user_organization_id())
  WITH CHECK   (organization_id = get_user_organization_id());

-- 3. submit_to_library RPC
--    Called after a pharmacy adds a custom medication.
--    Handles duplicate detection, rate-limiting, auto-approval for trusted orgs.
--    Returns a JSONB result — caller ignores errors silently.
CREATE OR REPLACE FUNCTION public.submit_to_library(
  p_name          TEXT,
  p_generic_name  TEXT,
  p_brand_name    TEXT,
  p_category      TEXT,
  p_dosage_form   TEXT,
  p_strength      TEXT,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_name     TEXT;
  v_existing_id   UUID;
  v_recent_count  INTEGER;
  v_trusted       BOOLEAN;
  v_new_status    TEXT;
BEGIN
  -- Normalise name for dedup / rate-limit keying
  v_norm_name := lower(trim(p_name));

  IF v_norm_name = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_fields');
  END IF;

  -- Duplicate check: same normalised name + dosage_form + strength already approved
  SELECT id INTO v_existing_id
  FROM public.medications_library
  WHERE lower(trim(name))                             = v_norm_name
    AND lower(COALESCE(trim(dosage_form), ''))        = lower(COALESCE(trim(p_dosage_form), ''))
    AND lower(COALESCE(trim(strength),    ''))        = lower(COALESCE(trim(p_strength),    ''))
    AND status = 'approved'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_exists', 'existing_id', v_existing_id);
  END IF;

  -- Rate-limit: same org submitting the exact same drug within 24 hours
  SELECT COUNT(*) INTO v_recent_count
  FROM public.library_submission_log
  WHERE organization_id   = p_organization_id
    AND drug_name_norm    = v_norm_name
    AND submitted_at      > now() - INTERVAL '24 hours';

  IF v_recent_count > 0 THEN
    -- Silent: user doesn't know they're rate-limited
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;

  -- Trusted org: 30+ days on platform AND 10+ previously approved submissions
  SELECT (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = p_organization_id
        AND created_at < now() - INTERVAL '30 days'
    )
    AND (
      SELECT COUNT(*) FROM public.medications_library
      WHERE submitted_by_org_id = p_organization_id
        AND status = 'approved'
    ) >= 10
  ) INTO v_trusted;

  v_new_status := CASE WHEN v_trusted THEN 'approved' ELSE 'pending_review' END;

  -- Insert into library (unique constraint handles concurrent dupes gracefully)
  INSERT INTO public.medications_library (
    name, generic_name, brand_name, category, dosage_form, strength,
    submitted_by_org_id, suggested_by, source, status, times_used
  )
  SELECT
    p_name, p_generic_name, p_brand_name, p_category, p_dosage_form, p_strength,
    p_organization_id, auth.uid(), 'suggested', v_new_status, 0
  WHERE NOT EXISTS (
    -- Guard against the race where a concurrent submission sneaked in
    SELECT 1 FROM public.medications_library
    WHERE lower(trim(name))                             = v_norm_name
      AND lower(COALESCE(trim(dosage_form), ''))        = lower(COALESCE(trim(p_dosage_form), ''))
      AND lower(COALESCE(trim(strength),    ''))        = lower(COALESCE(trim(p_strength),    ''))
  );

  -- Log for rate limiting
  INSERT INTO public.library_submission_log (organization_id, drug_name_norm)
  VALUES (p_organization_id, v_norm_name)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'status', v_new_status);

EXCEPTION WHEN OTHERS THEN
  -- Swallow any DB-level unique-constraint errors so the caller's save succeeds
  RETURN jsonb_build_object('success', false, 'reason', 'db_error', 'detail', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_to_library(text, text, text, text, text, text, uuid)
  TO authenticated;

-- 4. increment_library_times_used RPC
--    Called when a pharmacy imports a drug from the library.
--    Safe to call even if the entry doesn't exist (no-op).
CREATE OR REPLACE FUNCTION public.increment_library_times_used(p_library_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.medications_library
  SET times_used = times_used + 1
  WHERE id = p_library_id AND status = 'approved';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_library_times_used(uuid)
  TO authenticated;

COMMIT;
