# MedLink Cloud — Architecture Document

**Version:** Phase A (Supabase-native)
**Last updated:** 2026-06-12
**Status:** Pre-build, authoritative for Phase A sessions

---

## 1. System Overview

MedLink Cloud is a multi-tenant pharmacy management SaaS. A single deployment serves multiple pharmacy organizations, each of which may operate one or more branches. Data is strictly isolated between tenants via Postgres Row Level Security.

```
┌─────────────────────────────────────────────────────────┐
│                    MedLink Cloud (Phase A)               │
│                                                         │
│  ┌──────────────┐      ┌──────────────────────────────┐ │
│  │  apps/web    │      │        Supabase               │ │
│  │  (Next.js 14)│◄────►│  ┌────────┐  ┌────────────┐  │ │
│  │  PWA + POS   │      │  │ Postgres│  │    Auth    │  │ │
│  └──────────────┘      │  │ (RLS)  │  │ (JWT/PKCE) │  │ │
│         │              │  └────────┘  └────────────┘  │ │
│         │              │  ┌────────┐  ┌────────────┐  │ │
│  ┌──────┴───────┐      │  │  Edge  │  │  Storage   │  │ │
│  │  Dexie.js    │      │  │  Fns   │  │            │  │ │
│  │  (IndexedDB) │      │  └────────┘  └────────────┘  │ │
│  └──────────────┘      │  ┌────────┐                   │ │
│                         │  │pg_cron │                   │ │
│                         │  └────────┘                   │ │
│                         └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

packages/
  data-client/      ← single abstraction seam (Phase A→B boundary)
  business-rules/   ← pure functions, no I/O
```

---

## 2. Multi-Tenancy Model

```
Organization (tenant)
  └── Branch 1
  │     ├── Users (with roles scoped to Branch 1)
  │     ├── Inventory (per product, per branch)
  │     └── Sales
  └── Branch 2
        └── ...

Medications master, suppliers → shared across org (org-scoped, not branch-scoped)
```

**Isolation mechanism:** every tenant-scoped table has `organization_id uuid NOT NULL` and an RLS policy that restricts access to `auth.uid()`'s organization. Branch-scoped tables additionally carry `branch_id`.

**Org Admin** can see all branches. **Branch Manager** and below see only their assigned branch.

---

## 3. Entity Relationship Diagram (Phase 1)

```
organizations
  id, name, registration_number, country, city, currency_code,
  subscription_tier, created_at

branches
  id, organization_id→organizations, name, address, phone,
  is_active, created_at

users
  id (= auth.users.id), organization_id→organizations,
  branch_id→branches (default branch), full_name, email, phone,
  is_active, created_at

roles
  id, name (enum: super_admin|org_admin|branch_manager|pharmacist|cashier|inventory_manager|auditor),
  description

permissions
  id, code (e.g. "sales:create"), description

role_permissions
  role_id→roles, permission_id→permissions

user_roles
  user_id→users, role_id→roles, branch_id→branches (nullable = org-wide),
  granted_by→users, granted_at

medications_master
  id, organization_id→organizations, name, generic_name, brand_name,
  dosage_form, strength, unit_of_measure, barcode, category,
  requires_prescription, reorder_point, reorder_quantity,
  is_active, created_at, updated_at

suppliers
  id, organization_id→organizations, name, contact_name, phone, email,
  address, is_active, created_at

inventory
  id, organization_id→organizations, branch_id→branches,
  medication_id→medications_master, current_stock (derived — see §3.1),
  reserved_stock, available_stock (computed: current - reserved),
  last_reconciled_at, updated_at
  UNIQUE (branch_id, medication_id)

inventory_batches
  id, organization_id→organizations, branch_id→branches,
  medication_id→medications_master, supplier_id→suppliers,
  batch_number, expiry_date, quantity_received, quantity_remaining,
  cost_price, currency_code, received_at, created_by→users

stock_movements
  id, organization_id→organizations, branch_id→branches,
  medication_id→medications_master, batch_id→inventory_batches (nullable),
  movement_type (receipt|sale|adjustment|transfer_in|transfer_out|expiry_write_off),
  delta (signed integer: positive=stock in, negative=stock out),
  reference_id (sale_id or purchase_order_id — nullable),
  notes, performed_by→users, created_at

  ← INSERT here triggers trg_stock_movement_update_inventory →
  ← pg_cron reconciliation nightly

sales
  id, organization_id→organizations, branch_id→branches,
  cashier_id→users, sale_number (branch-scoped sequential),
  status (pending|completed|voided), subtotal, discount_amount,
  tax_amount, total_amount, currency_code,
  payment_method (cash|card|mobile_money|credit), amount_tendered,
  change_given, prescription_number, customer_name,
  synced_at (null = not yet synced from offline device),
  created_at, updated_at

sale_items
  id, sale_id→sales, medication_id→medications_master,
  batch_id→inventory_batches (nullable — FEFO selected),
  quantity, unit_price, discount_percent, line_total, currency_code

audit_logs
  id, organization_id→organizations, branch_id (nullable),
  actor_id→users, action, table_name, record_id,
  old_value (jsonb), new_value (jsonb), ip_address, created_at

sync_cursors
  id, device_id (uuid, generated client-side), organization_id→organizations,
  branch_id→branches, table_name, last_cursor (bigint — Postgres xmin or sequence),
  updated_at
  UNIQUE (device_id, table_name)

notifications
  id, organization_id→organizations, branch_id (nullable),
  type (expiry_warning|reorder_alert|reconciliation_discrepancy|system),
  severity (info|warning|critical), title, body,
  related_table, related_id, is_read, created_at
```

