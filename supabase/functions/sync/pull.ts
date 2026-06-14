// Edge Function: sync/pull
// Returns rows from a syncable table that have been updated since a cursor.
// The cursor is the value of updated_seq (a bigint sequence column).
//
// GET /functions/v1/sync/pull?table=<name>&cursor=<number>&branch_id=<uuid>&limit=<number>
// Returns: { rows: unknown[], next_cursor: number }
//
// Syncable tables: medications_master, inventory, inventory_batches

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYNCABLE_TABLES = new Map<string, { cursor_col: string; org_col: string; branch_col?: string }>([
  ['medications_master', { cursor_col: 'updated_seq', org_col: 'organization_id' }],
  ['inventory',          { cursor_col: 'updated_seq', org_col: 'organization_id', branch_col: 'branch_id' }],
  ['inventory_batches',  { cursor_col: 'updated_seq', org_col: 'organization_id', branch_col: 'branch_id' }],
])

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const tableName = url.searchParams.get('table') ?? ''
  const cursor = parseInt(url.searchParams.get('cursor') ?? '0', 10)
  const branchId = url.searchParams.get('branch_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500)

  const tableConfig = SYNCABLE_TABLES.get(tableName)
  if (!tableConfig) {
    return new Response(JSON.stringify({ error: `Table '${tableName}' is not syncable` }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (tableConfig.branch_col && !branchId) {
    return new Response(JSON.stringify({ error: 'branch_id required for this table' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // RLS on supabase client automatically scopes to the user's organization.
  // The gt(cursor_col) filter implements cursor-based pagination.
  let query = supabase
    .from(tableName)
    .select('*')
    .gt(tableConfig.cursor_col, cursor)
    .order(tableConfig.cursor_col, { ascending: true })
    .limit(limit)

  if (tableConfig.branch_col && branchId) {
    query = query.eq(tableConfig.branch_col, branchId)
  }

  const { data, error } = await query
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = data ?? []
  const nextCursor =
    rows.length > 0
      ? (rows[rows.length - 1] as Record<string, unknown>)[tableConfig.cursor_col] as number
      : cursor

  return new Response(JSON.stringify({ rows, next_cursor: nextCursor }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
