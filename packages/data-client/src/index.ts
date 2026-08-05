// Data client — all Supabase data access for MedLink Cloud.
// Rule 1: no component or hook may import @supabase/supabase-js directly.
// All functions accept a SupabaseClient as their first parameter (dependency injection).
// The client is created in apps/web/lib/supabase/{client,server}.ts and passed here.

export type { Result, Ok, Err, AppError } from './lib/result'
export { ok, err } from './lib/result'
export { toAppError } from './lib/errors'

// Schemas (Zod + inferred types) — also serve as the Phase B FastAPI contract boundary
export * from './schemas'

// Data access functions
export * from './clients/organizations'
export * from './clients/medications'
export * from './clients/inventory'
export * from './clients/sales'
export * from './clients/branches'
export * from './clients/users'
export * from './clients/audit'
export * from './clients/sync'
export * from './clients/notifications'
export * from './clients/suppliers'
export * from './clients/stock-takes'
export * from './clients/procurement'
export * from './clients/duty'
export * from './clients/library'
export * from './clients/prescriptions'
export * from './clients/counseling'
