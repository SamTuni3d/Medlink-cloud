import { z } from 'zod'

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable(),
  actor_id: z.string().uuid().nullable(),
  action: z.string(),
  table_name: z.string(),
  record_id: z.string().uuid().nullable(),
  old_value: z.record(z.unknown()).nullable(),
  new_value: z.record(z.unknown()).nullable(),
  ip_address: z.string().nullable(),
  created_at: z.string(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

export const AuditLogInsertSchema = z.object({
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
  actor_id: z.string().uuid().nullable().optional(),
  action: z.string().min(1),
  table_name: z.string().min(1),
  record_id: z.string().uuid().nullable().optional(),
  old_value: z.record(z.unknown()).nullable().optional(),
  new_value: z.record(z.unknown()).nullable().optional(),
  ip_address: z.string().nullable().optional(),
})

export type AuditLogInsert = z.infer<typeof AuditLogInsertSchema>
