import { z } from 'zod'

export const SyncCursorSchema = z.object({
  id: z.string().uuid(),
  device_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  table_name: z.string(),
  last_cursor: z.number().int(),
  updated_at: z.string(),
})

export type SyncCursor = z.infer<typeof SyncCursorSchema>

export const SyncCursorUpsertSchema = z.object({
  device_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  table_name: z.string().min(1),
  last_cursor: z.number().int().min(0),
})

export type SyncCursorUpsert = z.infer<typeof SyncCursorUpsertSchema>
