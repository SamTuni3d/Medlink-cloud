'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, BarChart2,
  Users, Settings, Tablet, ChevronRight, Bell, Truck,
  FileText, ClipboardCheck, Clock, LogOut, BookOpen, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { RoleName } from '@medlink/data-client'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: RoleName[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin','org_admin','branch_manager','pharmacist','cashier','inventory_manager','auditor'],
  },
  {
    href: '/pos',
    label: 'Point of Sale',
    icon: Tablet,
    roles: ['super_admin','org_admin','branch_manager','pharmacist','cashier'],
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: Package,
    roles: ['super_admin','org_admin','branch_manager','pharmacist','inventory_manager','auditor'],
  },
  {
    href: '/prescriptions',
    label: 'Prescriptions',
    icon: FileText,
    roles: ['super_admin','org_admin','branch_manager','pharmacist'],
  },
  {
    href: '/sales',
    label: 'Sales',
    icon: ShoppingCart,
    roles: ['super_admin','org_admin','branch_manager','pharmacist','cashier','auditor'],
  },
  {
    href: '/procurement',
    label: 'Procurement',
    icon: Truck,
    roles: ['super_admin','org_admin','branch_manager','inventory_manager'],
  },
  {
    href: '/expiry',
    label: 'Expiry',
    icon: Clock,
    roles: ['super_admin','org_admin','branch_manager','inventory_manager','pharmacist'],
  },
  {
    href: '/stock-take',
    label: 'Stock Take',
    icon: ClipboardCheck,
    roles: ['super_admin','org_admin','branch_manager','inventory_manager'],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: BarChart2,
    roles: ['super_admin','org_admin','branch_manager','inventory_manager','auditor'],
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: Bell,
    roles: ['super_admin','org_admin','branch_manager','pharmacist','inventory_manager','auditor'],
  },
  {
    href: '/users',
    label: 'Users',
    icon: Users,
    roles: ['super_admin','org_admin','branch_manager'],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['super_admin','org_admin'],
  },
  {
    href: '/admin/library',
    label: 'Drug Library',
    icon: BookOpen,
    roles: ['super_admin'],
  },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { primaryRole } = useAuth()

  const visible = NAV_ITEMS.filter(
    item => !primaryRole || item.roles.includes(primaryRole)
  )

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'nav-active-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              active
                ? 'bg-[#741A2F] text-white shadow-md shadow-[#741A2F]/30'
                : 'text-white/50 hover:bg-white/8 hover:text-white/90'
            )}
            style={!active ? {} : undefined}
          >
            <Icon className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              active
                ? 'text-[#FFC680]'
                : 'text-white/35 group-hover:text-white/70',
            )} />
            <span className="flex-1 tracking-wide">{label}</span>
            {active && <ChevronRight className="h-3 w-3 text-[#FFC680]/60" />}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarUserFooter() {
  const { user, primaryRole } = useAuth()
  const router = useRouter()

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
    <div className="border-t border-white/8 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs font-bold" style={{ background: '#741A2F', color: '#FFC680' }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{fullName}</p>
          <p className="truncate text-xs capitalize" style={{ color: '#FFC680', opacity: 0.75 }}>{roleLabel}</p>
        </div>
        <button
          onClick={() => void signOut()}
          title="Sign out"
          className="rounded-md p-1.5 text-white/30 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside
      className="app-sidebar hidden w-60 flex-col md:flex shrink-0"
      style={{ background: '#12060b' }}
    >
      {/* Brand header with gradient */}
      <div className="sidebar-brand-bar flex h-16 items-center px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="MedLink" height={34} className="h-[34px] w-auto" />
      </div>

      {/* Nav scroll area */}
      <div className="flex-1 overflow-y-auto py-4">
        <p
          className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#FFC680', opacity: 0.45 }}
        >
          Menu
        </p>
        <SidebarNav />
      </div>

      {/* User footer */}
      <SidebarUserFooter />
    </aside>
  )
}
