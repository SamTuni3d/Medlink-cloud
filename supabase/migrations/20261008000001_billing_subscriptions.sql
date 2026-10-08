-- ============================================================
-- Migration 014: Billing — Paystack subscriptions
-- Stores subscription tier, status, and Paystack identifiers per
-- organisation. Used for plan enforcement and webhook reconciliation.
-- ============================================================

CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'pro');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');

CREATE TABLE subscriptions (
  id                     uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid            NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Plan details
  plan                   subscription_plan  NOT NULL DEFAULT 'free',
  status                 subscription_status NOT NULL DEFAULT 'trialing',

  -- Trial window
  trial_ends_at          timestamptz     NOT NULL DEFAULT (now() + interval '14 days'),

  -- Active billing period (null while on free/trial)
  current_period_start   timestamptz,
  current_period_end     timestamptz,

  -- Paystack identifiers (null until first paid charge)
  paystack_customer_id   text,
  paystack_subscription_code text,
  paystack_plan_code     text,

  -- Plan limits (denormalised for fast enforcement)
  max_branches           integer         NOT NULL DEFAULT 1,
  max_users              integer         NOT NULL DEFAULT 5,

  created_at             timestamptz     NOT NULL DEFAULT now(),
  updated_at             timestamptz     NOT NULL DEFAULT now()
);

-- Append-only log of every webhook event from Paystack (idempotency + audit)
CREATE TABLE billing_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  paystack_event_id   text        UNIQUE,     -- idempotency: paystack event reference
  event_type          text        NOT NULL,   -- e.g. 'charge.success', 'subscription.disable'
  payload             jsonb       NOT NULL,
  processed_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_subscriptions_org    ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_billing_events_org   ON billing_events(organization_id);
CREATE INDEX idx_billing_events_type  ON billing_events(event_type);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- subscriptions: org members can read their own row; only service-role writes
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON subscriptions
  FOR SELECT USING (organization_id = get_user_organization_id());

-- Inserts/updates come exclusively from the webhook handler (service-role key),
-- which bypasses RLS — no INSERT/UPDATE policy needed for authenticated users.

-- billing_events: org admins can read; service-role writes
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON billing_events
  FOR SELECT USING (organization_id = get_user_organization_id());

-- ── Seed: every existing organisation starts on a free trial ─────────────────
INSERT INTO subscriptions (organization_id, plan, status, trial_ends_at, max_branches, max_users)
SELECT id, 'free', 'trialing', now() + interval '14 days', 1, 5
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
