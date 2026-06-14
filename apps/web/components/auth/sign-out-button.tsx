'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

export function SignOutButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    })
  }

  return (
    <DropdownMenuItem
      onClick={handleSignOut}
      disabled={isPending}
      className="text-destructive focus:text-destructive"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isPending ? 'Signing out…' : 'Sign out'}
    </DropdownMenuItem>
  )
}
