-- Migration: 20240009_expiry_cron
-- Purpose: pg_cron job that runs nightly and generates notifications for
--          batches that are critical (≤30 days to expiry) or high-risk (≤60 days).
--
-- The job mirrors the scoring logic in packages/business-rules/src/expiry.ts
-- so the database side and the client side stay in sync.

-- ─── Add metadata column to notifications ──────────────────────────────────
-- Needed to store batch-specific context and to key the dedup unique index.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ─── Add average_daily_usage to inventory if not already present ───────────
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS average_daily_usage NUMERIC(10, 4) NOT NULL DEFAULT 0;

-- ─── Function ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_detect_expiring_batches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch RECORD;
  v_days_to_expiry INTEGER;
  v_score TEXT;
  v_severity TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  FOR v_batch IN
    SELECT
      ib.id                AS batch_id,
      ib.organization_id,
      ib.branch_id,
      ib.medication_id,
      mm.name              AS medication_name,
      ib.batch_number,
      ib.expiry_date,
      ib.quantity_remaining,
      COALESCE(i.average_daily_usage, 0) AS average_daily_usage
    FROM inventory_batches ib
    JOIN inventory        i   ON i.medication_id = ib.medication_id
                             AND i.branch_id     = ib.branch_id
    JOIN medications_master mm ON mm.id = ib.medication_id
    WHERE ib.expiry_date IS NOT NULL
      AND ib.quantity_remaining > 0
      AND ib.expiry_date > CURRENT_DATE
      AND (ib.expiry_date - CURRENT_DATE) <= 60
  LOOP
    v_days_to_expiry := v_batch.expiry_date - CURRENT_DATE;

    -- critical: ≤30 days AND stock won't clear before expiry
    -- high:     31–60 days AND stock won't clear before expiry
    IF v_days_to_expiry <= 30
       AND (v_batch.average_daily_usage = 0
            OR (v_batch.quantity_remaining::float / v_batch.average_daily_usage) >= v_days_to_expiry)
    THEN
      v_score    := 'critical';
      v_severity := 'critical';
    ELSIF v_days_to_expiry <= 60
       AND (v_batch.average_daily_usage = 0
            OR (v_batch.quantity_remaining::float / v_batch.average_daily_usage) >= v_days_to_expiry)
    THEN
      v_score    := 'high';
      v_severity := 'warning';
    ELSE
      -- Stock will clear before expiry — no notification needed
      CONTINUE;
    END IF;

    v_title := v_score || ' expiry: ' || v_batch.medication_name;
    v_body  := v_batch.medication_name
      || ' (batch ' || v_batch.batch_number || ') expires in '
      || v_days_to_expiry || ' day(s). Quantity remaining: '
      || v_batch.quantity_remaining || '.';

    -- Upsert: one notification per batch per day (deduped by unique index below).
    INSERT INTO notifications (
      organization_id,
      branch_id,
      type,
      severity,
      title,
      body,
      metadata,
      is_read,
      created_at
    )
    VALUES (
      v_batch.organization_id,
      v_batch.branch_id,
      'expiry_warning',
      v_severity,
      v_title,
      v_body,
      jsonb_build_object(
        'batch_id',        v_batch.batch_id,
        'medication_id',   v_batch.medication_id,
        'batch_number',    v_batch.batch_number,
        'expiry_date',     v_batch.expiry_date,
        'days_to_expiry',  v_days_to_expiry,
        'score',           v_score
      ),
      false,
      NOW()
    )
    ON CONFLICT (branch_id, (metadata->>'batch_id'), DATE(created_at))
    DO NOTHING;
  END LOOP;
END;
$$;

-- ─── Unique index to support the ON CONFLICT upsert ────────────────────────
-- One expiry notification per branch × batch × calendar-day.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_expiry_daily
  ON notifications (branch_id, (metadata->>'batch_id'), DATE(created_at))
  WHERE type = 'expiry_warning';

-- ─── Schedule the cron job ─────────────────────────────────────────────────
-- Runs at 01:00 UTC every day. Unschedule old job first (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('detect_expiring_batches');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'detect_expiring_batches',
  '0 1 * * *',
  $$SELECT fn_detect_expiring_batches()$$
);
