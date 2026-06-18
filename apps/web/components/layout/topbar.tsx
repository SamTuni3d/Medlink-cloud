'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Wifi, WifiOff, ChevronDown, LogOut } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MobileNav } from './mobile-nav'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/pos':          'Point of Sale',
  '/inventory':    'Inventory',
  '/prescriptions':'Prescriptions',
  '/sales':        'Sales',
  '/procurement':  'Procurement',
  '/expiry':       'Expiry Management',
  '/stock-take':   'Stock Take',
  '/reports':      'Reports',
  '/notifications':'Notifications',
  '/users':        'Users',
  '/settings':     'Settings',
  '/admin/library':'Drug Library',
}

function OnlineIndicator() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const on  = () => setOnline(true)
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
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
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
      <SelectTrigger className="h-8 w-[160px] border-[hsl(20_25%_89%)] bg-white text-xs font-medium dark:border-white/10 dark:bg-white/5">
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
  const router = useRouter()

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

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-3 sm:px-4 md:px-6"
      style={{ borderColor: 'hsl(20 25% 89%)', boxShadow: '0 1px 0 0 hsl(20 25% 92%)' }}
    >
      {/* Mobile hamburger */}
      <MobileNav />

      {/* Page title */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="hidden h-5 w-[3px] shrink-0 rounded-full md:block"
          style={{ background: '#741A2F' }}
        />
        <h1
          className="truncate text-sm font-bold md:text-base"
          style={{ color: '#741A2F' }}
        >
          {pageTitle}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <BranchSelector />
        <OnlineIndicator />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 rounded-xl px-1.5 py-1 outline-none transition-colors hover:bg-[hsl(33_90%_93%)] sm:gap-2 sm:px-2 sm:py-1.5"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{ background: '#741A2F', color: '#FFC680' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start leading-none sm:flex">
                <span className="text-xs font-semibold" style={{ color: '#200910' }}>{fullName}</span>
                {primaryRole && (
                  <span className="mt-0.5 text-[10px] capitalize text-muted-foreground">{roleLabel}</span>
                )}
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {primaryRole && (
                  <span
                    className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                    style={{ background: 'hsl(33 90% 93%)', color: '#741A2F' }}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
