-- ============================================================
-- Migration 014: RPCs for Reports page aggregations
-- Sales by cashier and top products by revenue/qty
-- ============================================================

-- Sales summary grouped by cashier for a branch + date range
CREATE OR REPLACE FUNCTION get_sales_by_cashier(
  p_branch_id  uuid,
  p_from       timestamptz,
  p_to         timestamptz DEFAULT now()
)
RETURNS TABLE (
  cashier_id        uuid,
  cashier_name      text,
  transaction_count bigint,
  total_revenue     numeric,
  avg_transaction   numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.cashier_id,
    COALESCE(u.full_name, u.email, 'Unknown') AS cashier_name,
    COUNT(*)::bigint                           AS transaction_count,
    SUM(s.total_amount)                        AS total_revenue,
    AVG(s.total_amount)                        AS avg_transaction
  FROM sales s
  LEFT JOIN users u ON u.id = s.cashier_id
  WHERE s.branch_id  = p_branch_id
    AND s.status     = 'completed'
    AND s.created_at >= p_from
    AND s.created_at <= p_to
  GROUP BY s.cashier_id, u.full_name, u.email
  ORDER BY total_revenue DESC;
$$;

-- Top N products by revenue for a branch + date range
CREATE OR REPLACE FUNCTION get_top_products(
  p_branch_id  uuid,
  p_from       timestamptz,
  p_to         timestamptz DEFAULT now(),
  p_limit      int         DEFAULT 10
)
RETURNS TABLE (
  medication_id   uuid,
  medication_name text,
  quantity_sold   bigint,
  total_revenue   numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    si.medication_id,
    si.medication_name,
    SUM(si.quantity)::bigint AS quantity_sold,
    SUM(si.line_total)       AS total_revenue
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE s.branch_id  = p_branch_id
    AND s.status     = 'completed'
    AND s.created_at >= p_from
    AND s.created_at <= p_to
  GROUP BY si.medication_id, si.medication_name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;
