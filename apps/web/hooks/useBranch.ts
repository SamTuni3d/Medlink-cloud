'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBranches } from '@medlink/data-client'
import type { Branch } from '@medlink/data-client'
import { useAuth } from '@/providers/auth-provider'

const STORAGE_KEY = 'medlink_active_branch_id'

interface UseBranchReturn {
  branches: Branch[]
  activeBranch: Branch | null
  setActiveBranch: (branch: Branch) => void
  loading: boolean
}

export function useBranch(): UseBranchReturn {
  const { organizationId } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    getBranches(supabase, organizationId).then(result => {
      if (!result.ok) {
        setLoading(false)
        return
      }

      const list = result.data
      setBranches(list)

      const savedId =
        typeof window !== 'undefined'
          ? localStorage.getItem(STORAGE_KEY)
          : null

      const saved = savedId ? list.find(b => b.id === savedId) : null
      setActiveBranchState(saved ?? list[0] ?? null)
      setLoading(false)
    })
  }, [organizationId])

  const setActiveBranch = useCallback((branch: Branch) => {
    setActiveBranchState(branch)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, branch.id)
    }
  }, [])

  return { branches, activeBranch, setActiveBranch, loading }
}
