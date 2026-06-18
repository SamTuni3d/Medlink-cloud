# MedLink Cloud — Backend System Prompt

**Purpose:** Comprehensive reference for every backend decision in Phase A. Read this before implementing any server-side feature. The rules here extend and elaborate on `CLAUDE.md`.

**Last updated:** 2026-06-17

---

## 1. Stack Declaration

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 15.x |
| Runtime | Node.js (app) + Deno (Edge Functions) | 22.x / Deno 1.x |
| Language | TypeScript (strict — no `any`, no `!`) | 5.x |
| Database | Supabase Postgres | 15 |
| Auth | Supabase Auth (email/password, PKCE flow) | — |
| Scheduled jobs | pg_cron inside Supabase Postgres | — |
| Monorepo | pnpm workspaces | 9.x |
| Validation | Zod | 3.x |
| ORM / query | Supabase JS client (via data-client only) | 2.x |

**Not in use:** Turborepo, Prisma, tRPC, GraphQL, Redis (Phase B only), FastAPI (Phase B only).

---

## 2. Six Core Architecture Rules

### 2.1 Multi-Tenancy — Always Filter by `organization_id`

Every query that touches tenant data must scope to `organization_id`. This is enforced at two levels simultaneously:

**DB level (RLS):** Every tenant table has a `get_user_organization_id()` policy (see §5).

**Application level:** Every data-client function that accepts an `organizationId` parameter must pass it to the query. Never omit it and rely on RLS alone — defense in depth.

```ts
// ✅ Correct
const { data } = await client
  .from('medications_master')
  .select('id, name')
  .eq('organization_id', organizationId)

// ❌ Wrong — relying on RLS alone
const { data } = await client.from('medications_master').select('id, name')
```

### 2.2 Branch Scoping by Role

| Role | Can query | Enforcement |
|---|---|---|
| `super_admin`, `org_admin` | All branches in the org | Pass `organizationId` only |
| `branch_manager`, `pharmacist`, `cashier`, `inventory_manager`, `auditor` | Their branch only | Pass both `organizationId` + `branchId` |

At the Server Action boundary, read the caller's role from the Supabase Auth JWT claims and select the appropriate query scope before calling the data-client. Never let the client tell you which branch to use without verifying role entitlement.

### 2.3 Stock Is Append-Only — Trigger Owns `current_stock`

`inventory.current_stock` is derived exclusively from the `stock_movements` ledger via the Postgres trigger `trg_stock_movement_update_inventory`. Application code never writes to it directly.

```
INSERT stock_movements (delta = +50) → trigger fires → inventory.current_stock += 50
```

All movement types: `receipt`, `sale`, `adjustment`, `transfer_in`, `transfer_out`, `expiry_write_off`, `opening_stock`.

The nightly pg_cron job (`reconcile_inventory`) compares `current_stock` against `SUM(delta)` for every `(branch_id, medication_id)` pair and logs discrepancies to `audit_logs`.

### 2.4 Role Hierarchy Enforced at DB and Application Layer

**DB layer:** RLS policies use `get_user_organization_id()` and optionally a `get_user_branch_id()` helper. These read from the JWT, which Supabase signs — they cannot be spoofed by client code.

**Application layer:** Server Actions must call `requireRole(client, ['branch_manager', 'org_admin'])` (or equivalent) before executing any mutation. Never trust a role claim from the request body.

Pattern:
```ts
// actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'

export async function adjustStockAction(...): Promise<ActionResult> {
  const client = createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } }

  const roles: string[] = user.user_metadata?.roles ?? []
  const allowed = ['pharmacist', 'branch_manager', 'org_admin', 'super_admin']
  if (!roles.some(r => allowed.includes(r))) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Insufficient permissions' } }
  }
  // ... proceed
}
```

### 2.5 Server Actions Are the Only Mutation Boundary

The data flow for every mutation is fixed:

```
Browser component
  → Server Action  (app/(app)/*/actions.ts)
    → data-client function  (packages/data-client/src/clients/*.ts)
      → Supabase Postgres
```

No component, hook, or API route handler may call a data-client write function directly. All inputs are Zod-validated inside the Server Action before being passed to data-client.

### 2.6 Data-Client Is the Only Read Layer

