'use client'

import { useState } from 'react'
import { Plus, Search, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type StatusFilter = 'all' | 'pending' | 'dispensed' | 'cancelled'

export default function PrescriptionsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and dispense patient prescriptions</p>
        </div>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Prescription
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient, doctor, Rx number…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={v => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="dispensed">Dispensed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white py-24 text-muted-foreground">
        <FileText className="h-14 w-14 text-muted" />
        <div className="text-center">
          <p className="font-medium text-muted-foreground">No prescriptions found</p>
          <p className="mt-0.5 text-sm">Create a new prescription to get started</p>
        </div>
        <Button size="sm" variant="outline" className="mt-2">
          <Plus className="mr-2 h-4 w-4" />
          New Prescription
        </Button>
      </div>
    </div>
  )
}
