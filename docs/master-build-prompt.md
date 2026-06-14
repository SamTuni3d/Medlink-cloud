# MedLink Cloud — Master Build Prompt

This document is the comprehensive specification for building Phase A of MedLink Cloud. Feed it to Claude Code at the start of Session 0. It defines what to build, how to build it, and what deliverables to produce before writing any code.

---

## Before Writing Any Code: Five Required Deliverables

Session 0 must produce these five artifacts. Do not begin Session 1 until all five are signed off.

### Deliverable 1 — Architecture Confirmation

Read `docs/architecture.md` in full. Confirm or propose refinements to:
- The abstraction seam location (packages/data-client)
- The Phase A → Phase B boundary definition
- The multi-tenancy RLS approach
- The offline sync protocol (§4)

Output: a short written confirmation or a list of proposed amendments with rationale.

### Deliverable 2 — Phase 1 ERD

Produce a text-formatted ERD covering all 16 Phase 1 tables:
`organizations, branches, users, roles, permissions, role_permissions, user_roles, medications_master, suppliers, inventory, inventory_batches, stock_movements, sales, sale_items, audit_logs, sync_cursors, notifications`

For each table include: all columns with types and constraints, foreign keys, and indexes (PKs, FKs, any composite unique constraints). Pay special attention to the inventory ↔ stock_movements ledger relationship and the FEFO-relevant columns on `inventory_batches`.

### Deliverable 3 — Folder Structure Confirmation

Confirm the folder structure from `CLAUDE.md` is correct and complete for Phase 1 scope. Add any missing directories for:
- Next.js App Router conventions (route groups, layout files, loading.tsx, error.tsx)
- Supabase local dev (seed.sql, config.toml)
- Shared type definitions

### Deliverable 4 — Phase 1 Task Breakdown

Produce a numbered task list for Sessions 1–6, broken into sub-tasks small enough to be individually testable. Each sub-task should state: what it builds, what its acceptance criteria are, and which rule(s) from CLAUDE.md it exercises.

### Deliverable 5 — Risks and Mitigations

Document the top risks for Phase 1 with mitigations. Must cover at minimum:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Offline sync conflict (duplicate sale_number across devices) | Medium | High | Idempotent upsert with device_id+sale_number unique constraint; ON CONFLICT DO NOTHING |
| RLS misconfiguration exposing cross-tenant data | Low | Critical | RLS integration test suite; automated check that no query returns rows from a different org |
| Inventory drift (current_stock diverges from movements sum) | Medium | High | nightly pg_cron reconciliation; alert to audit_logs on discrepancy |
| FEFO selection error (wrong batch deducted at POS) | Low | High | Unit tests with known batch sets; FEFO logic is pure and easily testable |
| PWA cache stale medication prices | Medium | Medium | Cache invalidation on sync pull; price always read from server on sync, not cached indefinitely |

---

## Session 1 — Repo Scaffold

### Goal
Create the full monorepo structure so that all subsequent sessions have a stable foundation to build on.

### Tasks

