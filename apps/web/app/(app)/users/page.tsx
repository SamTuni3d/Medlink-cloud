'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, UserCheck, UserX, Clock, LogIn, LogOut as LogOutIcon,
  Search, RefreshCw, ToggleLeft, ToggleRight, ChevronDown,
  ChevronRight, ShoppingBag, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import {
  listUsersWithRoles, updateUser,
  getActiveDutySessions, clockIn, clockOut, getDutyHistory,
  getSalesLog,
} from '@medlink/data-client'
import type { UserWithRoles, DutySessionWithUser, SaleLogEntry, RoleName, Branch } from '@medlink/data-client'
import { inviteStaffAction, getBranchesAction } from './actions'

const ROLE_COLORS: Record<RoleName, string> = {
  super_admin:       'bg-purple-100 text-purple-800',
  org_admin:         'bg-blue-100 text-blue-800',
  branch_manager:    'bg-cyan-100 text-cyan-800',
  pharmacist:        'bg-green-100 text-green-800',
  cashier:           'bg-yellow-100 text-yellow-800',
  inventory_manager: 'bg-orange-100 text-orange-800',
  auditor:           'bg-gray-100 text-gray-800',
}

const ROLE_LABELS: Record<RoleName, string> = {
  super_admin:       'Super Admin',
  org_admin:         'Org Admin',
  branch_manager:    'Branch Manager',
  pharmacist:        'Pharmacist',
  cashier:           'Cashier',
  inventory_manager: 'Inv. Manager',
  auditor:           'Auditor',
}

type Tab = 'staff' | 'duty' | 'sales'
type DateFilter = 'today' | 'week' | 'month'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  )
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(amount)
}