### 3.1 Inventory Trigger (Rule 3)

```sql
CREATE OR REPLACE FUNCTION fn_update_inventory_on_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO inventory (organization_id, branch_id, medication_id, current_stock)
  VALUES (NEW.organization_id, NEW.branch_id, NEW.medication_id, NEW.delta)
  ON CONFLICT (branch_id, medication_id)
  DO UPDATE SET
    current_stock = inventory.current_stock + EXCLUDED.current_stock,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_movement_update_inventory
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_update_inventory_on_movement();
```

---

## 4. Offline Sync Protocol (Cursor-Based Changesets)

The POS writes sales to Dexie (IndexedDB) immediately. A background sync worker pushes pending records to the `sync` Edge Function when online.

### 4.1 Push (device → server)

```
POST /functions/v1/sync/push
Body: {
  device_id: string,
  branch_id: string,
  records: {
    table: "sales" | "sale_items" | "stock_movements",
    operation: "insert",   // POS only inserts; deletes handled server-side
    data: Record<string, unknown>
  }[]
}
```

The Edge Function:
1. Validates JWT (Supabase Auth).
2. Validates each record with Zod (same schemas as `packages/data-client`).
3. Upserts into Postgres using `ON CONFLICT DO NOTHING` (idempotent — device can retry).
4. Returns `{ accepted: number, rejected: { index, reason }[] }`.

### 4.2 Pull (server → device)

```
GET /functions/v1/sync/pull?table=medications_master&cursor=<last_cursor>&branch_id=<id>
```

The Edge Function:
1. Validates JWT.
2. Reads rows WHERE `xmin > cursor` (or a sequence column `updated_seq`) for the requested table.
3. Returns `{ rows: [...], next_cursor: number }`.
4. Device upserts rows into Dexie and stores `next_cursor` in `sync_cursors`.

### 4.3 Tables synced to device

| Table | Direction | Notes |
|---|---|---|
| `medications_master` | pull only | Full org catalogue |
| `inventory` | pull only | Branch snapshot (not real-time on POS) |
| `inventory_batches` | pull only | For FEFO selection at POS |
| `sales` | push only | POS-created, pushed when online |
| `sale_items` | push only | Pushed with parent sale |
| `stock_movements` | push only | Auto-generated from sales on push |

### 4.4 Conflict Resolution

POS devices are append-only (no edits). Conflicts arise only from duplicate `device_id + sale_number`. Resolution: `ON CONFLICT DO NOTHING` — first writer wins, subsequent retries are silently dropped.

---

## 5. Package Contracts and the Phase B Boundary

`packages/data-client` is the seam. In Phase A it calls Supabase directly. In Phase B, each function in the client becomes an HTTP call to a FastAPI endpoint.

**The Zod schemas in `packages/data-client/src/schemas/` are the contract.** They must remain stable across the Phase A→B boundary. The FastAPI service will implement the same I/O shapes.

Naming convention: `<Entity>Schema` (input), `<Entity>RecordSchema` (output from DB).

Example:
```ts
// packages/data-client/src/schemas/sales.ts
export const CreateSaleSchema = z.object({
  branch_id: z.string().uuid(),
  items: z.array(SaleItemSchema).min(1),
  payment_method: PaymentMethodSchema,
  currency_code: z.string().length(3),
  // ...
});
```

---

## 6. Authentication and Authorization

