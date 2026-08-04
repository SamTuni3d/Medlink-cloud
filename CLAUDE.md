# MedLink Cloud — Claude Code Rules

This file is read at the start of every session. Follow all rules here unless the user explicitly overrides one for a specific session.

---

## Project Identity

**MedLink Cloud** is a multi-tenant, offline-capable pharmacy management SaaS.
- **Phase A** (current): Next.js 15 PWA + Supabase backend — all business logic lives here.
- **Phase B** (future): FastAPI service extracted when a specific trigger is hit (see `docs/architecture.md` §8). Do not pre-build Phase B infrastructure.

Primary market: Ghana (GHS). Multi-currency support is designed in (`currency_code` on every monetary record) but only GHS ships in Phase 1.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TypeScript 5 (strict), Tailwind CSS 3, shadcn/ui |
| PWA | next-pwa (Workbox), service worker, offline cache |
| Offline store | Dexie.js (IndexedDB wrapper) |
| Backend | Supabase (Postgres 15, Auth, Edge Functions, Storage, Realtime) |
| Scheduled jobs | pg_cron (runs inside Supabase Postgres) |
| Monorepo | **pnpm workspaces** (not Turborepo) |
| Validation | Zod (shared between frontend and the future FastAPI contract) |
| Testing | Vitest (unit/integration), Playwright (E2E) |

---

## Folder Structure

```
medlink-cloud/
├── apps/
│   └── web/                   # Next.js 15 App Router PWA
│       ├── app/               # Routes (App Router)
│       │   ├── (app)/         # Authenticated app routes
│       │   │   └── */actions.ts  # Server Actions — the ONLY mutation boundary
│       │   └── (auth)/        # Login / register
│       ├── components/        # UI components (shadcn/ui + custom)
│       ├── hooks/             # React hooks (useAuth, useBranch, useSync, …)
│       ├── lib/               # Thin wrappers, formatters, constants
│       └── public/            # Static assets, PWA manifest
├── packages/
│   ├── data-client/           # All Supabase data access (Rule 1)
│   │   ├── src/
│   │   │   ├── clients/       # One file per domain (medications, inventory, sales, …)
│   │   │   ├── schemas/       # Zod schemas (doubles as FastAPI contract boundary)
│   │   │   └── index.ts
│   │   └── package.json
│   └── business-rules/        # Pure functions — no I/O, no imports from data-client
│       ├── src/
│       │   ├── fefo.ts
│       │   ├── reorder.ts
│       │   ├── expiry.ts
│       │   └── index.ts
│       └── package.json
├── supabase/
│   ├── migrations/            # Numbered SQL migration files (never modify applied ones)
│   └── functions/             # Edge Functions (sync, notifications, …)
├── docs/
│   ├── architecture.md
│   ├── backend-system-prompt.md  # Full backend rules reference
│   ├── master-build-prompt.md
│   └── business-rules.md      # Keep updated when FEFO/reorder/expiry logic changes
├── CLAUDE.md                  # This file
└── pnpm-workspace.yaml
```

---

## Rule 1 — Abstraction Seam (CRITICAL, never bypass)

**All database reads go through `packages/data-client`.** No component, hook, or route handler may import `@supabase/supabase-js` directly or call `.from()` on a Supabase client.

```
✅  import { getInventory } from '@medlink/data-client'
❌  import { supabase } from '@/lib/supabase'; supabase.from('inventory')...
```

Why: this seam is the Phase A → Phase B migration boundary. If Supabase calls are scattered across the app, migrating to FastAPI requires touching hundreds of files instead of one package.

---

## Rule 2 — Offline-First POS (CRITICAL, never bypass)

The POS route (`/pos`) must work without a network connection.

- A completed sale **writes to Dexie immediately** (cart clears, receipt prints).
- The sync queue runs in the background and pushes to Supabase when online.
- The UI must never `await` a Supabase call on the critical sale-completion path.
- Service worker caches: medication list, inventory snapshot, branch config, recent sales.

If you are about to make the POS block on a network call — **stop and route it through Dexie + the sync queue instead**.

---

## Rule 3 — Inventory Ledger Pairing (CRITICAL, never bypass)

**`inventory.current_stock` is always derived from `stock_movements`**, never set directly.

Pattern:
1. Insert a row into `stock_movements` with a signed `delta` (+N for stock in, −N for stock out).
2. Postgres trigger `trg_stock_movement_update_inventory` fires and applies `delta` to `inventory.current_stock`.
3. A `pg_cron` reconciliation job runs nightly, logs discrepancies to `audit_logs`.

