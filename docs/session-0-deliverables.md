# Session 0 Deliverables — MedLink Cloud

Produced: 2026-06-12. All five required before Session 1 begins.

---

## Deliverable 1 — Architecture Confirmation

Confirmed with three amendments:

**Amendment A — Supabase client split**
Single `src/lib/supabase.ts` becomes two:
- `supabase-browser.ts` — createBrowserClient() for client components/hooks
- `supabase-server.ts` — createServerClient(cookies()) for server components/Route Handlers
Uses `@supabase/ssr`, not bare `@supabase/supabase-js`. Service-role key only in Edge Functions.

**Amendment B — RLS JWT claims (performance)**
Replace subquery `(SELECT organization_id FROM users WHERE id = auth.uid())` with JWT custom claim `(auth.jwt() ->> 'organization_id')::uuid`. Requires `handle_new_user` trigger populating `raw_app_meta_data`. `get_user_organization_id()` helper kept as fallback for admin cross-tenant queries only.

**Amendment C — sale_number uniqueness (critical)**
Architecture §3 said `UNIQUE (branch_id, sale_number)` but §4.4 relied on `device_id + sale_number`. These are incompatible offline. Resolution:
- POS generates device-scoped sale number: `DEV-{short_device_id}-{local_seq}`
- UNIQUE constraint: `(device_id, branch_id, sale_number)`
- Server assigns `branch_sale_number` (sequential) on sync acceptance
- Offline receipt shows device number; reprinted/confirmed receipt shows branch number

All other architecture sections confirmed: abstraction seam, Phase B triggers, offline sync using `updated_seq` (not xmin).

---

## Deliverable 2 — Phase 1 ERD

Full column-level definition:

