import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  default_branch_id: z.string().uuid().nullable(),
  full_name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type User = z.infer<typeof UserSchema>

export const RoleNameSchema = z.enum([
  'super_admin',
  'org_admin',
  'branch_manager',
  'pharmacist',
  'cashier',
  'inventory_manager',
  'auditor',
])

export type RoleName = z.infer<typeof RoleNameSchema>

export const UserRoleSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable(),
  granted_by: z.string().uuid(),
  granted_at: z.string(),
  // Populated via join with roles table
  role_name: RoleNameSchema.optional(),
})

export type UserRole = z.infer<typeof UserRoleSchema>
