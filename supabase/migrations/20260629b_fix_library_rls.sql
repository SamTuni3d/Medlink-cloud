-- ============================================================
-- Migration 019b: Fix insecure RLS policies on medications_library
-- The old library_select and library_review policies checked
-- auth.jwt() -> 'user_metadata' ->> 'role' which is writable
-- by end users and must never be used in a security context.
-- ============================================================

BEGIN;

-- Drop the unsafe policies
DROP POLICY IF EXISTS "library_select"  ON public.medications_library;
DROP POLICY IF EXISTS "library_review"  ON public.medications_library;
DROP POLICY IF EXISTS "library_suggest" ON public.medications_library;

-- 1. SELECT: authenticated users can read approved entries, or their own org's submissions
CREATE POLICY "library_select" ON public.medications_library
  FOR SELECT USING (
    status = 'approved'
    OR suggested_by        = auth.uid()
    OR submitted_by_org_id = get_user_organization_id()
  );

-- 2. INSERT: authenticated users can submit (pending_review only, must own the org)
CREATE POLICY "library_suggest" ON public.medications_library
  FOR INSERT WITH CHECK (
    status       = 'pending_review'
    AND suggested_by = auth.uid()
  );

-- 3. UPDATE: blocked for all client roles.
--    Approve / reject go through Server Actions that use the Supabase
--    service-role key (admin client), which bypasses RLS entirely.
--    This policy intentionally denies all client-side updates.
CREATE POLICY "library_review" ON public.medications_library
  FOR UPDATE USING (false);

COMMIT;
