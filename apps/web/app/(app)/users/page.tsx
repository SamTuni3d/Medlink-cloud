'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Search, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { listUsersWithRoles, updateUser } from '@medlink/data-client'
import type { UserWithRoles, RoleName } from '@medlink/data-client'

const ROLE_COLORS: Record<RoleName, string> = {
  super_admin:       'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  org_admin:         'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  branch_manager:    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  pharmacist:        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cashier:           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  inventory_manager: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  auditor:           'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

const ROLE_LABELS: Record<RoleName, string> = {
  super_admin:       'Super Admin',
  org_admin:         'Org Admin',
  branch_manager:    'Branch Manager',
  pharmacist:        'Pharmacist',
  cashier:           'Cashier',
  inventory_manager: 'Inventory Manager',
  auditor:           'Auditor',
}

export default function UsersPage() {
  const { organizationId, user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) { setLoading(false); return }
    setLoading(true); setError(null)
    const result = await listUsersWithRoles(createClient(), organizationId)
    if (result.ok) setUsers(result.data)
    else setError(result.error.message)
    setLoading(false)
  }, [organizationId])

  useEffect(() => { void load() }, [load])

  async function toggleActive(user: UserWithRoles) {
    setTogglingId(user.id)
    const result = await updateUser(createClient(), user.id, { is_active: !user.is_active })
    if (result.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: result.data.is_active } : u))
    } else {
      setError(result.error.message)
    }
    setTogglingId(null)
  }

  const filtered = users.filter(u =>
    search === '' ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = users.filter(u => u.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {!loading && (
          <p className="text-sm text-muted-foreground">
            {activeCount} active · {users.length - activeCount} inactive
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Loading…' : `${filtered.length} user${filtered.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Users className="h-10 w-10" />
              <p className="text-sm">No users found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(u => (
                <div key={u.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                  {/* Avatar initials */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {u.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{u.full_name}</span>
                      {u.id === currentUser?.id && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                  </div>

                  {/* Role badges */}
                  <div className="hidden sm:flex flex-wrap gap-1 max-w-[200px]">
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No roles</span>
                    ) : (
                      u.roles.map(role => (
                        <span key={role}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? ''}`}>
                          {ROLE_LABELS[role] ?? role}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-xs hidden sm:inline-flex">
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {u.id !== currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleActive(u)}
                        disabled={togglingId === u.id}
                        aria-label={u.is_active ? 'Deactivate user' : 'Activate user'}
                      >
                        {u.is_active
                          ? <ToggleRight className="h-5 w-5 text-primary" />
                          : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