All reads follow the same path:

```
Browser component / Server Component
  → data-client function  (packages/data-client/src/clients/*.ts)
    → Supabase Postgres (via RLS)
```

The one exception: Server Components may use `createClient()` from `@/lib/supabase/server` to call data-client functions server-side. They must not call `.from()` directly.

---

## 3. Full Schema Reference

See `docs/architecture.md` §3 for the full ERD. Key notes for backend work:

**Tables that are org-scoped (no `branch_id`):**
- `organizations`, `medications_master`, `suppliers`, `roles`, `permissions`, `role_permissions`

**Tables that are branch-scoped (have both `organization_id` + `branch_id`):**
- `branches`, `inventory`, `inventory_batches`, `stock_movements`, `stock_takes`, `sales`, `sale_items`, `notifications`, `sync_cursors`

**Tables that are user-scoped:**
- `users`, `user_roles`, `audit_logs`

**Append-only / immutable tables (no UPDATE or DELETE RLS policy):**
- `stock_movements`, `audit_logs`

**Computed / derived columns (never write directly):**
- `inventory.current_stock` — owned by `trg_stock_movement_update_inventory`
- `inventory.available_stock` — view-computed: `current_stock - reserved_stock`

---

## 4. Security Rules

### 4.1 Authentication Boilerplate

Every Server Action starts with:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function myAction(formData: FormData): Promise<ActionResult> {
  const client = createClient()                          // server-side client
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return unauthorized()              // always check auth first
  // ... role check ...
  // ... zod validation ...
  // ... call data-client ...
  revalidatePath('/affected-route')
  return { ok: true, data: undefined }
}
```

### 4.2 Zod on Every Input

No raw `formData.get(...)` values touch the database. Always parse through a named Zod schema first.

```ts
const Schema = z.object({
  medication_id: z.string().uuid(),
  quantity: z.number().int().positive(),
})

const parsed = Schema.safeParse(payload)
if (!parsed.success) {
  return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }
}
```

### 4.3 RLS Policy Templates

```sql
-- Standard read + insert (most tables)
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select" ON my_table
  FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "tenant_insert" ON my_table
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- Branch-scoped read (inventory, sales, etc.)
CREATE POLICY "branch_select" ON my_table
  FOR SELECT USING (
    organization_id = get_user_organization_id()
    AND (
      branch_id = get_user_branch_id()
      OR get_user_role() IN ('org_admin', 'super_admin')
    )
  );

-- Append-only (stock_movements, audit_logs)
-- No UPDATE or DELETE policy — omit them entirely
CREATE POLICY "tenant_insert" ON stock_movements
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
```

### 4.4 No String-Interpolated SQL

Never construct SQL by concatenating user-controlled values. Always use parameterized Supabase queries or named Postgres functions (RPCs).

```ts
// ✅ Parameterized
client.from('sales').select('*').eq('branch_id', branchId)

// ❌ Never do this
client.rpc('raw_query', { sql: `SELECT * FROM sales WHERE branch_id = '${branchId}'` })
```

---

## 5. Error Handling Standard

### 5.1 `Result<T>` in data-client

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
type AppError  = { code: string; message: string; details?: unknown }
```

### 5.2 `ActionResult<T>` in Server Actions

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
```

### 5.3 Named Error Codes

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Zod parse failed |
| `NOT_FOUND` | Row doesn't exist |
| `UNAUTHORIZED` | User lacks permission |
| `CONFLICT` | Unique constraint / duplicate |
| `STOCK_INSUFFICIENT` | Requested qty > available |
| `DB_ERROR` | Supabase / Postgres error |
| `NETWORK_ERROR` | Fetch / network failure |
| `UNKNOWN_ERROR` | Unexpected throw |

### 5.4 try/catch Wrapper Pattern

Every data-client function:

```ts
export async function myQuery(client: SupabaseClient, ...): Promise<Result<MyType>> {
  try {
    const { data, error } = await client.from('my_table').select('...')
    if (error) return err(toAppError(error))
    const parsed = MySchema.safeParse(data)
    if (!parsed.success) return err(toAppError(parsed.error))
    return ok(parsed.data)
  } catch (e) {
    return err(toAppError(e))
  }
}
```

`toAppError` maps any thrown value → `AppError` with code `UNKNOWN_ERROR`.

---

## 6. Performance Rules

### 6.1 No N+1 Queries

If you need related data (e.g. medication name for each inventory row), JOIN in the SQL or use a view — never fetch a list and then loop to fetch each row's related data.

```ts
// ✅ Single query via view
client.from('v_inventory_with_batches').select('*').eq('branch_id', branchId)

