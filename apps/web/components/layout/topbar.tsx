'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Wifi, WifiOff, ChevronDown, Bell } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MobileNav } from './mobile-nav'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pos': 'Point of Sale',
  '/inventory': 'Inventory',
  '/sales': 'Sales',
  '/reports': 'Reports',
  '/users': 'Users',
  '/settings': 'Settings',
}

function OnlineIndicator() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <div className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex ${
      online
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
      {online ? 'Online' : 'Offline'}
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
    </div>
  )
}

function BranchSelector() {
  const { branches, activeBranch, setActiveBranch, loading } = useBranch()

  if (loading || branches.length === 0) return null

  return (
    <Select
      value={activeBranch?.id ?? ''}
      onValueChange={id => {
        const branch = branches.find(b => b.id === id)
        if (branch) setActiveBranch(branch)
      }}
    >
      <SelectTrigger className="h-8 w-[160px] border-slate-200 bg-slate-50 text-xs font-medium dark:border-slate-700 dark:bg-slate-800">
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map(branch => (
          <SelectItem key={branch.id} value={branch.id} className="text-sm">
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Topbar() {
  const { user, primaryRole } = useAuth()
  const pathname = usePathname()

  const pageTitle = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? ''

  const fullName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'User'
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const roleLabel = primaryRole?.replace(/_/g, ' ') ?? ''

  return (
    <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 md:px-6">
      {/* Mobile menu */}
      <MobileNav />

      {/* Page title */}
      <div className="hidden md:block">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <BranchSelector />
        <OnlineIndicator />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-start leading-none sm:flex">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{fullName}</span>
              {primaryRole && (
                <span className="mt-0.5 text-[10px] capitalize text-slate-500 dark:text-slate-400">{roleLabel}</span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">{fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {primaryRole && (
                  <Badge variant="secondary" className="mt-1 w-fit text-xs capitalize">
                    {roleLabel}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <SignOutButton />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
