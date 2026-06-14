'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart2,
  Users,
  Settings,
  Tablet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
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
    roles: ['super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'cashier', 'inventory_manager', 'auditor'],
  },
  {
    href: '/pos',
    label: 'Point of Sale',
    icon: Tablet,
    roles: ['super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'cashier'],
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: Package,
    roles: ['super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'inventory_manager', 'auditor'],
  },
  {
    href: '/sales',
    label: 'Sales',
    icon: ShoppingCart,
    roles: ['super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'cashier', 'auditor'],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: BarChart2,
    roles: ['super_admin', 'org_admin', 'branch_manager', 'inventory_manager', 'auditor'],
  },
  {
    href: '/users',
    label: 'Users',
    icon: Users,
    roles: ['super_admin', 'org_admin', 'branch_manager'],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['super_admin', 'org_admin'],
  },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { primaryRole } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    item => !primaryRole || item.roles.includes(primaryRole)
  )

  return (
    <nav className="flex flex-col gap-1 px-3">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-bold text-primary">MedLink Cloud</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>
    </aside>
  )
}
