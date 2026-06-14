import { z } from 'zod'

export const NotificationTypeSchema = z.enum([
  'expiry_warning',
  'reorder_alert',
  'reconciliation_discrepancy',
  'system',
])

export type NotificationType = z.infer<typeof NotificationTypeSchema>

export const NotificationSeveritySchema = z.enum(['info', 'warning', 'critical'])

export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable(),
  type: NotificationTypeSchema,
  severity: NotificationSeveritySchema,
  title: z.string(),
  body: z.string(),
  related_table: z.string().nullable(),
  related_id: z.string().uuid().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
})

export type Notification = z.infer<typeof NotificationSchema>