```
organizations
  id uuid PK
  name text NOT NULL
  registration_number text UNIQUE
  country text NOT NULL
  city text NOT NULL
  currency_code char(3) NOT NULL DEFAULT 'GHS'
  subscription_tier text NOT NULL DEFAULT 'starter'
  is_active boolean NOT NULL DEFAULT true
  created_at timestamptz NOT NULL DEFAULT now()

branches
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  name text NOT NULL
  address text
  phone text
  is_active boolean NOT NULL DEFAULT true
  created_at timestamptz NOT NULL DEFAULT now()
  INDEX: FK(organization_id)

users
  id uuid PK FK→auth.users
  organization_id uuid NOT NULL FK→organizations
  default_branch_id uuid FK→branches
  full_name text NOT NULL
  email text NOT NULL UNIQUE
  phone text
  is_active boolean NOT NULL DEFAULT true
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()

roles
  id uuid PK
  name text NOT NULL UNIQUE
    CHECK IN ('super_admin','org_admin','branch_manager','pharmacist',
              'cashier','inventory_manager','auditor')
  description text

permissions
  id uuid PK
  code text NOT NULL UNIQUE  -- e.g. 'sales:create', 'inventory:receive'
  description text

role_permissions
  role_id uuid NOT NULL FK→roles
  permission_id uuid NOT NULL FK→permissions
  PK(role_id, permission_id)

user_roles
  id uuid PK
  user_id uuid NOT NULL FK→users
  role_id uuid NOT NULL FK→roles
  branch_id uuid FK→branches  -- NULL = org-wide role
  granted_by uuid NOT NULL FK→users
  granted_at timestamptz NOT NULL DEFAULT now()
  UNIQUE(user_id, role_id, branch_id)

medications_master
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  name text NOT NULL
  generic_name text
  brand_name text
  dosage_form text
  strength text
  unit_of_measure text NOT NULL
  barcode text
  category text
  requires_prescription boolean NOT NULL DEFAULT false
  reorder_point integer NOT NULL DEFAULT 0
  reorder_quantity integer NOT NULL DEFAULT 0
  selling_price numeric(12,2) NOT NULL DEFAULT 0
  currency_code char(3) NOT NULL DEFAULT 'GHS'
  is_active boolean NOT NULL DEFAULT true
  updated_seq bigint NOT NULL DEFAULT nextval(...)  -- sync cursor
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
  UNIQUE(organization_id, barcode) WHERE barcode IS NOT NULL
  GIN tsvector index on (name || ' ' || generic_name || ' ' || brand_name)
  INDEX(organization_id, updated_seq)  -- sync pull

suppliers
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  name text NOT NULL
  contact_name text
  phone text
  email text
  address text
  is_active boolean NOT NULL DEFAULT true
  created_at timestamptz NOT NULL DEFAULT now()

inventory                            -- DERIVED, never write directly
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid NOT NULL FK→branches
  medication_id uuid NOT NULL FK→medications_master
  current_stock integer NOT NULL DEFAULT 0  -- maintained by trigger
  reserved_stock integer NOT NULL DEFAULT 0
  last_reconciled_at timestamptz
  updated_at timestamptz NOT NULL DEFAULT now()
  updated_seq bigint NOT NULL DEFAULT nextval(...)
  UNIQUE(branch_id, medication_id)
  INDEX(branch_id, updated_seq)  -- sync pull
  -- available_stock = current_stock - reserved_stock (computed in view)

inventory_batches                    -- FEFO pivot
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid NOT NULL FK→branches
  medication_id uuid NOT NULL FK→medications_master
  supplier_id uuid FK→suppliers
  batch_number text NOT NULL
  expiry_date date                   -- NULL = non-expiring
  quantity_received integer NOT NULL CHECK (> 0)
  quantity_remaining integer NOT NULL DEFAULT quantity_received CHECK (>= 0)
  cost_price numeric(12,2) NOT NULL
  currency_code char(3) NOT NULL DEFAULT 'GHS'
  received_at timestamptz NOT NULL DEFAULT now()
  created_by uuid FK→users
  updated_seq bigint NOT NULL DEFAULT nextval(...)
  INDEX(branch_id, medication_id, expiry_date NULLS LAST)  -- FEFO queries
  INDEX(branch_id, updated_seq)  -- sync pull

stock_movements                      -- IMMUTABLE ledger, append-only
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid NOT NULL FK→branches
  medication_id uuid NOT NULL FK→medications_master
  batch_id uuid FK→inventory_batches
  movement_type text NOT NULL
    CHECK IN ('receipt','sale','adjustment','transfer_in',
              'transfer_out','expiry_write_off','opening_stock')
  delta integer NOT NULL             -- positive=in, negative=out
  reference_id uuid                  -- sale_id or PO id
  notes text
  performed_by uuid NOT NULL FK→users
  created_at timestamptz NOT NULL DEFAULT now()
  INDEX(branch_id, medication_id, created_at DESC)
  -- INSERT triggers trg_stock_movement_update_inventory
  -- NO UPDATE or DELETE policies

sales
  id uuid PK DEFAULT gen_random_uuid()  -- client-generated UUID
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid NOT NULL FK→branches
  device_id uuid NOT NULL            -- client-generated per device
  cashier_id uuid NOT NULL FK→users
  sale_number text NOT NULL          -- 'DEV-{short_id}-{local_seq}'
  branch_sale_number integer         -- assigned server-side on sync
  status text NOT NULL DEFAULT 'completed'
    CHECK IN ('pending','completed','voided')
  subtotal numeric(12,2) NOT NULL
  discount_amount numeric(12,2) NOT NULL DEFAULT 0
  tax_amount numeric(12,2) NOT NULL DEFAULT 0
  total_amount numeric(12,2) NOT NULL
  currency_code char(3) NOT NULL
  payment_method text NOT NULL
    CHECK IN ('cash','card','mobile_money','credit')
  amount_tendered numeric(12,2)
  change_given numeric(12,2)
  prescription_number text
  customer_name text
  synced_at timestamptz              -- NULL = pending sync
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
  UNIQUE(device_id, branch_id, sale_number)
  INDEX(branch_id, created_at DESC)
  INDEX(cashier_id, created_at DESC)

sale_items
  id uuid PK
  sale_id uuid NOT NULL FK→sales
  medication_id uuid NOT NULL FK→medications_master
  batch_id uuid FK→inventory_batches  -- FEFO-selected
  quantity integer NOT NULL CHECK (> 0)
  unit_price numeric(12,2) NOT NULL
  discount_percent numeric(5,2) NOT NULL DEFAULT 0
  line_total numeric(12,2) NOT NULL
  currency_code char(3) NOT NULL

audit_logs                           -- APPEND-ONLY
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid FK→branches
  actor_id uuid FK→users
  action text NOT NULL
  table_name text NOT NULL
  record_id uuid
  old_value jsonb
  new_value jsonb
  ip_address inet
  created_at timestamptz NOT NULL DEFAULT now()
  INDEX(organization_id, created_at DESC)
  INDEX(table_name, record_id)
  -- NO UPDATE or DELETE policies

sync_cursors
  id uuid PK
  device_id uuid NOT NULL            -- client-generated UUID
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid NOT NULL FK→branches
  table_name text NOT NULL
  last_cursor bigint NOT NULL DEFAULT 0
  updated_at timestamptz NOT NULL DEFAULT now()
  UNIQUE(device_id, table_name)

notifications
  id uuid PK
  organization_id uuid NOT NULL FK→organizations
  branch_id uuid FK→branches
  type text NOT NULL
    CHECK IN ('expiry_warning','reorder_alert',
              'reconciliation_discrepancy','system')
  severity text NOT NULL CHECK IN ('info','warning','critical')
  title text NOT NULL
  body text NOT NULL
  related_table text
  related_id uuid
  is_read boolean NOT NULL DEFAULT false
  created_at timestamptz NOT NULL DEFAULT now()
  INDEX(organization_id, is_read, created_at DESC)
```

