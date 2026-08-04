-- ============================================================
-- Migration 20260701180425: Add fn_void_sale RPC
-- Voids a completed sale and restores stock via stock_movements.
-- Uses FOR UPDATE lock to prevent concurrent double-voids.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_void_sale(p_sale_id uuid, p_voided_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sale  sales%ROWTYPE;
  v_item  sale_items%ROWTYPE;
BEGIN
  -- Lock row to prevent concurrent double-void
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF v_sale.status = 'voided' THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  IF v_sale.status != 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be voided';
  END IF;

  -- Mark the sale as voided
  UPDATE sales
  SET status = 'voided', updated_at = now()
  WHERE id = p_sale_id;

  -- Restore stock for every item via stock_movements.
  -- The existing trigger trg_stock_movement_update_inventory fires
  -- automatically and adds the delta back to inventory.current_stock.
  FOR v_item IN
    SELECT * FROM sale_items WHERE sale_id = p_sale_id
  LOOP
    INSERT INTO stock_movements (
      organization_id,
      branch_id,
      medication_id,
      batch_id,
      movement_type,
      delta,
      notes,
      performed_by
    ) VALUES (
      v_sale.organization_id,
      v_sale.branch_id,
      v_item.medication_id,
      v_item.batch_id,
      'void_return',
      v_item.quantity,
      'Void of sale ' || v_sale.sale_number,
      p_voided_by
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_void_sale(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_void_sale(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_void_sale(uuid, uuid) TO service_role;