function elapsedStr(from: string, now: Date) {
  const mins = Math.floor((now.getTime() - new Date(from).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

function getDateRange(filter: DateFilter): { fromDate: string; toDate: string } {
  const now = new Date()
  const toDate = now.toISOString()
  if (filter === 'today') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    return { fromDate: from.toISOString(), toDate }
  }
  if (filter === 'week') {
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    return { fromDate: from.toISOString(), toDate }
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { fromDate: from.toISOString(), toDate }
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  color?: 'emerald' | 'blue' | 'gray'
}

function StatCard({ label, value, icon: Icon, color = 'gray' }: StatCardProps) {
  const colorMap = {
    emerald: 'bg-[hsl(175_35%_91%)] text-[#004741]',
    blue:    'bg-blue-50 text-blue-600',
    gray:    'bg-muted text-muted-foreground',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: 'org_admin',         label: 'Org Admin' },
  { value: 'branch_manager',    label: 'Branch Manager' },
  { value: 'pharmacist',        label: 'Pharmacist' },
  { value: 'cashier',           label: 'Cashier' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'auditor',           label: 'Auditor' },
]

const BRANCH_SCOPED = new Set(['branch_manager', 'pharmacist', 'cashier', 'inventory_manager', 'auditor'])

export default function UsersPage() {
  const { organizationId, user: currentUser } = useAuth()
  const { activeBranch } = useBranch()
  const { toast } = useToast()

  const [tab, setTab] = useState<Tab>('staff')

  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [activeSessions, setActiveSessions] = useState<DutySessionWithUser[]>([])
  const [dutyHistory, setDutyHistory] = useState<DutySessionWithUser[]>([])
  const [salesLog, setSalesLog] = useState<SaleLogEntry[]>([])

  const [usersLoading, setUsersLoading] = useState(true)
  const [dutyLoading, setDutyLoading] = useState(false)
  const [salesLoading, setSalesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [cashierFilter, setCashierFilter] = useState('')

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [clockInOpen, setClockInOpen] = useState(false)
  const [clockInUserId, setClockInUserId] = useState('')
  const [clockInNotes, setClockInNotes] = useState('')
  const [clockingIn, setClockingIn] = useState(false)
  const [clockingOutId, setClockingOutId] = useState<string | null>(null)
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)

  // Invite staff
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: '', branchId: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadUsers = useCallback(async () => {
    if (!organizationId) { setUsersLoading(false); return }
    setUsersLoading(true); setError(null)
    const result = await listUsersWithRoles(createClient(), organizationId)
    if (result.ok) setUsers(result.data)
    else setError(result.error.message)
    setUsersLoading(false)
  }, [organizationId])

  const loadDuty = useCallback(async () => {
    if (!activeBranch?.id) return
    setDutyLoading(true)
    const [activeRes, historyRes] = await Promise.all([
      getActiveDutySessions(createClient(), activeBranch.id),
      getDutyHistory(createClient(), activeBranch.id, { limit: 20 }),
    ])
    if (activeRes.ok) setActiveSessions(activeRes.data)
    if (historyRes.ok) setDutyHistory(historyRes.data)
    setDutyLoading(false)
  }, [activeBranch?.id])

  const loadSalesLog = useCallback(async () => {
    if (!activeBranch?.id) return
    setSalesLoading(true)
    const { fromDate, toDate } = getDateRange(dateFilter)
    const result = await getSalesLog(createClient(), activeBranch.id, {
      fromDate,
      toDate,
      cashierId: cashierFilter || undefined,
      limit: 50,
    })
    if (result.ok) setSalesLog(result.data)
    setSalesLoading(false)
  }, [activeBranch?.id, dateFilter, cashierFilter])

  useEffect(() => { void loadUsers() }, [loadUsers])
  useEffect(() => { void loadDuty() }, [loadDuty])
  useEffect(() => { void loadSalesLog() }, [loadSalesLog])

  useEffect(() => {
    setBranchesLoading(true)
    void getBranchesAction().then(r => {
      if (r.ok) setBranches(r.data)
      setBranchesLoading(false)
    })
  }, [])

  async function handleToggleActive(u: UserWithRoles) {
    setTogglingId(u.id)
    const result = await updateUser(createClient(), u.id, { is_active: !u.is_active })
    if (result.ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: result.data.is_active } : x))
    } else {
      setError(result.error.message)
    }
    setTogglingId(null)
  }

  async function handleInvite() {
    if (!organizationId || !currentUser) return
    setInviteError(null)
    setInviting(true)
    const result = await inviteStaffAction({
      fullName:       inviteForm.fullName,
      email:          inviteForm.email,
      role:           inviteForm.role as RoleName & string,
      branchId:       inviteForm.branchId || null,
      organizationId,
      invitedBy:      currentUser.id,
    })
    setInviting(false)
    if (!result.ok) { setInviteError(result.error.message); return }
    toast({ title: 'Invitation sent', description: `${inviteForm.fullName} will receive an email to set up their account.` })
    setInviteOpen(false)
    setInviteForm({ fullName: '', email: '', role: '', branchId: '' })
    void loadUsers()
  }

  async function handleClockIn() {
    if (!clockInUserId || !activeBranch?.id || !organizationId) return
    setClockingIn(true)
    const result = await clockIn(createClient(), {
      organization_id: organizationId,
      branch_id: activeBranch.id,
      user_id: clockInUserId,
      clocked_in_by: currentUser?.id ?? null,
      notes: clockInNotes || null,
    })
    if (result.ok) {
      setClockInOpen(false); setClockInUserId(''); setClockInNotes('')
      await loadDuty()
    } else {
      setError(result.error.message)
    }
    setClockingIn(false)
  }

  async function handleClockOut(sessionId: string) {
    setClockingOutId(sessionId)
    const result = await clockOut(createClient(), sessionId)
    if (result.ok) await loadDuty()
    else setError(result.error.message)
    setClockingOutId(null)
  }

  const onDutyIds = new Set(activeSessions.map(s => s.user_id))
  const activeCount = users.filter(u => u.is_active).length
  const inactiveCount = users.length - activeCount

  const filteredUsers = users.filter(u =>
    search === '' ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const availableToClockIn = users.filter(u => u.is_active && !onDutyIds.has(u.id))

  const TABS: { key: Tab; label: string }[] = [
    { key: 'staff', label: 'Staff' },
    { key: 'duty', label: `On Duty${activeSessions.length > 0 ? ` (${activeSessions.length})` : ''}` },
    { key: 'sales', label: 'Sales Log' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => { setInviteError(null); setInviteOpen(true) }}
          >
            <Users className="mr-2 h-4 w-4" />
            Invite Staff
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => { void loadUsers(); void loadDuty(); void loadSalesLog() }}
            disabled={usersLoading || dutyLoading || salesLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(usersLoading || dutyLoading || salesLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =================== STAFF TAB =================== */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Staff"   value={users.length}   icon={Users}        />
            <StatCard label="On Duty"       value={activeSessions.length} icon={UserCheck} color="emerald" />
            <StatCard label="Active"        value={activeCount}    icon={CheckCircle2} color="blue" />
            <StatCard label="Inactive"      value={inactiveCount}  icon={UserX}        />
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Card>
            <CardContent className="pt-4">
              {usersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Users className="h-10 w-10" />
                  <p className="text-sm">No users found.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        {initials(u.full_name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-sm">{u.full_name}</span>
                          {u.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                          {onDutyIds.has(u.id) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(175_35%_91%)] px-2 py-0.5 text-xs font-medium text-[#004741]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#004741] animate-pulse" />
                              On Duty
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>

                      <div className="hidden md:flex flex-wrap gap-1 max-w-[180px]">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No role</span>
                        ) : (
                          u.roles.map(role => (
                            <span
                              key={role}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role as RoleName] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {ROLE_LABELS[role as RoleName] ?? role}
                            </span>
                          ))
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-xs hidden sm:inline-flex">
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => void handleToggleActive(u)}
                            disabled={togglingId === u.id}
                            aria-label={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active
                              ? <ToggleRight className="h-5 w-5 text-primary" />
                              : <ToggleLeft  className="h-5 w-5 text-muted-foreground" />}
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
      )}

      {/* =================== ON DUTY TAB =================== */}
      {tab === 'duty' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {activeSessions.length === 0
                ? 'No staff currently on duty.'
                : `${activeSessions.length} staff member${activeSessions.length !== 1 ? 's' : ''} on duty`}
            </p>
            <Button onClick={() => setClockInOpen(true)} disabled={availableToClockIn.length === 0}>
              <LogIn className="mr-2 h-4 w-4" />
              Clock In Staff
            </Button>
          </div>

          {dutyLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
          ) : activeSessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Clock className="h-10 w-10" />
                <p className="text-sm">No one is clocked in. Use &ldquo;Clock In Staff&rdquo; to start a shift.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeSessions.map(s => (
                <Card key={s.id} className="border-l-4 border-l-[#004741]">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: 'hsl(175 35% 91%)', color: '#004741' }}>
                          {initials(s.user_name)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{s.user_name}</p>
                          <p className="text-xs text-muted-foreground">{s.user_email}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(175_35%_91%)] px-2 py-0.5 text-xs font-medium text-[#004741] shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#004741] animate-pulse" />
                        On Duty
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Since {fmtTime(s.clocked_in_at)} · {elapsedStr(s.clocked_in_at, now)}</span>
                    </div>

                    {s.notes && (
                      <p className="mt-1.5 text-xs text-muted-foreground italic truncate">{s.notes}</p>
                    )}

                    <Button
                      variant="outline" size="sm" className="mt-3 w-full"
                      onClick={() => void handleClockOut(s.id)}
                      disabled={clockingOutId === s.id}
                    >
                      <LogOutIcon className="mr-1.5 h-3.5 w-3.5" />
                      {clockingOutId === s.id ? 'Clocking out…' : 'Clock Out'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Recent shift history */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Shifts
            </h3>
            <Card>
              <CardContent className="pt-2">
                {dutyHistory.filter(s => s.clocked_out_at !== null).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No completed shifts yet.</p>
                ) : (
                  <div className="divide-y">
                    {dutyHistory
                      .filter(s => s.clocked_out_at !== null)
                      .slice(0, 10)
                      .map(s => {
                        const durationMins = Math.round(
                          (new Date(s.clocked_out_at!).getTime() - new Date(s.clocked_in_at).getTime()) / 60_000
                        )
                        const dur = durationMins < 60
                          ? `${durationMins}m`
                          : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
                        return (
                          <div key={s.id} className="flex items-center gap-3 py-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                              {initials(s.user_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{s.user_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(s.clocked_in_at)} · {fmtTime(s.clocked_in_at)} – {fmtTime(s.clocked_out_at!)}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground shrink-0">{dur}</span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =================== SALES LOG TAB =================== */}
      {tab === 'sales' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border text-sm divide-x">
              {(['today', 'week', 'month'] as DateFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    dateFilter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>

            <Select
              value={cashierFilter || 'all'}
              onValueChange={v => setCashierFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {users.filter(u => u.is_active).map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {salesLoading
                  ? 'Loading…'
                  : `${salesLog.length} sale${salesLog.length !== 1 ? 's' : ''}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : salesLog.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <ShoppingBag className="h-10 w-10" />
                  <p className="text-sm">No sales found for this period.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {salesLog.map(sale => (
                    <div key={sale.id}>
                      <button
                        className="w-full flex items-center gap-3 py-3 hover:bg-muted/40 rounded transition-colors text-left px-1"
                        onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                      >
                        {expandedSaleId === sale.id
                          ? <ChevronDown  className="h-4 w-4 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}

                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                          {initials(sale.cashier_name)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{sale.cashier_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {fmtDateTime(sale.created_at)} · {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {fmtCurrency(sale.total_amount, sale.currency_code)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{sale.payment_method}</p>
                        </div>
                      </button>

                      {expandedSaleId === sale.id && (
                        <div className="ml-11 mb-2 space-y-1">
                          {sale.items.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded bg-muted/50 px-3 py-1.5 text-xs"
                            >
                              <span className="font-medium truncate">{item.medication_name}</span>
                              <span className="text-muted-foreground shrink-0">
                                {item.quantity} × {fmtCurrency(item.unit_price, sale.currency_code)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Staff dialog */}
      <Dialog open={inviteOpen} onOpenChange={open => { if (!open && !inviting) setInviteOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                placeholder="e.g. Ama Owusu"
                value={inviteForm.fullName}
                onChange={e => setInviteForm(f => ({ ...f, fullName: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="e.g. ama@pharmacy.com"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={inviteForm.role}
                onValueChange={v => setInviteForm(f => ({ ...f, role: v, branchId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteForm.role && BRANCH_SCOPED.has(inviteForm.role) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Branch</label>
                <Select
                  value={inviteForm.branchId}
                  onValueChange={v => setInviteForm(f => ({ ...f, branchId: v }))}
                  disabled={branchesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={branchesLoading ? 'Loading branches…' : 'Select branch'} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.length === 0 && !branchesLoading ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                        No branches found
                      </div>
                    ) : (
                      branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {inviteError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{inviteError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              They will receive an email with a link to set up their password and log in.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
            <Button
              onClick={() => void handleInvite()}
              disabled={inviting || !inviteForm.fullName || !inviteForm.email || !inviteForm.role}
            >
              {inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clock In dialog */}
      <Dialog
        open={clockInOpen}
        onOpenChange={open => {
          if (!open) { setClockInOpen(false); setClockInUserId(''); setClockInNotes('') }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clock In Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Staff Member</label>
              <Select value={clockInUserId} onValueChange={setClockInUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {availableToClockIn.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                placeholder="e.g. Morning shift"
                value={clockInNotes}
                onChange={e => setClockInNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleClockIn()} disabled={!clockInUserId || clockingIn}>
              {clockingIn ? 'Clocking in…' : 'Clock In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
