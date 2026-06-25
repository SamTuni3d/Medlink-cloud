'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, GitBranch, User, Save, Plus, Pencil, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { getOrganization, getBranches } from '@medlink/data-client'
import type { Organization, Branch } from '@medlink/data-client'
import {
  createBranchAction,
  updateBranchAction,
  updateOrganizationAction,
  updateUserProfileAction,
} from './actions'

type Tab = 'organization' | 'branches' | 'profile'

export default function SettingsPage() {
  const { user, organizationId } = useAuth()

  const [tab, setTab] = useState<Tab>('organization')
  const [org, setOrg] = useState<Organization | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Org form
  const [orgName, setOrgName] = useState('')
  const [orgCity, setOrgCity] = useState('')
  const [orgReg, setOrgReg] = useState('')

  // New branch form
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchAddress, setNewBranchAddress] = useState('')
  const [addingBranch, setAddingBranch] = useState(false)
  const [showAddBranch, setShowAddBranch] = useState(false)

  // Edit branch inline
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editBranchName, setEditBranchName] = useState('')

  // Profile form
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string) ?? ''
  )
  const [phone, setPhone] = useState('')

  const loadData = useCallback(async () => {
    if (!organizationId) { setLoading(false); return }
    setLoading(true)
    const client = createClient()
    const [orgResult, branchResult] = await Promise.all([
      getOrganization(client, organizationId),
      getBranches(client, organizationId, { activeOnly: false }),
    ])
    if (orgResult.ok) {
      setOrg(orgResult.data)
      setOrgName(orgResult.data.name)
      setOrgCity(orgResult.data.city ?? '')
      setOrgReg(orgResult.data.registration_number ?? '')
    }
    if (branchResult.ok) setBranches(branchResult.data)
    setLoading(false)
  }, [organizationId])

  useEffect(() => { void loadData() }, [loadData])

  function flash(type: 'ok' | 'err', text: string) {
    setMessage({ type, text })
    if (type === 'ok') setTimeout(() => setMessage(null), 3000)
    // errors stay until the user acts again
  }

  async function saveOrg() {
    if (!organizationId) return
    setSaving(true)
    setMessage(null)
    const result = await updateOrganizationAction({
      organizationId,
      name: orgName,
      city: orgCity || null,
      registration_number: orgReg || null,
    })
    if (result.ok) flash('ok', 'Organization saved.')
    else flash('err', result.error.message)
    setSaving(false)
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    setMessage(null)
    const result = await updateUserProfileAction({
      userId:   user.id,
      fullName: fullName,
      phone:    phone || null,
    })
    if (result.ok) flash('ok', 'Profile saved.')
    else flash('err', result.error.message)
    setSaving(false)
  }

  async function addBranch() {
    if (!organizationId || !newBranchName.trim()) return
    setAddingBranch(true)
    setMessage(null)
    const result = await createBranchAction({
      organizationId,
      name:    newBranchName.trim(),
      address: newBranchAddress.trim() || null,
    })
    if (result.ok) {
      setBranches(prev => [...prev, result.data as Branch])
      setNewBranchName('')
      setNewBranchAddress('')
      setShowAddBranch(false)
      flash('ok', 'Branch created.')
    } else {
      flash('err', result.error.message)
    }
    setAddingBranch(false)
  }

  async function saveBranchName(id: string) {
    if (!editBranchName.trim()) return
    setMessage(null)
    const result = await updateBranchAction({ branchId: id, name: editBranchName.trim() })
    if (result.ok) {
      setBranches(prev => prev.map(b => b.id === id ? (result.data as Branch) : b))
      setEditingBranchId(null)
      flash('ok', 'Branch updated.')
    } else {
      flash('err', result.error.message)
    }
  }

  const TABS: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'organization', label: 'Organization', icon: Building2 },
    { key: 'branches',     label: 'Branches',     icon: GitBranch },
    { key: 'profile',      label: 'My Profile',   icon: User },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {message && (
        <div className={`flex items-start justify-between gap-3 rounded-md px-4 py-3 text-sm ${
          message.type === 'ok'
            ? 'bg-[hsl(175_35%_91%)] text-[#004741]'
            : 'bg-destructive/10 text-destructive'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setMessage(null) }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Organization tab */}
      {tab === 'organization' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/2" />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Pharmacy / organization name</Label>
                  <Input id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgCity">City</Label>
                  <Input id="orgCity" value={orgCity} onChange={e => setOrgCity(e.target.value)} placeholder="Accra" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgReg">Registration number</Label>
                  <Input id="orgReg" value={orgReg} onChange={e => setOrgReg(e.target.value)} placeholder="Optional" />
                </div>
                {org && (
                  <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <span className="text-muted-foreground">Currency</span>
                    <span>{org.currency_code}</span>
                    <span className="text-muted-foreground">Country</span>
                    <span>{org.country}</span>
                    <span className="text-muted-foreground">Plan</span>
                    <span className="capitalize">{org.subscription_tier ?? 'Starter'}</span>
                  </div>
                )}
                <Button onClick={() => void saveOrg()} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Branches tab */}
      {tab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {branches.length} branch{branches.length !== 1 ? 'es' : ''}
            </p>
            <Button size="sm" onClick={() => { setShowAddBranch(v => !v); setMessage(null) }}>
              <Plus className="mr-2 h-4 w-4" />
              Add branch
            </Button>
          </div>

          {showAddBranch && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Branch name <span className="text-destructive">*</span></Label>
                  <Input
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    placeholder="e.g. Kumasi Branch"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') void addBranch() }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address (optional)</Label>
                  <Input
                    value={newBranchAddress}
                    onChange={e => setNewBranchAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void addBranch()}
                    disabled={addingBranch || !newBranchName.trim()}
                  >
                    {addingBranch ? 'Creating…' : 'Create branch'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddBranch(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No branches yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click Add branch to create your first one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {branches.map(branch => (
                <Card key={branch.id}>
                  <CardContent className="flex items-center gap-3 py-3">
                    {editingBranchId === branch.id ? (
                      <>
                        <Input
                          value={editBranchName}
                          onChange={e => setEditBranchName(e.target.value)}
                          className="flex-1 h-8"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveBranchName(branch.id)
                            if (e.key === 'Escape') setEditingBranchId(null)
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => void saveBranchName(branch.id)} aria-label="Save">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingBranchId(null)} aria-label="Cancel">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{branch.name}</p>
                          {branch.address && (
                            <p className="text-xs text-muted-foreground truncate">{branch.address}</p>
                          )}
                        </div>
                        <Badge variant={branch.is_active ? 'default' : 'secondary'} className="text-xs">
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingBranchId(branch.id); setEditBranchName(branch.name) }}
                          aria-label="Edit branch name"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile tab */}
      {tab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ''} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+233 24 000 0000"
              />
            </div>
            <Button onClick={() => void saveProfile()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
