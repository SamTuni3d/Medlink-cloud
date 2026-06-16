'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SidebarNav } from './sidebar'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 md:hidden text-slate-600 hover:bg-slate-100"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 p-0 bg-white dark:bg-slate-900">
          <SheetHeader className="flex h-16 flex-row items-center gap-2.5 border-b border-slate-200 dark:border-slate-700 px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <div>
              <SheetTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">MedLink</SheetTitle>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none mt-0.5">Cloud</p>
            </div>
          </SheetHeader>
          <div className="py-4">
            <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Menu
            </p>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
