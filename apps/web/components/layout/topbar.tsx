'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MobileNav } from './mobile-nav'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'

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
    <Badge
      variant={online ? 'default' : 'destructive'}
      className="hidden gap-1 text-xs sm:flex"
    >
      {online ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {online ? 'Online' : 'Offline'}
    </Badge>
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
      <SelectTrigger className="h-8 w-[180px] text-sm">
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map(branch => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Topbar() {
  const { user, primaryRole } = useAuth()

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string)
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="flex h-16 items-center gap-3 border-b bg-card px-4">
      <MobileNav />

      <div className="flex flex-1 items-center gap-3">
        <BranchSelector />
      </div>

      <div className="flex items-center gap-3">
        <OnlineIndicator />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-start sm:flex">
              <span className="text-sm font-medium leading-none">
                {(user?.user_metadata?.full_name as string) ?? user?.email ?? ''}
              </span>
              {primaryRole && (
                <span className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {primaryRole.replace('_', ' ')}
                </span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {(user?.user_metadata?.full_name as string) ?? 'My Account'}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
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
