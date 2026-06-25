-- ============================================================
-- Migration 017: Medications Library RPCs
-- search_medications_library: status-aware search with
--   trigram ranking.
-- get_or_create_inventory_item: idempotent import helper —
--   creates medications_master + inventory rows if absent.
-- ============================================================

BEGIN;

-- 1. search_medications_library
--    Returns approved library entries matching the query.
--    Ranks exact → prefix → substring matches above fuzzy.
DROP FUNCTION IF EXISTS public.search_medications_library(text, text, int, int);

CREATE FUNCTION public.search_medications_library(
  query      text DEFAULT '',
  p_category text DEFAULT NULL,
  lim        int  DEFAULT 50,
  off        int  DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  generic_name          text,
  brand_name            text,
  category              text,
  dosage_form           text,
  strength              text,
  barcode               text,
  unit_of_measure       text,
  requires_prescription boolean,
  source                text,
  status                text,
  is_verified           boolean,
  tags                  text[],
  nafdac_number         text,
  ghana_fda_code        text,
  created_at            timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id, ml.name, ml.generic_name, ml.brand_name,
    ml.category, ml.dosage_form, ml.strength, ml.barcode,
    ml.unit_of_measure, ml.requires_prescription,
    ml.source, ml.status, ml.is_verified, ml.tags,
    ml.nafdac_number, ml.ghana_fda_code, ml.created_at
  FROM public.medications_library ml
  WHERE
    ml.status = 'approved'
    AND (
      query = ''
      OR ml.name                             ILIKE '%' || query || '%'
      OR COALESCE(ml.generic_name, '')       ILIKE '%' || query || '%'
      OR COALESCE(ml.brand_name,   '')       ILIKE '%' || query || '%'
    )
    AND (p_category IS NULL OR ml.category = p_category)
  ORDER BY
    CASE
      WHEN query = ''                               THEN 0
      WHEN lower(ml.name) = lower(query)            THEN 1
      WHEN lower(ml.name) LIKE lower(query) || '%'  THEN 2
      ELSE 3
    END,
    ml.name
  LIMIT lim OFFSET off;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_medications_library(text, text, int, int) TO authenticated;

-- 2. get_or_create_inventory_item
--    Idempotent: creates medications_master + inventory rows for a
--    library entry if they do not already exist for the given org/branch.
--    Returns the medications_master.id.
DROP FUNCTION IF EXISTS public.get_or_create_inventory_item(uuid, uuid, uuid, numeric, text);

CREATE FUNCTION public.get_or_create_inventory_item(
  p_org_id        uuid,
  p_branch_id     uuid,
  p_library_id    uuid,
  p_selling_price numeric DEFAULT 0,
  p_currency_code text    DEFAULT 'GHS'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medication_id uuid;
  v_lib           public.medications_library%ROWTYPE;
BEGIN
  SELECT * INTO v_lib
  FROM public.medications_library
  WHERE id = p_library_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Library entry % not found or not approved', p_library_id;
  END IF;

  SELECT id INTO v_medication_id
  FROM public.medications_master
  WHERE organization_id = p_org_id
    AND library_id      = p_library_id
    AND is_active       = true
  LIMIT 1;

  IF v_medication_id IS NULL THEN
    INSERT INTO public.medications_master (
      organization_id, library_id,
      name, generic_name, brand_name,
      category, dosage_form, strength, barcode,
      unit_of_measure, requires_prescription,
      selling_price, currency_code, is_active
    ) VALUES (
      p_org_id, p_library_id,
      v_lib.name, v_lib.generic_name, v_lib.brand_name,
      v_lib.category, COALESCE(v_lib.dosage_form, 'Other'), v_lib.strength, v_lib.barcode,
      COALESCE(v_lib.unit_of_measure, 'units'), v_lib.requires_prescription,
      p_selling_price, p_currency_code, true
    )
    RETURNING id INTO v_medication_id;
  END IF;

  INSERT INTO public.inventory (organization_id, branch_id, medication_id)
  VALUES (p_org_id, p_branch_id, v_medication_id)
  ON CONFLICT (branch_id, medication_id) DO NOTHING;

  RETURN v_medication_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_inventory_item(uuid, uuid, uuid, numeric, text) TO authenticated;

COMMIT;
