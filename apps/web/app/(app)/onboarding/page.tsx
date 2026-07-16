'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Pill, Users, CheckCircle2, ArrowRight, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/providers/auth-provider'
import { useBranch } from '@/hooks/useBranch'
import { addCustomMedicationAction } from '@/app/(app)/medications/actions'

const STEPS = [
  { id: 1, label: 'Your Pharmacy', icon: Building2 },
  { id: 2, label: 'First Medication', icon: Pill },
  { id: 3, label: 'Invite Team', icon: Users },
]

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Patch', 'Suppository', 'Other']
const UNITS = ['Tablet', 'Capsule', 'ml', 'mg', 'g', 'Unit', 'Vial', 'Ampoule', 'Sachet', 'Patch']

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 2 — first medication
  const [medForm, setMedForm] = useState({
    name: '', generic_name: '', dosage_form: 'Tablet', strength: '',
    unit_of_measure: 'Tablet', selling_price: '',
  })

  const orgId = user?.app_metadata?.organization_id as string | undefined

  async function addFirstMedication() {
    if (!orgId || !activeBranch?.id) { setStep(3); return }
    if (!medForm.name || !medForm.selling_price) { setStep(3); return }

    setSaving(true)
    await addCustomMedicationAction({
      organizationId: orgId,
      name: medForm.name,
      genericName: medForm.generic_name || undefined,
      dosageForm: medForm.dosage_form,
      strength: medForm.strength || undefined,
      unitOfMeasure: medForm.unit_of_measure,
      sellingPrice: parseFloat(medForm.selling_price),
      currencyCode: 'GHS',
      reorderPoint: 10,
      reorderQuantity: 50,
      requiresPrescription: false,
    })
    setSaving(false)
    setStep(3)
  }

  function finish() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('medlink_onboarding_complete', '1')
    }
    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Step progress */}
        <div className="mb-8 flex items-center justify-center gap-0">
          {STEPS.map((s, i) => {
            const done = step > s.id
            const active = step === s.id
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done ? 'bg-green-500 text-white'
                  : active ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-16 transition-colors ${step > s.id ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome to MedLink!</h1>
            <p className="mt-2 text-muted-foreground">
              Your pharmacy is ready. Let&apos;s take 2 minutes to set up a few essentials so you can start selling right away.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { icon: Pill, text: 'Add your first medication to the catalog' },
                { icon: Users, text: 'Invite your team (optional)' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => setStep(2)}>
              Get Started<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2 — First Medication */}
        {step === 2 && (
          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Pill className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Add your first medication</h2>
            <p className="mt-1 text-sm text-muted-foreground">This goes into your master catalog — you can add more anytime.</p>
            <div className="mt-5 space-y-3">
              <div>
                <Label>Medication Name *</Label>
                <Input
                  value={medForm.name}
                  onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Paracetamol"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Generic Name</Label>
                <Input
                  value={medForm.generic_name}
                  onChange={e => setMedForm(f => ({ ...f, generic_name: e.target.value }))}
                  placeholder="e.g. Acetaminophen"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dosage Form</Label>
                  <Select value={medForm.dosage_form} onValueChange={v => setMedForm(f => ({ ...f, dosage_form: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOSAGE_FORMS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Strength</Label>
                  <Input
                    value={medForm.strength}
                    onChange={e => setMedForm(f => ({ ...f, strength: e.target.value }))}
                    placeholder="e.g. 500mg"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unit of Measure</Label>
                  <Select value={medForm.unit_of_measure} onValueChange={v => setMedForm(f => ({ ...f, unit_of_measure: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Selling Price (GHS) *</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={medForm.selling_price}
                    onChange={e => setMedForm(f => ({ ...f, selling_price: e.target.value }))}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep(3)}>
                Skip for now
              </Button>
              <Button className="flex-1" onClick={addFirstMedication} disabled={saving || !medForm.name || !medForm.selling_price}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save &amp; Continue<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Invite Team */}
        {step === 3 && (
          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">You&apos;re all set!</h2>
            <p className="mt-2 text-muted-foreground">
              Your pharmacy is configured and ready to use. You can invite staff anytime from the <strong>Users</strong> page.
            </p>
            <div className="mt-6 space-y-2">
              <Button className="w-full" onClick={finish}>
                Go to Dashboard<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => router.push('/users')}>
                Invite Team Now
              </Button>
            </div>
          </div>
        )}

        {/* Step counter */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Step {step} of {STEPS.length}
        </p>
      </div>
    </div>
  )
}
