'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, ShoppingCart, BarChart2,
  Users, Settings, Tablet, ChevronRight, Bell, Truck, FileText, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SignOutButton } from '@/components/auth/sign-out-button'
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
    <nav className="flex flex-col gap-0.5 px-3">
      {visibleItems.map(({ href, label, icon: Icon }, i) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <motion.div
            key={href}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05, ease: 'easeOut' }}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              href={href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              <motion.div
                animate={{ rotate: active ? 0 : 0 }}
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ duration: 0.15 }}
              >
                <Icon className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-primary-foreground' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                )} />
              </motion.div>
              <span className="flex-1">{label}</span>
              {active && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.6 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-3 w-3" />
                </motion.div>
              )}
            </Link>
          </motion.div>
        )
      })}
    </nav>
  )
}

function SidebarUserFooter() {
  const { user, primaryRole } = useAuth()

  const fullName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'User'
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const roleLabel = primaryRole?.replace(/_/g, ' ') ?? ''

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-3 rounded-lg p-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{fullName}</p>
          <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">{roleLabel}</p>
        </div>
        <SignOutButton iconOnly />
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 dark:border-slate-700 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <span className="text-sm font-bold text-white">M</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">MedLink</p>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none mt-0.5">Cloud</p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Menu
        </p>
        <SidebarNav />
      </div>

      {/* User footer */}
      <SidebarUserFooter />
    </aside>
  )
}