Ledger relationship:
```
  inventory_batches ──┐
                      ▼
  stock_movements ─── INSERT → trigger → inventory.current_stock += delta
        ▲
  sale_items ─────────┘  (one stock_movement per sale_item, delta = -quantity)
```

---

## Deliverable 3 — Folder Structure (Confirmed + Expanded)

```
medlink-cloud/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── layout.tsx
│       │   │   ├── login/page.tsx
│       │   │   ├── register/page.tsx
│       │   │   ├── forgot-password/page.tsx
│       │   │   ├── reset-password/page.tsx
│       │   │   └── verify-email/page.tsx
│       │   ├── (app)/
│       │   │   ├── layout.tsx
│       │   │   ├── loading.tsx
│       │   │   ├── error.tsx
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── pos/
│       │   │   │   ├── page.tsx
│       │   │   │   └── loading.tsx
│       │   │   ├── inventory/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── receive/page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   ├── sales/
│       │   │   │   ├── page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   ├── reports/page.tsx
│       │   │   ├── users/page.tsx
│       │   │   └── settings/page.tsx
│       │   ├── api/
│       │   │   └── auth/callback/route.ts
│       │   ├── layout.tsx
│       │   ├── not-found.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                  (shadcn/ui)
│       │   ├── BranchSelector.tsx
│       │   ├── RoleGuard.tsx
│       │   ├── OfflineBanner.tsx
│       │   └── ReceiptModal.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useBranch.ts
│       │   └── useSync.ts
│       ├── lib/
│       │   ├── db.ts
│       │   ├── syncPull.ts
│       │   ├── syncPush.ts
│       │   └── formatCurrency.ts
│       ├── types/
│       │   └── database.ts          (generated: supabase gen types typescript)
│       ├── public/
│       │   ├── manifest.json
│       │   └── icons/
│       ├── middleware.ts
│       ├── next.config.ts
│       └── package.json
├── packages/
│   ├── data-client/
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── supabase-browser.ts
│   │   │   │   ├── supabase-server.ts
│   │   │   │   ├── result.ts
│   │   │   │   └── errors.ts
│   │   │   ├── clients/
│   │   │   │   ├── medications.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── sales.ts
│   │   │   │   ├── branches.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── audit.ts
│   │   │   │   ├── sync.ts
│   │   │   │   └── notifications.ts
│   │   │   ├── schemas/
│   │   │   │   ├── organizations.ts
│   │   │   │   ├── medications.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── sales.ts
│   │   │   │   ├── users.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── business-rules/
│       ├── src/
│       │   ├── fefo.ts
│       │   ├── reorder.ts
│       │   ├── expiry.ts
│       │   ├── types.ts
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/
│   │   ├── 20240001_organizations_branches_users.sql
│   │   ├── 20240002_roles_permissions.sql
│   │   ├── 20240003_medications_suppliers.sql
│   │   ├── 20240004_inventory_ledger.sql
│   │   ├── 20240005_sales.sql
│   │   ├── 20240006_audit_sync_notifications.sql
│   │   ├── 20240007_views_functions.sql
│   │   └── 20240008_expiry_cron.sql
│   └── functions/
│       ├── sync/push.ts
│       ├── sync/pull.ts
│       └── expiry-digest/index.ts
├── docs/
│   ├── architecture.md
│   ├── master-build-prompt.md
│   ├── business-rules.md            (written in Session 6)
│   └── session-0-deliverables.md
├── .env.example
├── .gitignore
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json                       (optional, recommended)
```

