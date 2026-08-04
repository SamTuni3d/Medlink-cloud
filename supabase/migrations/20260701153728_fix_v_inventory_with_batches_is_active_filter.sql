-- ============================================================
-- Migration 20260701153728: Fix v_inventory_with_batches is_active filter
-- The original view joined medications_master without filtering
-- is_active = true, causing deleted/inactive medications to appear
-- in inventory lists and the POS drug search.
-- ============================================================

CREATE OR REPLACE VIEW v_inventory_with_batches
WITH (security_invoker = true)
AS
SELECT
  i.id                                        AS inventory_id,
  i.organization_id,
  i.branch_id,
  i.medication_id,
  i.current_stock,
  i.reserved_stock,
  i.current_stock - i.reserved_stock          AS available_stock,
  m.name                                      AS medication_name,
  m.generic_name,
  m.dosage_form,
  m.strength,
  m.unit_of_measure,
  m.barcode,
  m.category,
  m.selling_price,
  m.currency_code,
  m.reorder_point,
  m.requires_prescription,
  COUNT(b.id) FILTER (WHERE b.quantity_remaining > 0)
                                              AS active_batch_count,
  MIN(b.expiry_date) FILTER (WHERE b.quantity_remaining > 0 AND b.expiry_date IS NOT NULL)
                                              AS nearest_expiry_date,
  CASE
    WHEN MIN(b.expiry_date) FILTER (WHERE b.quantity_remaining > 0 AND b.expiry_date IS NOT NULL)
         IS NULL THEN NULL
    ELSE (
      MIN(b.expiry_date) FILTER (WHERE b.quantity_remaining > 0 AND b.expiry_date IS NOT NULL)
      - CURRENT_DATE
    )
  END                                         AS days_to_nearest_expiry,
  i.last_reconciled_at,
  i.updated_at
FROM inventory i
JOIN medications_master m ON m.id = i.medication_id AND m.is_active = true
LEFT JOIN inventory_batches b
  ON b.medication_id = i.medication_id
  AND b.branch_id = i.branch_id
  AND b.quantity_remaining > 0
GROUP BY
  i.id, i.organization_id, i.branch_id, i.medication_id,
  i.current_stock, i.reserved_stock,
  m.name, m.generic_name, m.dosage_form, m.strength,
  m.unit_of_measure, m.barcode, m.category,
  m.selling_price, m.currency_code, m.reorder_point,
  m.requires_prescription, i.last_reconciled_at, i.updated_at;
