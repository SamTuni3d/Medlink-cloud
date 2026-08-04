-- ============================================================
-- Migration 20260804190949: Fix function grants and RLS init-plan
-- Follow-up to 20260804190835:
--   1. REVOKE from PUBLIC (not just anon) on all SECURITY DEFINER functions
--      so that even future anon-equivalent roles can't call them
--   2. GRANT back to authenticated + service_role only
--   3. Fix library_suggest INSERT init-plan (auth.uid() → (SELECT auth.uid()))
-- ============================================================

-- ─── 1 & 2. Revoke PUBLIC, re-grant to authenticated + service_role ───────────

REVOKE EXECUTE ON FUNCTION get_user_organization_id()
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_user_organization_id()
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION fn_record_sale(uuid, uuid, jsonb, text, numeric, text)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_record_sale(uuid, uuid, jsonb, text, numeric, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION fn_void_sale(uuid, uuid)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_void_sale(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION submit_to_library(text, text, text, text, text, text, uuid)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION submit_to_library(text, text, text, text, text, text, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION increment_library_times_used(uuid)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION increment_library_times_used(uuid)
  TO authenticated, service_role;

-- ─── 3. Fix library_suggest INSERT init-plan ──────────────────────────────────
-- The original policy called auth.uid() directly in WITH CHECK,
-- re-evaluated per row. Wrap in (SELECT ...) so it's evaluated once.
DROP POLICY IF EXISTS "library_suggest" ON medications_library;
CREATE POLICY "library_suggest" ON medications_library
  FOR INSERT WITH CHECK (
    status       = 'pending_review'
    AND suggested_by = (SELECT auth.uid())
  );