**1.1 — pnpm workspace**
- `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
- Root `package.json` with workspaces, engines (`node >=20`), and dev scripts: `dev`, `build`, `test`, `lint`, `typecheck`
- Root `tsconfig.json` (base config, `strict: true`)
- Root `.eslintrc.json` (Next.js + TypeScript rules)
- Root `.prettierrc`
- `.gitignore` (node_modules, .next, .env*, supabase/.temp)

**1.2 — apps/web (Next.js 14)**
- `pnpm create next-app@latest apps/web --typescript --tailwind --app --src-dir no`
- Configure `next.config.ts`:
  - `withPWA` from `next-pwa`
  - `transpilePackages: ['@medlink/data-client', '@medlink/business-rules']`
- `public/manifest.json` (PWA manifest: name, icons, theme_color, display: standalone)
- shadcn/ui init: `npx shadcn@latest init` (default style: Default, base color: Slate)
- Install Dexie.js: `pnpm add dexie`
- Tailwind config: extend theme with MedLink brand colors (primary: #0F7938, secondary: #1A4D8F)
- `app/layout.tsx` skeleton with font (Geist Sans), metadata, and `<Providers>` wrapper

**1.3 — packages/data-client**
- `package.json`: `{ "name": "@medlink/data-client", "main": "./src/index.ts" }`
- `tsconfig.json` extending root
- Install: `@supabase/supabase-js`, `zod`
- `src/index.ts` — re-exports all client functions (empty stubs for now)
- `src/lib/supabase.ts` — the **only** place that creates the Supabase client
- `src/schemas/index.ts` — re-exports all Zod schemas

**1.4 — packages/business-rules**
- `package.json`: `{ "name": "@medlink/business-rules", "main": "./src/index.ts" }`
- `tsconfig.json` extending root
- `src/index.ts` — empty, no imports
- Vitest config

**1.5 — Supabase local dev**
- `supabase/config.toml` (already created by `supabase init`)
- `supabase/seed.sql` — seeds roles and permissions (system data, not tenant data)
- Verify `supabase start` runs cleanly

### Acceptance Criteria
- `pnpm dev` starts the Next.js app on localhost:3000 showing the default layout
- `pnpm typecheck` passes with zero errors
- `pnpm -r build` succeeds for all packages
- `supabase start` starts the local Supabase stack

---

## Session 2 — Database Schema

### Goal
Write all Phase 1 SQL migrations. The database schema is the foundation everything else depends on.

### Tasks

**2.1 — Migration: core tenant tables**
File: `supabase/migrations/20240001_organizations_branches_users.sql`
- `organizations` table
- `branches` table
- `users` table (with FK to `auth.users`)
- RLS on all three (Rule 4)
- Indexes: FK columns, `organizations.id`, `branches.organization_id`

**2.2 — Migration: RBAC tables**
File: `supabase/migrations/20240002_roles_permissions.sql`
- `roles`, `permissions`, `role_permissions`, `user_roles`
- Seed the 7 roles and a full permissions set
- RLS on `user_roles` (users can see their own; org_admin can see all in org)

**2.3 — Migration: product catalogue**
File: `supabase/migrations/20240003_medications_suppliers.sql`
- `medications_master`, `suppliers`
- RLS: org-scoped
- Indexes: `medications_master.barcode`, `medications_master.name` (for search)
- Full-text search index on `name || ' ' || generic_name || ' ' || brand_name`

**2.4 — Migration: inventory ledger**
File: `supabase/migrations/20240004_inventory_ledger.sql`
- `inventory` (with UNIQUE constraint on `branch_id, medication_id`)
- `inventory_batches`
- `stock_movements`
- Trigger function `fn_update_inventory_on_movement`
- Trigger `trg_stock_movement_update_inventory` (AFTER INSERT on stock_movements)
- RLS on all three
- pg_cron reconciliation job (runs nightly at 02:00 UTC):
  ```sql
  SELECT cron.schedule('reconcile-inventory', '0 2 * * *', $$
    INSERT INTO audit_logs (organization_id, action, table_name, new_value)
    SELECT i.organization_id, 'reconciliation_discrepancy', 'inventory',
      jsonb_build_object(
        'medication_id', i.medication_id,
        'branch_id', i.branch_id,
        'stored', i.current_stock,
        'calculated', COALESCE(SUM(sm.delta), 0),
        'delta', i.current_stock - COALESCE(SUM(sm.delta), 0)
      )
    FROM inventory i
    LEFT JOIN stock_movements sm
      ON sm.medication_id = i.medication_id AND sm.branch_id = i.branch_id
    GROUP BY i.id, i.organization_id, i.medication_id, i.branch_id, i.current_stock
    HAVING i.current_stock != COALESCE(SUM(sm.delta), 0);
  $$);
  ```

**2.5 — Migration: sales**
File: `supabase/migrations/20240005_sales.sql`
- `sales`, `sale_items`
- UNIQUE constraint: `(branch_id, sale_number)` — prevents duplicate sync pushes
- RLS: cashier sees own sales; manager sees branch sales; org_admin sees all

**2.6 — Migration: audit and sync**
File: `supabase/migrations/20240006_audit_sync_notifications.sql`
- `audit_logs` (no UPDATE/DELETE policy — append only)
- `sync_cursors` (UNIQUE on `device_id, table_name`)
- `notifications`
- RLS on all three

**2.7 — Migration: helper functions and views**
File: `supabase/migrations/20240007_views_functions.sql`
- View: `v_inventory_with_batches` — joins inventory + batches + medications_master, includes `days_to_nearest_expiry`
- View: `v_branch_sales_summary` — daily sales totals per branch
- Function: `get_user_organization_id()` — returns `organization_id` for `auth.uid()` (used in RLS policies to avoid subquery repetition)

### Acceptance Criteria
- `supabase db reset` runs all migrations cleanly with zero errors
- Insert a `stock_movement` with delta=10 → `inventory.current_stock` becomes 10 (trigger works)
- Insert another with delta=-3 → `inventory.current_stock` becomes 7
- RLS test: connect as user from org A, confirm no rows visible from org B's tables
- `supabase db diff` shows no uncommitted schema changes

---

## Session 3 — Typed Data Client

### Goal
Build `packages/data-client` with full Zod schemas and Supabase-backed implementations for all Phase 1 read/write operations.

### Tasks

**3.1 — Zod schemas**
Files: `packages/data-client/src/schemas/<entity>.ts` for each entity.
Each file exports:
- `<Entity>Schema` — input shape (for form validation and API input)
- `<Entity>RecordSchema` — database row shape (Supabase response)
- TypeScript types inferred from schemas

**3.2 — Result type**
`packages/data-client/src/lib/result.ts`:
```ts
type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: AppError }
type Result<T> = Ok<T> | Err
```
All client functions return `Promise<Result<T>>`.

**3.3 — Client implementations**
One file per domain in `packages/data-client/src/clients/`:

| File | Functions |
|---|---|
| `medications.ts` | `getMedications`, `getMedicationById`, `searchMedications`, `createMedication`, `updateMedication` |
| `inventory.ts` | `getInventory`, `getInventoryWithBatches`, `getBatches`, `recordStockAdjustment`, `recordStockReceipt` |
| `sales.ts` | `recordSale`, `getSales`, `getSaleById`, `voidSale` |
| `branches.ts` | `getBranches`, `getBranchById`, `createBranch`, `updateBranch` |
| `users.ts` | `listUsers`, `getUserById`, `updateUser`, `assignRole`, `removeRole` |
| `audit.ts` | `getAuditLog`, `getAuditLogForRecord` |
| `sync.ts` | `getSyncCursor`, `updateSyncCursor` |
| `notifications.ts` | `getNotifications`, `markNotificationRead` |

**3.4 — Unit tests**
Vitest integration tests (hitting local Supabase) for:
- `recordSale` → triggers stock_movements insert → inventory.current_stock decremented
- `recordStockReceipt` → stock_movements insert → inventory.current_stock incremented
- RLS: calling any function as the wrong tenant returns empty result, not an error

### Acceptance Criteria
- `pnpm --filter @medlink/data-client test` passes
- `pnpm --filter @medlink/data-client typecheck` passes with zero errors
- No direct Supabase calls anywhere outside this package

---

## Session 4 — App Shell (Auth + Admin Dashboard)

### Goal
Build the authenticated app shell: auth flows, navigation, branch selector, RBAC route guards, and executive dashboard skeleton wired to real data.

### Tasks

**4.1 — Auth routes**
- `app/(auth)/register/page.tsx` — form: org name, owner full name, email, phone, country, city, password, confirm password
- `app/(auth)/login/page.tsx` — email + password, link to register and forgot password
- `app/(auth)/forgot-password/page.tsx` — email input, sends Supabase reset email
- `app/(auth)/reset-password/page.tsx` — new password + confirm (token from email link)
- `app/(auth)/verify-email/page.tsx` — "check your email" holding page
- All forms use React Hook Form + Zod resolver (schemas from `@medlink/data-client`)

**4.2 — useAuth hook**
`apps/web/hooks/useAuth.ts`:
- Wraps Supabase Auth + loads user/org/roles from data-client on session change
- Exposes: `{ user, organization, roles, activeBranch, loading, signOut }`
- Persists `activeBranch` in localStorage

**4.3 — Navigation and layout**
- `app/(app)/layout.tsx` — authenticated shell: sidebar + topbar
- Sidebar items derived from role permissions (hide items the user cannot access)
- `components/BranchSelector.tsx` — dropdown showing branches user has access to; updates activeBranch in useAuth
- `components/RoleGuard.tsx` — wraps any content block, hides if user lacks required permission

**4.4 — Next.js middleware**
`middleware.ts` — redirects unauthenticated users to `/login`; redirects authenticated users away from `/login` and `/register`

**4.5 — Executive Dashboard**
`app/(app)/dashboard/page.tsx`:
- Cards: today's total sales, total transactions, low-stock alerts count, expiring-soon count
- Chart: 7-day sales trend (Recharts, data from `v_branch_sales_summary` view)
- Notifications panel: unread notifications from data-client
- All data fetched server-side via `@medlink/data-client` with branch context

**4.6 — Error and loading states**
- `app/(app)/loading.tsx` — skeleton shimmer for dashboard
- `app/(app)/error.tsx` — error boundary with retry button
- `app/not-found.tsx` — 404 page

### Acceptance Criteria
- Register a new org → email verification sent → verify → redirected to dashboard
- Login as org_admin → sees full sidebar
- Login as cashier → sidebar only shows POS and own sales
- Branch selector switches branch context → dashboard data refreshes
- All pages pass `pnpm typecheck` and `pnpm lint`

---

## Session 5 — Offline POS + Sync Edge Function

### Goal
Build the offline-capable POS route and the Supabase Edge Function that handles cursor-based sync.

### Tasks

**5.1 — Dexie schema**
`apps/web/lib/db.ts`:
```ts
class MedLinkDB extends Dexie {
  medications!: Table<MedicationRecord>
  inventory!: Table<InventoryRecord>
  batches!: Table<BatchRecord>
  pendingSales!: Table<PendingSale>     // sales waiting to sync
  completedSales!: Table<CompletedSale> // local receipt history
  syncCursors!: Table<SyncCursor>
}
```
Indexes: `medications.barcode`, `inventory.[branch_id+medication_id]`, `batches.expiry_date`, `pendingSales.created_at`

**5.2 — Sync pull (server → device)**
`apps/web/lib/syncPull.ts`:
- On app start (online) and periodically: pull `medications_master`, `inventory`, `inventory_batches` for active branch
- Uses cursors from `syncCursors` Dexie table
- Upserts pulled rows into Dexie

**5.3 — POS route**
`app/(app)/pos/page.tsx`:
- Product search: reads from Dexie (barcode scan or name search using Dexie's `.where()`)
- Cart: add/remove items, adjust quantities, select batch (auto-selected via FEFO from `@medlink/business-rules`)
- Sale completion:
  1. Validate cart (stock available in Dexie)
  2. Build `PendingSale` record with device-generated `sale_id` (UUID v4) and `sale_number`
  3. Write to `pendingSales` Dexie table (sync=false)
  4. Clear cart, show receipt modal
  5. Background sync worker picks up and pushes to Edge Function
- Receipt modal: sale number, items, total, payment details, print button
- Offline indicator banner (reads `navigator.onLine`)

**5.4 — Sync push worker**
`apps/web/lib/syncPush.ts`:
- Runs on `online` event and on a 30-second interval when online
- Reads `pendingSales` where `synced = false`
- POST to `/functions/v1/sync/push` with batch of up to 50 records
- On success: marks records `synced = true`, moves to `completedSales`
- On partial failure: marks rejected records with `sync_error`, retries later

**5.5 — Edge Function: sync/push**
`supabase/functions/sync/push.ts`:
- Validates JWT
- Accepts batch of sale + sale_items records
- Validates each with Zod (same CreateSaleSchema from data-client schemas)
- Upserts sales and sale_items (ON CONFLICT (branch_id, sale_number) DO NOTHING)
- For each accepted sale: inserts stock_movements rows (one per sale_item, delta = -quantity)
- Returns `{ accepted, rejected }` with reasons

**5.6 — Edge Function: sync/pull**
`supabase/functions/sync/pull.ts`:
- Validates JWT
- Accepts `table`, `cursor`, `branch_id` query params
- Returns rows WHERE `updated_seq > cursor` (add `updated_seq bigint DEFAULT nextval(...)` to syncable tables)
- Returns `{ rows, next_cursor }`

### Acceptance Criteria
- Go offline (DevTools → Network → Offline) → complete a sale → cart clears, receipt shown
- Go back online → sale appears in Supabase within 30 seconds
- Complete the same sale twice offline (duplicate) → only one row in Supabase
- Pull sync → medications appear in Dexie → visible on POS search without network
- `supabase functions serve sync` → integration test with curl passes

---

## Session 6 — Business Rules + Expiry Intelligence

### Goal
Implement `packages/business-rules` with tested pure functions, then wire expiry detection into a scheduled notification pipeline.

### Tasks

**6.1 — FEFO batch selection**
`packages/business-rules/src/fefo.ts`:
```ts
export function selectBatches(
  batches: Batch[],
  quantityNeeded: number
): BatchSelection[]
```
- Sort: expiry_date ASC (nulls last, treated as non-expiring → FIFO fallback by received_at)
- Allocate greedily until quantityNeeded met
- Throw `InsufficientStockError` if total available < quantityNeeded
- Unit tests: 8 scenarios (exact match, split across batches, null expiry, insufficient stock, mixed null/dated, FEFO ordering verified)

**6.2 — Reorder point calculation**
`packages/business-rules/src/reorder.ts`:
```ts
export function calculateReorderPoint(params: {
  average_daily_usage: number
  lead_time_days: number
  safety_stock_days?: number   // default: 7
}): number
```
- Returns `Math.ceil(average_daily_usage * (lead_time_days + safety_stock_days))`
- Unit tests: standard case, zero usage, fractional usage, custom safety days

**6.3 — Expiry risk scoring**
`packages/business-rules/src/expiry.ts`:
```ts
export function scoreExpiryRisk(params: {
  expiry_date: Date
  quantity_remaining: number
  average_daily_usage: number
  today?: Date
}): ExpiryRiskScore
```
See `docs/architecture.md §7.3` for scoring logic.
Unit tests: 6 scenarios covering each severity level and boundary conditions.

**6.4 — Expiry detection cron**
`supabase/migrations/20240008_expiry_cron.sql`:
pg_cron job (daily at 06:00 UTC, after staff arrive):
- Query `inventory_batches` for batches WHERE `expiry_date <= NOW() + INTERVAL '90 days'` AND `quantity_remaining > 0`
- For each batch: call expiry risk scoring logic (replicated as a SQL function for performance)
- Insert into `notifications` for `critical` and `high` risk batches
- Skip if a `critical`/`high` notification for the same batch was created in the last 24h

`supabase/functions/expiry-digest/index.ts` (Edge Function, called by pg_cron via `net.http_post`):
- Aggregates today's critical/high expiry notifications per org
- Sends email digest to org_admin (Supabase Resend integration or direct SMTP)

**6.5 — docs/business-rules.md**
Write documentation covering all three algorithms with:
- Plain-English description
- Formula / pseudocode
- Three worked examples with numbers
- Edge cases and how they're handled

### Acceptance Criteria
- `pnpm --filter @medlink/business-rules test` → all 17+ unit tests pass
- `selectBatches` correctly selects soonest-expiring batch first in a 3-batch scenario
- `scoreExpiryRisk` returns `critical` for a batch expiring in 20 days with 100 units and 2 units/day average usage (won't clear before expiry)
- pg_cron job runs: 3 critical-expiry batches in seed data → 3 notifications appear in `notifications` table
- `docs/business-rules.md` is written and accurate

---

## Quality Standards (Apply Every Session)

### TypeScript
- `strict: true` — no implicit any, no unchecked indexing
- No type assertions (`as Type`) except in test setup
- All database response types generated from Supabase schema (`supabase gen types typescript`)

### Testing
- Unit tests (pure functions): run in < 2s, no I/O
- Integration tests: run against `supabase start` local stack
- Never mock the database — use real queries against seeded local data
- Target: 100% branch coverage on `packages/business-rules`, 80%+ on `packages/data-client`

### Security
- All user input validated with Zod before touching the database
- RLS is the last line of defense — but application code must also scope queries by org/branch
- No secrets in code — all via environment variables
- Supabase service-role key never used in client-side code
- Prescription data: treat as PII, log access to `audit_logs`

### Performance
- No N+1 queries — use joins or batch fetches
- Dashboard queries must complete in < 500ms against a realistic dataset (10k sales, 500 products)
- POS search must return results in < 100ms (queries Dexie, not network)

### Accessibility
- All interactive elements keyboard-accessible
- ARIA labels on icon-only buttons
- Color contrast ratio ≥ 4.5:1 for all text
- Form validation errors announced to screen readers

---

## Environment Variables Required

```env
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# supabase/functions/.env (for Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=          # for email digests (Session 6)
```

Never commit these files. They are in `.gitignore`.
