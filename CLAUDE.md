# MedLink Cloud — Claude Code Rules

This file is read at the start of every session. Follow all rules here unless the user explicitly overrides one for a specific session.

---

## Project Identity

**MedLink Cloud** is a multi-tenant, offline-capable pharmacy management SaaS.
- **Phase A** (current): Next.js 14 PWA + Supabase backend — all business logic lives here.
- **Phase B** (future): FastAPI service extracted when a specific trigger is hit (see `docs/architecture.md` §8). Do not pre-build Phase B infrastructure.

Primary market: Ghana (GHS). Multi-currency support is designed in (currency_code on every monetary record) but only GHS ships in Phase 1.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, React 19, TypeScript 5, Tailwind CSS 3, shadcn/ui |
| PWA | next-pwa (Workbox), service worker, offline cache |
| Offline store | Dexie.js (IndexedDB wrapper) |
| Backend | Supabase (Postgres 15, Auth, Edge Functions, Storage, Realtime) |
| Scheduled jobs | pg_cron (runs inside Supabase Postgres) |
| Monorepo | pnpm workspaces |
| Validation | Zod (shared between frontend and the future FastAPI contract) |
| Testing | Vitest (unit/integration), Playwright (E2E) |

---

## Folder Structure

```
medlink-cloud/
├── apps/
│   └── web/                   # Next.js 14 App Router PWA
│       ├── app/               # Routes (App Router)
│       ├── components/        # UI components (shadcn/ui + custom)
│       ├── hooks/             # React hooks (useAuth, useBranch, useSync, …)
│       ├── lib/               # Thin wrappers, formatters, constants
│       └── public/            # Static assets, PWA manifest
├── packages/
│   ├── data-client/           # All Supabase data access (rule 1)
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
│   ├── migrations/            # Numbered SQL migration files
│   └── functions/             # Edge Functions (sync, notifications, …)
├── docs/
│   ├── architecture.md
│   ├── master-build-prompt.md
│   └── business-rules.md      # Keep updated when FEFO/reorder/expiry logic changes
├── CLAUDE.md                  # This file
└── pnpm-workspace.yaml
```

---

## Rule 1 — Abstraction Seam (CRITICAL, never bypass)

**All database access goes through `packages/data-client`.** No component, hook, or route handler may import `@supabase/supabase-js` directly or call `.from()` on a Supabase client.

```
✅  import { getInventory } from '@medlink/data-client'
❌  import { supabase } from '@/lib/supabase'; supabase.from('inventory')...
```

Why: this seam is the Phase A → Phase B migration boundary. If Supabase calls are scattered across the app, migrating to FastAPI requires touching hundreds of files instead of one package.

If you are about to bypass this rule "to move faster" — **stop and implement the data-client function instead**.

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
2. A Postgres trigger (`trg_stock_movement_update_inventory`) fires and applies `delta` to `inventory.current_stock`.
3. A `pg_cron` reconciliation job runs nightly and compares `inventory.current_stock` against `SUM(stock_movements.delta)` per product/branch, logging any discrepancy to `audit_logs`.

Never write `UPDATE inventory SET current_stock = X` from application code.

---

## Rule 4 — RLS on Every Tenant-Scoped Table

Every table that stores tenant data must have Row Level Security enabled and at least one policy that scopes rows to `organization_id`. Add RLS policies in the **same migration file** as the table creation. Do not create a table and plan to add RLS later.

Pattern:
```sql
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON inventory
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

---

## Rule 5 — Currency Formatting

Always read `currency_code` from the record or the active organization context. Never hardcode `"GHS"` or any other currency string in formatting logic, even though only GHS ships in Phase 1.

```ts
✅  formatCurrency(amount, record.currency_code)
❌  formatCurrency(amount, 'GHS')
```

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
| `sales` | Sale header (branch, cashier, total, timestamp) |
| `sale_items` | Sale line items (medication, batch, qty, price) |
| `audit_logs` | Append-only record of all sensitive actions |
| `sync_cursors` | Per-device, per-table cursor for offline sync protocol |
| `notifications` | System-generated alerts (expiry warnings, reorder alerts) |

---

## Coding Conventions

- **TypeScript**: strict mode on, no `any`, no non-null assertions except in test files.
- **Zod schemas**: define in `packages/data-client/src/schemas/`. Use `.parse()` at system boundaries (form submission, sync ingestion); use `.safeParse()` when the error path matters.
- **Comments**: only when the *why* is non-obvious. No docstrings on obvious functions.
- **Imports**: use the workspace alias (`@medlink/data-client`, `@medlink/business-rules`). No relative imports crossing package boundaries.
- **Error handling**: surface Supabase errors through a typed `Result<T, AppError>` return (not thrown). UI handles `AppError`.
- **Tests**: integration tests hit the real Supabase local dev stack (`supabase start`). No mocking the database — we learned from past incidents where mock/prod divergence masked broken migrations.
- **Migrations**: never modify an existing migration file after it has been applied. Always create a new numbered migration.
- **Edge Functions**: written in TypeScript (Deno). Keep them small — orchestrate, don't implement business logic. Logic lives in `packages/business-rules`.

---

## Before Starting Any Session

1. Check which session number this is (0–6) and what its scope is.
2. Do not implement work from a future session — scope is deliberate.
3. If a rule conflict arises with a "move faster" shortcut, the rule wins.
4. After changing anything in `packages/business-rules`, update `docs/business-rules.md`.
