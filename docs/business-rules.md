# Business Rules

All pure functions live in `packages/business-rules/src/`.  
No I/O. No imports from `data-client` or any Next.js module.  
Each function is unit-tested with 100 % branch/function/line/statement coverage.

---

## 1. FEFO Batch Selection (`fefo.ts`)

**Function:** `selectBatches(batches: Batch[], quantityNeeded: number): BatchSelection[]`

### Algorithm

1. Return `[]` immediately if `quantityNeeded === 0`.
2. Filter out batches where `quantity_remaining === 0`.
3. Sort remaining batches:
   - Batches **with** an `expiry_date` come first, sorted ascending (soonest expiry first — **FEFO**).
   - Batches **without** an `expiry_date` (non-expiring items) come last, sorted ascending by `received_at` (**FIFO** within that group).
4. Sum total available stock. Throw `InsufficientStockError` if `total < quantityNeeded`.
5. Greedily allocate from sorted batches until `quantityNeeded` is satisfied.

### Worked example

| Batch | Expiry     | Qty |
|-------|------------|-----|
| A     | 2025-03-01 |  4  |
| B     | 2025-06-01 | 10  |
| C     | null       |  5  |

`selectBatches([A, B, C], 7)` →
1. Sort order: A → B → C
2. Take 4 from A, need 3 more → take 3 from B
3. Result: `[{ batch_id: 'A', quantity: 4 }, { batch_id: 'B', quantity: 3 }]`

### Error

`InsufficientStockError(needed, available)` — thrown when total available < quantityNeeded.

---

## 2. Reorder Point Calculation (`reorder.ts`)

**Function:** `calculateReorderPoint(params): number`

### Formula

```
reorder_point = ceil(average_daily_usage × (lead_time_days + safety_stock_days))
```

| Parameter           | Type   | Default | Description                                    |
|---------------------|--------|---------|------------------------------------------------|
| `average_daily_usage` | number | —      | Average units sold per day                     |
| `lead_time_days`    | number | —       | Days between placing an order and receiving it |
| `safety_stock_days` | number | 7       | Extra buffer days to absorb demand variability |

### Worked example

A medication sells 10 units/day. The supplier takes 5 days to deliver. Safety stock = 7 days (default).

```
reorder_point = ceil(10 × (5 + 7)) = ceil(120) = 120
```

A reorder alert fires when `inventory.current_stock` falls to or below 120.

### Edge cases

- `average_daily_usage = 0` → result is `0` (no usage, no reorder threshold).
- Fractional usage is rounded **up** (`Math.ceil`) to avoid an under-stocked buffer.

---

## 3. Expiry Risk Scoring (`expiry.ts`)

**Function:** `scoreExpiryRisk(params): ExpiryRiskScore`

### Inputs

| Parameter              | Type   | Default      | Description                      |
|------------------------|--------|--------------|----------------------------------|
| `expiry_date`          | Date   | —            | Expiry date of the batch         |
| `quantity_remaining`   | number | —            | Units still in stock             |
| `average_daily_usage`  | number | —            | Average units sold per day       |
| `today`                | Date   | `new Date()` | Reference date (injectable)      |

### Output

```ts
{
  score: 'critical' | 'high' | 'medium' | 'low',
  days_to_expiry: number,   // whole days remaining
  days_of_stock:  number,   // ceil(qty / usage) or 999_999 if usage = 0
}
```

### Algorithm

Both dates are normalised to **midnight** before comparison so time-of-day differences don't affect day counts.

```
days_to_expiry = floor((expiryMidnight − todayMidnight) / 86_400_000)

days_of_stock  = quantity_remaining / average_daily_usage   (Infinity if usage = 0)

willClearBeforeExpiry = days_of_stock < days_to_expiry
```

Scoring rules evaluated **in priority order**:

| Priority | Score    | Condition                                       |
|----------|----------|-------------------------------------------------|
| 1        | critical | `days_to_expiry ≤ 30` AND `!willClearBeforeExpiry` |
| 2        | low      | `days_to_expiry > 90` OR `willClearBeforeExpiry`   |
| 3        | high     | `days_to_expiry ≤ 60`                           |
| 4        | medium   | _(catch-all: 61–90 days)_                       |

### Worked examples

**Critical — expiry soon, slow mover:**
- Expiry in 20 days, 100 units at 1/day → `days_of_stock = 100` → won't clear → **critical**

**Low — will sell before expiry:**
- Expiry in 25 days, 5 units at 5/day → `days_of_stock = 1` < 25 → **low**

**High — 45 days, slow mover:**
- Expiry in 45 days, 1 000 units at 1/day → `days_of_stock = 1000` > 45 → not critical (>30), not low (≤90 and won't clear), ≤60 → **high**

**Medium — 75 days, slow mover:**
- Expiry in 75 days, 1 000 units at 1/day → neither critical nor low nor ≤60 → **medium**

**Zero usage:**
- `average_daily_usage = 0` → `days_of_stock = Infinity` (represented as `999_999` in the returned object) → `willClearBeforeExpiry = false` → scored by days_to_expiry alone.

---

## Database counterpart

`supabase/migrations/20240009_expiry_cron.sql` implements the same scoring logic in PL/pgSQL inside `fn_detect_expiring_batches()`, which runs nightly at 01:00 UTC via `pg_cron`. It inserts one `notifications` row (type `expiry_alert`) per critical/high batch per day — de-duplicated by a unique index on `(branch_id, metadata->>'batch_id', DATE(created_at))`.

If the scoring thresholds in `expiry.ts` change, update the SQL function in a **new** migration to match.
