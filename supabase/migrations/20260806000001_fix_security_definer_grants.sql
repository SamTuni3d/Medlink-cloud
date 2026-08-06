-- ============================================================
-- Migration: Fix SECURITY DEFINER function grants
-- Revoke PUBLIC execute on functions that must not be callable
-- by unauthenticated users. Trigger functions are called by the
-- Postgres trigger mechanism — they do not need a PUBLIC grant.
-- fn_next_rx_number must only run for authenticated sessions.
-- ============================================================

-- Revoke unauthenticated access to prescription number generation
REVOKE EXECUTE ON FUNCTION public.fn_next_rx_number(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.fn_next_rx_number(uuid) TO authenticated;

-- Revoke direct-call access to the inventory trigger function.
-- It is invoked by the trigger mechanism, not by users.
REVOKE EXECUTE ON FUNCTION public.fn_update_inventory_on_movement() FROM public;
REVOKE EXECUTE ON FUNCTION public.fn_update_inventory_on_movement() FROM authenticated;
