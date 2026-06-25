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

interface NavSection {
  heading?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
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
    ],
  },
  {
    heading: 'Inventory',
    items: [
      {
        href: '/inventory',
        label: 'Stock',
        icon: Package,
        roles: ['super_admin','org_admin','branch_manager','pharmacist','inventory_manager','auditor'],
      },
      {
        href: '/procurement',
        label: 'Procurement',
        icon: Truck,
        roles: ['super_admin','org_admin','branch_manager','inventory_manager'],
      },
      {
        href: '/stock-take',
        label: 'Stock Take',
        icon: ClipboardCheck,
        roles: ['super_admin','org_admin','branch_manager','inventory_manager'],
      },
      {
        href: '/expiry',
        label: 'Expiry',
        icon: Clock,
        roles: ['super_admin','org_admin','branch_manager','inventory_manager','pharmacist'],
      },
    ],
  },
  {
    heading: 'Records',
    items: [
      {
        href: '/sales',
        label: 'Sales',
        icon: ShoppingCart,
        roles: ['super_admin','org_admin','branch_manager','pharmacist','cashier','auditor'],
      },
      {
        href: '/prescriptions',
        label: 'Prescriptions',
        icon: FileText,
        roles: ['super_admin','org_admin','branch_manager','pharmacist'],
      },
      {
        href: '/reports',
        label: 'Reports',
        icon: BarChart2,
        roles: ['super_admin','org_admin','branch_manager','inventory_manager','auditor'],
      },
    ],
  },
  {
    heading: 'Admin',
    items: [
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
    ],
  },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { primaryRole } = useAuth()

  return (
    <nav className="flex flex-col gap-4 px-3">
      {NAV_SECTIONS.map((section, si) => {
        const visible = section.items.filter(
          item => !primaryRole || item.roles.includes(primaryRole)
        )
        if (visible.length === 0) return null
        return (
          <div key={si} className="flex flex-col gap-0.5">
            {section.heading && (
              <p
                className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: '#C4A44C', opacity: 0.4 }}
              >
                {section.heading}
              </p>
            )}
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
                      ? 'bg-[#004741] text-white shadow-md shadow-[#004741]/40'
                      : 'text-white/50 hover:bg-white/8 hover:text-white/90'
                  )}
                >
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    active ? 'text-[#C4A44C]' : 'text-white/35 group-hover:text-white/70',
                  )} />
                  <span className="flex-1 tracking-wide">{label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-[#C4A44C]/60" />}
                </Link>
              )
            })}
          </div>
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
          <AvatarFallback className="text-xs font-bold" style={{ background: '#004741', color: '#C4A44C' }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{fullName}</p>
          <p className="truncate text-xs capitalize" style={{ color: '#C4A44C', opacity: 0.75 }}>{roleLabel}</p>
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
      style={{ background: '#001C1A' }}
    >
      {/* Brand header with gradient */}
      <div className="sidebar-brand-bar flex h-16 items-center px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="MedLink" height={34} className="h-[34px] w-auto" />
      </div>

      {/* Nav scroll area */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>

      {/* User footer */}
      <SidebarUserFooter />
    </aside>
  )
}