---

## Deliverable 4 — Phase 1 Task Breakdown

### Session 1 — Repo Scaffold
| # | Sub-task | Acceptance criteria | Rules |
|---|---|---|---|
| 1.1 | pnpm workspace root | `pnpm install` succeeds | — |
| 1.2 | apps/web Next.js 14 + Tailwind + App Router | `pnpm --filter web dev` serves :3000 | — |
| 1.3 | next-pwa + manifest.json | PWA manifest loads in DevTools; no console errors | Rule 2 |
| 1.4 | shadcn/ui + brand color tokens | Primary #0F7938, secondary #1A4D8F in theme | — |
| 1.5 | packages/data-client scaffold | `typecheck` passes; two supabase client files exist | Rule 1 |
| 1.6 | packages/business-rules scaffold | `vitest` runs with 0 tests, no error | — |
| 1.7 | supabase init + seed.sql + start | `supabase start` succeeds | — |
| 1.8 | .env.example | Committed; .env.local in .gitignore | — |

### Session 2 — Database Schema
| # | Sub-task | Acceptance criteria | Rules |
|---|---|---|---|
| 2.1 | organizations, branches, users + RLS | `db reset` clean; cross-org query = 0 rows | Rule 4 |
| 2.2 | roles, permissions, role_permissions, user_roles + RLS + seed | 7 roles seeded | Rule 4 |
| 2.3 | medications_master, suppliers + RLS + FTS + updated_seq | Barcode lookup works; FTS on generic_name works | Rules 1,4 |
| 2.4 | inventory, inventory_batches, stock_movements + trigger + RLS | delta=10 → stock=10; delta=-3 → stock=7 | Rules 3,4 |
| 2.5 | pg_cron reconciliation job | Forced mismatch → audit_logs row created | Rule 3 |
| 2.6 | sales, sale_items + UNIQUE(device_id, branch_id, sale_number) + RLS | Duplicate silent ignore confirmed | Rules 2,4 |
| 2.7 | audit_logs, sync_cursors, notifications + RLS | audit_logs has no UPDATE/DELETE policy | Rule 4 |
| 2.8 | Views + get_user_organization_id() | View query returns only own branch data | Rule 4 |
| 2.9 | supabase gen types typescript | Zero TypeScript errors from generated types | — |

### Session 3 — Typed Data Client
| # | Sub-task | Acceptance criteria | Rules |
|---|---|---|---|
| 3.1 | Zod schemas for all entities | `.parse()` rejects invalid input | — |
| 3.2 | Result<T> and AppError types | All functions return `Promise<Result<T>>` | — |
| 3.3 | medications client | create → get by id → same data | Rule 1 |
| 3.4 | inventory client | recordStockReceipt → stock updated | Rules 1,3 |
| 3.5 | sales client | recordSale → stock decremented | Rules 1,3 |
| 3.6 | branches, users, audit, sync, notifications clients | Each: create + read test passes | Rule 1 |
| 3.7 | RLS integration tests | Org B user → org A data → empty | Rule 4 |
| 3.8 | No direct Supabase imports outside data-client | `grep` confirms | Rule 1 |

