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
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="flex h-16 items-center border-b px-6">
            <SheetTitle className="text-primary">MedLink Cloud</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