```
✅  INSERT INTO stock_movements (delta = +50, movement_type = 'receipt')
❌  UPDATE inventory SET current_stock = 50
```

---

## Rule 4 — RLS on Every Tenant-Scoped Table

Every table that stores tenant data must have Row Level Security enabled **in the same migration file** as the table creation. Never create a table and plan to add RLS later.

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON my_table
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON my_table
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
```

`get_user_organization_id()` is a stable security-definer function that returns the org for the current JWT.

---

## Rule 5 — Currency Formatting

Always read `currency_code` from the record or the active organization context. Never hardcode `"GHS"` or any currency string in formatting logic.

```ts
✅  formatCurrency(amount, record.currency_code)
❌  formatCurrency(amount, 'GHS')
```

---

## Rule 6 — Branch Scoping by Role

Data visibility must be enforced at **both** the RLS layer and the application layer:

| Role | Branch visibility |
|---|---|
| `super_admin`, `org_admin` | All branches in the organization |
| `branch_manager`, `pharmacist`, `cashier`, `inventory_manager`, `auditor` | Their assigned branch only |

In data-client functions, pass `branchId` when the caller's role is branch-scoped. The `organizationId`-only queries are reserved for org-level operations and must only be called from admin-checked code paths.

---

## Rule 7 — Server Actions Are the Only Mutation Boundary

All data mutations (create, update, delete, state changes) must go through **Next.js Server Actions** in `app/(app)/*/actions.ts` files. Components call actions; actions call data-client; data-client calls Supabase.

```
Component → Server Action (actions.ts) → data-client function → Supabase
```

```ts
// ✅ Correct pattern — actions.ts
'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createMedication } from '@medlink/data-client'

const InputSchema = z.object({ name: z.string().min(1), ... })

export async function addMedicationAction(
  _prev: ActionResult, formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = InputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: { code: 'VALIDATION_ERROR', message: '...' } }
  const result = await createMedication(createClient(), parsed.data)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, data: { id: result.data.id } }
}

// ❌ Wrong — mutation directly in a component or hook
supabase.from('medications_master').insert(...)
```

Server Actions must:
1. Validate all input with Zod before touching the database.
2. Call `revalidatePath('/relevant-route')` after successful mutations.
3. Return `ActionResult<T>` (see Error Handling section).
4. Never expose raw Supabase errors to the client — map them to `AppError`.

---

## Error Handling Standard

All data-client functions return `Result<T>`:

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
type AppError  = { code: string; message: string; details?: unknown }
```

Named error codes (use these strings, do not invent new ones):

| Code | When |
|---|---|
| `VALIDATION_ERROR` | Zod parse failed |
| `NOT_FOUND` | Row doesn't exist |
| `UNAUTHORIZED` | User lacks permission |
| `CONFLICT` | Unique constraint / duplicate |
| `STOCK_INSUFFICIENT` | Requested qty > available |
| `DB_ERROR` | Supabase / Postgres error |
| `NETWORK_ERROR` | Fetch/network failure |
| `UNKNOWN_ERROR` | Catch-all for unexpected throws |

Server Actions return `ActionResult<T>` (same shape, serializable over the wire):

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
```

---

## Performance Rules

- **No N+1 queries.** If you need related data, JOIN in the query or use a view — never loop and query inside a loop.
- **Paginate every list.** Default page size: 50. Maximum: 200. Always accept `limit` and `offset` (or cursor) parameters.
- **KPI aggregations via RPC.** Dashboard totals (sales today, inventory value, etc.) must use Postgres RPCs or views, not client-side `reduce()` over full table fetches.
- **`revalidatePath` after every mutation.** Every Server Action that writes data must call `revalidatePath('/affected-route')` so Next.js invalidates the cache.
- **Select only needed columns.** Never `SELECT *` in production queries — list the columns the schema type requires.

---

## RBAC Roles

| Role | Scope | Key Permissions |
|---|---|---|
| `super_admin` | System | Everything — manage organizations, global config |
| `org_admin` | Organization | Manage branches, users, roles, view all reports |
| `branch_manager` | Branch | Manage inventory, staff, view branch reports |
| `pharmacist` | Branch | Dispense medications, record sales, adjust stock |
| `cashier` | Branch | Record sales (POS), view own sales |
| `inventory_manager` | Branch | Receive stock, run stock takes, view stock reports |
| `auditor` | Organization | Read-only access to all records and audit logs |

Navigation and route guards must check the user's role from the `useAuth()` hook. Never derive permissions from the URL.

---

## Phase 1 Database Entities

| Table | Purpose |
|---|---|
| `organizations` | Top-level tenant |
| `branches` | Physical pharmacy locations within an org |
| `users` | Auth users (linked to `auth.users`) |
| `roles` | Named roles (seeded, not user-created) |
| `permissions` | Granular permission strings |
| `user_roles` | Many-to-many: users ↔ roles, scoped to a branch |
| `medications_master` | Product catalogue (shared across org) |
| `suppliers` | Supplier directory |
| `inventory` | Current stock level per product per branch (derived — see Rule 3) |
| `inventory_batches` | Individual batches with expiry dates (supports FEFO) |
| `stock_movements` | Immutable ledger of every stock change (source of truth) |
| `stock_takes` | Audit header for physical count sessions |
| `sales` | Sale header (branch, cashier, total, timestamp) |
| `sale_items` | Sale line items (medication, batch, qty, price) |
| `audit_logs` | Append-only record of all sensitive actions |
| `sync_cursors` | Per-device, per-table cursor for offline sync protocol |
| `notifications` | System-generated alerts (expiry warnings, reorder alerts) |
| `duty_sessions` | Shift tracking — who clocked in/out at a branch, and when |
| `prescriptions` | Patient prescriptions with status lifecycle (pending → dispensed/cancelled/expired) |
| `prescription_items` | Line items per prescription — medication, qty prescribed vs dispensed |

---

## Migration Template

Every new migration must follow this pattern (copy-paste and fill in):

```sql
-- ============================================================
-- Migration NNN: <Title>
-- <One-line description of what this migration does and why>
-- ============================================================

CREATE TABLE <table_name> (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id         uuid        REFERENCES branches(id) ON DELETE CASCADE,  -- omit if org-scoped
  -- ... domain columns ...
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_<table>_org   ON <table_name>(organization_id);
CREATE INDEX idx_<table>_branch ON <table_name>(branch_id);  -- if branch-scoped

-- Row Level Security (required — same file, no exceptions)
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON <table_name>
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON <table_name>
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- Add UPDATE/DELETE policies only if needed; omit for append-only tables
```

Rules:
- Never modify an existing migration file after it has been applied.
- Always create a new numbered migration.
- Never use raw user input in SQL strings — use parameterized queries only.

---

## Planned Phase 2 Integrations (not yet in codebase)

These integrations are designed but not yet implemented. Do not stub or pre-build them.

| Integration | Purpose | Notes |
|---|---|---|
| **Arkesel SMS** | Prescription ready / low-stock alerts | SMS failure must NEVER block a sale or stock operation — fire-and-forget |
| **OpenFDA API** | Drug interaction checking, medication metadata | Cache responses; never block dispensing on API failure |

When implementing Arkesel: wrap the HTTP call in a try/catch, log failure to `audit_logs`, and return success to the caller regardless. The SMS is a notification, not a gate.

---

## Coding Conventions

- **TypeScript**: strict mode on, no `any`, no non-null assertions except in test files.
- **Zod schemas**: define in `packages/data-client/src/schemas/`. Use `.parse()` at system boundaries (form submission, sync ingestion); use `.safeParse()` when the error path matters.
- **Comments**: only when the *why* is non-obvious. No docstrings on obvious functions.
- **Imports**: use the workspace alias (`@medlink/data-client`, `@medlink/business-rules`). No relative imports crossing package boundaries.
- **Framer-motion**: use only for `whileHover`/`whileTap` interactions. Never set `initial={{ opacity: 0 }}` — in React 19 + Next.js 15, mount animations don't always fire and leave the UI blank.
- **Tests**: integration tests hit the real Supabase local dev stack (`supabase start`). No mocking the database.
- **Edge Functions**: written in TypeScript (Deno). Keep them small — orchestrate, don't implement business logic. Logic lives in `packages/business-rules`.

---

## Pre-Commit Checklist

Run these before every commit:

```bash
# 1. Type check
cd apps/web && npx tsc --noEmit

# 2. Lint
cd apps/web && npx next lint

# 3. Full build
cd apps/web && npx next build
```

Must pass with **zero errors and zero warnings** before committing. Fix the root cause — never suppress with `// @ts-ignore` or `eslint-disable`.

---

## Before Starting Any Session

1. Read this file top-to-bottom.
2. Do not implement Phase B infrastructure — wait for a trigger condition (see `docs/architecture.md` §8).
3. If a rule conflict arises with a "move faster" shortcut, the rule wins.
4. After changing anything in `packages/business-rules`, update `docs/business-rules.md`.
5. After adding a new table, add it to the entity table above.
