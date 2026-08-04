'use client'

import { useState, useEffect, useRef } from 'react'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { SidebarNav } from './sidebar'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut } from 'lucide-react'

export function MobileNav() {
  const [open, setOpen]         = useState(false)
  const [closing, setClosing]   = useState(false)
  const pathname                = usePathname()
  const { user, primaryRole }   = useAuth()
  const touchStartX             = useRef<number | null>(null)

  // Close on route change
  useEffect(() => { handleClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleClose() {
    if (!open) return
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 240)
  }

  // Swipe left to close
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const endX = e.changedTouches[0]?.clientX
    if (endX === undefined) return
    const delta = touchStartX.current - endX
    if (delta > 60) handleClose()
    touchStartX.current = null
  }

  const fullName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'User'
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel = primaryRole?.replace(/_/g, ' ') ?? ''

  function handleSignOut() {
    window.location.href = '/api/auth/signout'
  }

  return (
    <>
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors md:hidden"
        style={{ background: 'hsl(175 35% 91%)', color: '#004741' }}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* Animated backdrop */}
          <div
            onClick={handleClose}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="fixed inset-0 z-40 md:hidden"
            style={{
              background: 'rgba(0,28,26,0.65)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              animation: closing
                ? 'fadeInOverlay 0.22s ease reverse both'
                : 'fadeInOverlay 0.22s ease both',
            }}
          />

          {/* Animated drawer */}
          <div
            className="fixed left-0 top-0 z-50 flex h-full w-[72vw] max-w-[280px] flex-col shadow-2xl md:hidden"
            style={{
              background: '#001C1A',
              animation: closing
                ? 'slideInLeft 0.24s cubic-bezier(0.4, 0, 1, 1) reverse both'
                : 'slideInLeft 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Brand header */}
            <div
              className="flex h-16 items-center justify-between px-5 shrink-0"
              style={{
                background: 'linear-gradient(135deg, #001C1A 0%, #004741 60%, #006B60 100%)',
                borderBottom: '1px solid rgba(255,198,128,0.15)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="MedLink" height={30} className="h-[30px] w-auto" />
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                style={{ color: 'rgba(196,164,76,0.7)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto py-4">
              <p
                className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: '#C4A44C', opacity: 0.45 }}
              >
                Menu
              </p>
              <SidebarNav onNavigate={handleClose} />
            </div>

            {/* User footer */}
            <div className="shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{ background: '#004741', color: '#C4A44C' }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{fullName}</p>
                  <p className="truncate text-xs capitalize" style={{ color: '#C4A44C', opacity: 0.7 }}>
                    {roleLabel}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
