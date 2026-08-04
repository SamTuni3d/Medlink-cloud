'use client'

import { LogOut } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface SignOutButtonProps {
  iconOnly?: boolean
}

// Navigate to the sign-out route handler which does a real HTTP 302 redirect.
// This guarantees the browser clears Set-Cookie headers before the next request,
// so the middleware sees no session cookie on the /login page.
function handleSignOut() {
  window.location.href = '/api/auth/signout'
}

export function SignOutButton({ iconOnly = false }: SignOutButtonProps) {

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
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
      className="text-destructive focus:text-destructive"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </DropdownMenuItem>
  )
}