### Session 4 — App Shell
| # | Sub-task | Acceptance criteria | Rules |
|---|---|---|---|
| 4.1 | useAuth hook + PKCE callback | Sign in/out works | — |
| 4.2 | Register form + org creation | Org row + org_admin role created | Rule 1 |
| 4.3 | Auth pages (login, forgot, reset, verify) | Full flow end-to-end | — |
| 4.4 | middleware.ts auth guard | Redirects correct in both directions | — |
| 4.5 | Authenticated layout + BranchSelector | Branch switch updates context | — |
| 4.6 | RoleGuard | Cashier cannot see inventory:receive content | — |
| 4.7 | Executive dashboard | All data from data-client; currency_code from record | Rules 1,5 |
| 4.8 | loading, error, not-found | Skeleton shown; error retry works | — |

### Session 5 — Offline POS
| # | Sub-task | Acceptance criteria | Rules |
|---|---|---|---|
| 5.1 | Dexie schema | Tables visible in DevTools IndexedDB | Rule 2 |
| 5.2 | syncPull | Medications in Dexie; cursor stored | Rule 2 |
| 5.3 | POS search (Dexie, offline) | Search while offline → results shown | Rules 1,2 |
| 5.4 | Cart + FEFO batch selection | Nearest-expiry batch auto-selected | Rules 2,5 |
| 5.5 | Sale completion → Dexie → receipt | Offline sale completes immediately | Rule 2 |
| 5.6 | syncPush background worker | Online → sale in Supabase within 30s | Rules 2,3 |
| 5.7 | Duplicate push idempotency | Push twice → one row in Supabase | — |
| 5.8 | Edge Function: sync/push | curl test: stock_movements row created | Rules 1,3 |
| 5.9 | Edge Function: sync/pull | Cursor advances correctly | — |
| 5.10 | OfflineBanner | Shown offline; hidden online | Rule 2 |

### Session 6 — Business Rules + Expiry Intelligence
| # | Sub-task | Acceptance criteria | Rules |
|---|---|---|---|
| 6.1 | selectBatches + 8 unit tests | All pass in < 2s | — |
| 6.2 | calculateReorderPoint + 4 unit tests | Fractional usage rounds up | — |
| 6.3 | scoreExpiryRisk + 6 unit tests | All severity levels covered | — |
| 6.4 | pg_cron expiry job + notifications | 3 critical batches → 3 notifications | — |
| 6.5 | 24h dedup guard | Job run twice → still 3 notifications | — |
| 6.6 | expiry-digest Edge Function | Integration: email sent in test mode | — |
| 6.7 | docs/business-rules.md | 3 worked examples per algorithm | — |

---

## Deliverable 5 — Risks and Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **sale_number collision across offline devices** | High | High | Device-scoped numbers + UNIQUE(device_id, branch_id, sale_number). Server assigns branch_sale_number on sync. |
| R2 | **RLS misconfiguration exposes cross-tenant data** | Low | Critical | Integration test in every migration: org B user queries org A tables → asserts 0 rows. Run in CI. |
| R3 | **Inventory drift** | Medium | High | Nightly pg_cron reconciliation; discrepancy → audit_log + notification. Test: tamper current_stock → verify job detects it. |
| R4 | **FEFO selection error** | Low | High | Pure function with 8 unit tests. Integration test verifies sale_items.batch_id matches FEFO expectation. |
| R5 | **Stale offline medication data** | Medium | Medium | syncPull on online event + every 30 min. POS shows "Data as of {time}" indicator. |
| R6 | **xmin cursor wrapping** | Medium | High | Use updated_seq bigint sequence on all syncable tables instead of xmin. (Confirmed.) |
| R7 | **JWT org_id claim lag after org change** | Low | Medium | Force auth.refreshSession() on org change. get_user_organization_id() as fallback for admin actions. |
| R8 | **Stale PWA app shell after deploy** | Medium | Medium | Workbox content-hashed assets. skipWaiting + clientsClaim. "Update available" banner on controllerchange. |
| R9 | **Edge Function cold-start latency** | Medium | Low | Sync is background/non-blocking per Rule 2. Acceptable. |
| R10 | **New table created without RLS** | Medium | High | Rule 4 in CLAUDE.md. Code review checklist: CREATE TABLE count == ROW LEVEL SECURITY count per migration file. |