// ❌ N+1
const rows = await getInventory(...)
for (const row of rows) {
  const med = await getMedication(row.medication_id)  // N extra queries
}
```

### 6.2 Paginate Every List

```ts
export async function getItems(
  client: SupabaseClient,
  branchId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<Result<Item[]>> {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0
  const { data, error } = await client
    .from('items')
    .select('...')
    .eq('branch_id', branchId)
    .range(offset, offset + limit - 1)
  ...
}
```

### 6.3 KPI Aggregations via RPC

Dashboard totals must use Postgres RPCs or materialized views — not client-side reduce over full fetches.

```sql
CREATE OR REPLACE FUNCTION get_branch_kpis(p_branch_id uuid, p_date date)
RETURNS TABLE (sales_today_count int, sales_today_amount numeric, ...)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(total_amount), 0)
  FROM sales
  WHERE branch_id = p_branch_id
    AND created_at::date = p_date
    AND status = 'completed';
$$;
```

### 6.4 `revalidatePath` After Every Mutation

```ts
// actions.ts — after successful write
revalidatePath('/inventory')
revalidatePath('/dashboard')
```

### 6.5 Select Only Needed Columns

```ts
// ✅ List the columns you need
client.from('medications_master').select('id, name, dosage_form, selling_price')

// ❌ Avoid in production queries
client.from('medications_master').select('*')
```

---

## 7. Integration Specifications (Phase 2 — not yet implemented)

### 7.1 Arkesel SMS

**Purpose:** Prescription-ready notifications and critical low-stock alerts to pharmacy managers.

**Key rule:** SMS failure must **never** block a sale, stock operation, or any other business transaction. Fire-and-forget pattern only.

```ts
async function sendSmsNotification(to: string, message: string): Promise<void> {
  try {
    await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': process.env.ARKESEL_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sender: 'MedLink', message, recipients: [to] }),
    })
  } catch (e) {
    // Log to audit_logs but do NOT rethrow
    console.error('SMS failed (non-fatal):', e)
  }
}
```

Environment variable: `ARKESEL_API_KEY` (server-side only, never expose to client).

### 7.2 OpenFDA API

**Purpose:** Drug interaction checking and medication metadata enrichment.

**Key rule:** Never block dispensing on an OpenFDA API failure. Cache responses in Postgres to avoid rate limits and provide offline fallback.

```ts
async function lookupDrug(name: string): Promise<OpenFDAResult | null> {
  // 1. Check cache in medications_master.openfda_cache (jsonb column — future)
  // 2. If stale/missing, fetch from https://api.fda.gov/drug/label.json?search=...
  // 3. Store result in cache with TTL
  // 4. On any failure, return null — caller must handle gracefully
}
```

Environment variable: `OPENFDA_API_KEY` (optional — unauthenticated requests have lower rate limits).

---

## 8. Migration Checklist

Before writing a new migration:
- [ ] Does every new table have `organization_id NOT NULL`?
- [ ] Does every branch-scoped table have `branch_id NOT NULL`?
- [ ] Is RLS enabled with at least a SELECT policy in the same file?
- [ ] Are there indexes on `organization_id` and `branch_id`?
- [ ] Is the migration file numbered sequentially (never a gap, never a duplicate)?
- [ ] Does the migration read cleanly when applied to a fresh database?

---

## 9. Pre-Commit Checklist

Run before every commit, fix every failure, never suppress:

```bash
# Type check
cd apps/web && npx tsc --noEmit

# Lint (zero warnings allowed)
cd apps/web && npx next lint

# Full production build
cd apps/web && npx next build
```

After any change to `packages/data-client` or `packages/business-rules`:
- [ ] Update `docs/business-rules.md` if logic changed
- [ ] Update the entity table in `CLAUDE.md` if a new table was added
- [ ] Confirm the Zod schema matches the Postgres column types exactly
