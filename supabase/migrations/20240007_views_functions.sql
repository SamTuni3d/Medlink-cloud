-- ============================================================
-- Migration 007: Views, Functions, Scheduled Jobs
-- All tables exist by this point — safe to reference any of them.
-- ============================================================

-- ─── pg_cron extension ────────────────────────────────────────────────────────
-- Required for scheduled reconciliation and expiry detection jobs.
-- Must be enabled in the Supabase dashboard: Database → Extensions → pg_cron
-- The CREATE EXTENSION below is a no-op if already enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Views ────────────────────────────────────────────────────────────────────

-- v_inventory_with_batches
-- Joins inventory + active batches + medication details.
-- Used by POS for stock display and by the dashboard for low-stock alerts.
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
  -- Aggregated batch info
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
JOIN medications_master m ON m.id = i.medication_id
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

-- v_branch_sales_summary
-- Daily sales totals per branch. Used by the executive dashboard chart.
CREATE OR REPLACE VIEW v_branch_sales_summary
WITH (security_invoker = true)
AS
SELECT
  organization_id,
  branch_id,
  DATE(created_at)                         AS sale_date,
  currency_code,
  COUNT(*)                                 AS transaction_count,
  SUM(total_amount)                        AS total_sales,
  SUM(discount_amount)                     AS total_discounts,
  SUM(tax_amount)                          AS total_tax
FROM sales
WHERE status = 'completed'
GROUP BY organization_id, branch_id, DATE(created_at), currency_code;

-- ─── Scheduled Jobs ───────────────────────────────────────────────────────────

-- Nightly inventory reconciliation (02:00 UTC)
-- Compares inventory.current_stock against SUM(stock_movements.delta).
-- Any discrepancy is logged to audit_logs and raises a notification.
SELECT cron.schedule(
  'reconcile-inventory',
  '0 2 * * *',
  $cron$
    WITH discrepancies AS (
      SELECT
        i.id              AS inventory_id,
        i.organization_id,
        i.branch_id,
        i.medication_id,
        i.current_stock   AS stored_stock,
        COALESCE(SUM(sm.delta), 0) AS calculated_stock,
        i.current_stock - COALESCE(SUM(sm.delta), 0) AS drift
      FROM inventory i
      LEFT JOIN stock_movements sm
        ON  sm.medication_id   = i.medication_id
        AND sm.branch_id       = i.branch_id
        AND sm.organization_id = i.organization_id
      GROUP BY i.id, i.organization_id, i.branch_id, i.medication_id, i.current_stock
      HAVING i.current_stock != COALESCE(SUM(sm.delta), 0)
    )
    INSERT INTO audit_logs (
      organization_id, branch_id, action, table_name, record_id, new_value
    )
    SELECT
      d.organization_id,
      d.branch_id,
      'reconciliation_discrepancy',
      'inventory',
      d.inventory_id,
      jsonb_build_object(
        'medication_id',   d.medication_id,
        'stored_stock',    d.stored_stock,
        'calculated_stock', d.calculated_stock,
        'drift',           d.drift,
        'detected_at',     now()
      )
    FROM discrepancies d;

    -- Raise a critical notification for each discrepancy
    INSERT INTO notifications (
      organization_id, branch_id, type, severity, title, body, related_table, related_id
    )
    SELECT
      d.organization_id,
      d.branch_id,
      'reconciliation_discrepancy',
      'critical',
      'Inventory discrepancy detected',
      format(
        'Stock for medication %s stored as %s but ledger calculates %s (drift: %s)',
        d.medication_id, d.stored_stock, d.calculated_stock, d.drift
      ),
      'inventory',
      d.inventory_id
    FROM (
      SELECT
        i.id              AS inventory_id,
        i.organization_id,
        i.branch_id,
        i.medication_id,
        i.current_stock   AS stored_stock,
        COALESCE(SUM(sm.delta), 0) AS calculated_stock,
        i.current_stock - COALESCE(SUM(sm.delta), 0) AS drift
      FROM inventory i
      LEFT JOIN stock_movements sm
        ON  sm.medication_id   = i.medication_id
        AND sm.branch_id       = i.branch_id
        AND sm.organization_id = i.organization_id
      GROUP BY i.id, i.organization_id, i.branch_id, i.medication_id, i.current_stock
      HAVING i.current_stock != COALESCE(SUM(sm.delta), 0)
    ) d
    -- Avoid duplicate notifications within 24 hours for the same inventory row
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.related_table = 'inventory'
        AND n.related_id    = d.inventory_id
        AND n.type          = 'reconciliation_discrepancy'
        AND n.created_at   >= now() - INTERVAL '24 hours'
    );
  $cron$
);