**Auth provider:** Supabase Auth (email + password, magic link optional).
**Token format:** JWT, verified by Supabase on every API call.
**PKCE flow** for the Next.js app (no implicit flow).

Registration flow:
1. User submits: organization name, owner name, email, phone, country, city, password.
2. Server creates `organization` row, then `user` row linked to `auth.users.id`, then assigns `org_admin` role.
3. Email verification required before first login.

Session management:
- `useAuth()` hook exposes `{ user, organization, role, branch, loading, signOut }`.
- Branch context stored in `localStorage` and restored on load (`useBranch()` hook).
- Route guards implemented as Next.js middleware + client-side `useAuth()` check.

---

## 7. Business Rules (packages/business-rules)

All functions are pure (no I/O). They accept plain objects and return plain objects or primitives.

### 7.1 FEFO / FIFO Batch Selection

Used at POS to select which batch to deduct from.

**FEFO (First-Expiry, First-Out)** is the default:
```ts
selectBatch(batches: Batch[], quantityNeeded: number): BatchSelection[]
// Returns list of {batch_id, quantity} sorted by expiry_date ASC (soonest first).
// If expiry_date is null (non-expiring), fall to FIFO (received_at ASC).
// Raises if total available < quantityNeeded.
```

### 7.2 Reorder Point Calculation

```ts
calculateReorderPoint(params: {
  average_daily_usage: number,   // units/day
  lead_time_days: number,        // supplier lead time
  safety_stock_days: number,     // configurable per org (default: 7)
}): number
// Returns: (average_daily_usage × (lead_time_days + safety_stock_days))
// Stored as medications_master.reorder_point; recalculated when usage history updates.
```

### 7.3 Expiry Risk Scoring

```ts
scoreExpiryRisk(params: {
  expiry_date: Date,
  quantity_remaining: number,
  average_daily_usage: number,
  today?: Date,                  // injectable for testing
}): ExpiryRiskScore
// Returns: { score: "critical" | "high" | "medium" | "low", days_to_expiry: number, days_of_stock: number }
// critical: expiry within 30 days AND stock won't clear before expiry
// high:     expiry within 60 days
// medium:   expiry within 90 days
// low:      > 90 days or stock will clear before expiry
```

All three algorithms must be documented in `docs/business-rules.md` with example inputs/outputs.

---

## 8. Phase B Migration Triggers

Do not begin Phase B work until a trigger condition is actually hit. Evaluate quarterly.

| Trigger | Condition | Migration |
|---|---|---|
| Performance | p95 API latency > 800ms sustained for 7 days | Extract hot read paths to FastAPI + Redis cache |
| Scale | > 500 concurrent branch sessions | Move sync Edge Function to FastAPI worker pool |
| ML features | Demand forecasting or AI dispensing assistant requested | Add FastAPI ML service; data-client calls it |
| Compliance | Regulatory requirement for dedicated compute isolation | Full Phase B extraction |

Until a trigger is hit, **the correct answer is "not yet"** — do not pre-build FastAPI infrastructure.

---

## 9. Infrastructure Mapping

### Phase A (current)

| Component | Provider | Notes |
|---|---|---|
| Next.js app | Vercel (or Supabase hosting) | Edge runtime for middleware |
| Database | Supabase Postgres (EU region) | GDPR-aligned |
| Auth | Supabase Auth | Email + password |
| Edge Functions | Supabase Edge Functions (Deno) | Sync, notifications |
| Scheduled jobs | pg_cron (inside Supabase) | Expiry checks, reconciliation |
| File storage | Supabase Storage | Prescription images (Phase 1+) |
| CDN | Vercel Edge Network | Static assets, PWA shell |

### Phase B additions (future only)

| Component | Provider |
|---|---|
| API service | FastAPI on Railway / Render / Cloud Run |
| Cache | Redis (Upstash) |
| ML inference | Modal or Replicate |

---

## 10. PWA Configuration

**Caching strategy** (next-pwa / Workbox):

| Resource | Strategy | TTL |
|---|---|---|
| App shell (JS/CSS) | Cache-first | Until new deploy |
| Medication list | Stale-while-revalidate | 1 hour |
| Inventory snapshot | Network-first | 5 minutes |
| Fonts / icons | Cache-first | 30 days |
| API calls (non-POS) | Network-only | — |

**Install prompt:** shown after 3 POS sessions without install. Dismissed state stored in `localStorage`.

**Offline indicator:** banner in POS UI when `navigator.onLine === false`. Does not block sale completion.
