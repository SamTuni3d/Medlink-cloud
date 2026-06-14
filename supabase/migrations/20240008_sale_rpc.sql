-- ============================================================
-- Migration 008: Sale Recording RPC
-- fn_record_sale — atomic sale + items + stock movements in one transaction.
-- Called by the sync queue when pushing an offline sale to the server.
-- The inventory trigger (trg_stock_movement_update_inventory) fires automatically
-- for each stock_movement INSERT, updating inventory.current_stock.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_record_sale(
  p_sale  jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale_id   uuid;
  v_item      jsonb;
  v_org_id    uuid;
  v_branch_id uuid;
  v_cashier   uuid;
BEGIN
  -- Extract common IDs once to keep repeated casts readable
  v_org_id    := (p_sale->>'organization_id')::uuid;
  v_branch_id := (p_sale->>'branch_id')::uuid;
  v_cashier   := (p_sale->>'cashier_id')::uuid;

  -- ── Insert sale ──────────────────────────────────────────────────────────────
  INSERT INTO sales (
    organization_id,
    branch_id,
    device_id,
    cashier_id,
    sale_number,
    status,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    currency_code,
    payment_method,
    amount_tendered,
    change_given,
    prescription_number,
    customer_name,
    created_at,
    synced_at
  )
  VALUES (
    v_org_id,
    v_branch_id,
    (p_sale->>'device_id')::uuid,
    v_cashier,
    p_sale->>'sale_number',
    COALESCE(p_sale->>'status', 'completed'),
    (p_sale->>'subtotal')::numeric,
    COALESCE((p_sale->>'discount_amount')::numeric, 0),
    COALESCE((p_sale->>'tax_amount')::numeric, 0),
    (p_sale->>'total_amount')::numeric,
    p_sale->>'currency_code',
    p_sale->>'payment_method',
    NULLIF(p_sale->>'amount_tendered', '')::numeric,
    NULLIF(p_sale->>'change_given', '')::numeric,
    NULLIF(p_sale->>'prescription_number', ''),
    NULLIF(p_sale->>'customer_name', ''),
    COALESCE(NULLIF(p_sale->>'created_at', '')::timestamptz, now()),
    now()
  )
  RETURNING id INTO v_sale_id;

  -- ── Insert sale items + corresponding stock movements ────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Sale item row
    INSERT INTO sale_items (
      organization_id,
      sale_id,
      medication_id,
      batch_id,
      quantity,
      unit_price,
      discount_percent,
      line_total,
      currency_code
    )
    VALUES (
      v_org_id,
      v_sale_id,
      (v_item->>'medication_id')::uuid,
      NULLIF(v_item->>'batch_id', '')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount_percent')::numeric, 0),
      (v_item->>'line_total')::numeric,
      v_item->>'currency_code'
    );

    -- Stock movement — negative delta (stock out).
    -- The trigger trg_stock_movement_update_inventory fires here and
    -- updates inventory.current_stock automatically. Do not touch that
    -- column directly (Rule 3).
    INSERT INTO stock_movements (
      organization_id,
      branch_id,
      medication_id,
      batch_id,
      movement_type,
      delta,
      reference_id,
      performed_by
    )
    VALUES (
      v_org_id,
      v_branch_id,
      (v_item->>'medication_id')::uuid,
      NULLIF(v_item->>'batch_id', '')::uuid,
      'sale',
      -((v_item->>'quantity')::integer),
      v_sale_id,
      v_cashier
    );
  END LOOP;

  RETURN jsonb_build_object('sale_id', v_sale_id);
END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies)
GRANT EXECUTE ON FUNCTION fn_record_sale(jsonb, jsonb) TO authenticated;
