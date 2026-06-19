'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface SignOutButtonProps {
  iconOnly?: boolean
}

export function SignOutButton({ iconOnly = false }: SignOutButtonProps) {
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

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        disabled={isPending}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    )
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
