-- ============================================================
-- Migration 20260804190835: Security & performance baseline cleanup
-- Ground-up audit pass applied 2026-08-04:
--   1. Drop stray tables created via Supabase dashboard
--   2. Close open-read security hole on medications_master
--   3. Revoke EXECUTE from anon on all SECURITY DEFINER functions
--   4. Pin search_path on SECURITY DEFINER functions
--   5. Fix RLS init-plan (auth.uid() → (SELECT auth.uid()))
--   6. Add missing FK indexes (19 total)
-- ============================================================

-- ─── 1. Drop stray tables ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS "POS inventory";
DROP TABLE IF EXISTS "NEW";
DROP TABLE IF EXISTS "NEW 1";

-- ─── 2. Close medications_master open-read hole ───────────────────────────────
-- An accidental "Enable read access for all users" policy (qual = true)
-- allowed unauthenticated users to read all organizations' medications.
DROP POLICY IF EXISTS "Enable read access for all users" ON medications_master;

-- ─── 3. Revoke EXECUTE from anon on SECURITY DEFINER functions ───────────────
-- anon inherits from PUBLIC so we revoke from anon explicitly here;
-- migration 20260804190949 follows up by revoking from PUBLIC entirely.
REVOKE EXECUTE ON FUNCTION get_user_organization_id()                        FROM anon;
REVOKE EXECUTE ON FUNCTION fn_record_sale(uuid, uuid, jsonb, text, numeric, text)
                                                                              FROM anon;
REVOKE EXECUTE ON FUNCTION fn_void_sale(uuid, uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION submit_to_library(text, text, text, text, text, text, uuid)
                                                                              FROM anon;
REVOKE EXECUTE ON FUNCTION increment_library_times_used(uuid)                FROM anon;

-- ─── 4. Pin search_path on SECURITY DEFINER functions ────────────────────────
ALTER FUNCTION get_user_organization_id()   SET search_path = public;
ALTER FUNCTION fn_record_sale(uuid, uuid, jsonb, text, numeric, text)
                                            SET search_path = public;
ALTER FUNCTION fn_void_sale(uuid, uuid)     SET search_path = public;

-- ─── 5. Fix RLS init-plan: auth.uid() → (SELECT auth.uid()) ──────────────────
-- Policies that call auth.uid() per-row are re-evaluated for every row.
-- Wrapping in a sub-SELECT pins the value once per query (init plan).

-- roles / permissions / role_permissions: public lookup tables
DROP POLICY IF EXISTS "authenticated_read" ON roles;
CREATE POLICY "authenticated_read" ON roles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_read" ON permissions;
CREATE POLICY "authenticated_read" ON permissions
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_read" ON role_permissions;
CREATE POLICY "authenticated_read" ON role_permissions
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- ─── 6. Add missing FK indexes ────────────────────────────────────────────────

-- users
CREATE INDEX IF NOT EXISTS idx_fk_users_organization   ON users(organization_id);

-- role_permissions
CREATE INDEX IF NOT EXISTS idx_fk_role_permissions_role       ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_fk_role_permissions_permission ON role_permissions(permission_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_fk_user_roles_user         ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_roles_role         ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_roles_branch       ON user_roles(branch_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_roles_organization ON user_roles(organization_id);

-- inventory_batches
CREATE INDEX IF NOT EXISTS idx_fk_inv_batches_supplier   ON inventory_batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fk_inv_batches_received_by ON inventory_batches(received_by);

-- stock_movements
CREATE INDEX IF NOT EXISTS idx_fk_stock_movements_performed_by ON stock_movements(performed_by);

-- sales
CREATE INDEX IF NOT EXISTS idx_fk_sales_cashier         ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_fk_sales_voided_by       ON sales(voided_by);

-- sale_items
CREATE INDEX IF NOT EXISTS idx_fk_sale_items_batch      ON sale_items(batch_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_fk_audit_logs_user       ON audit_logs(user_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_fk_notifications_related_user ON notifications(related_user_id);

-- purchase_orders
CREATE INDEX IF NOT EXISTS idx_fk_purchase_orders_supplier   ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fk_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_fk_purchase_orders_approved_by ON purchase_orders(approved_by);

-- duty_sessions
CREATE INDEX IF NOT EXISTS idx_fk_duty_sessions_user    ON duty_sessions(user_id);
