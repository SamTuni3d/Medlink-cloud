// Fire-and-forget notification dispatcher.
// Calls the send-alert Edge Function without awaiting the result so the
// caller's critical path is never blocked by SMS / email failures.
//
// Usage (from a Server Action, after the DB write succeeds):
//   void dispatchAlert({ type: 'low_stock', sms: { to: ['+233...'], message: '...' }, ... })

interface SmsPayload  { to: string[]; message: string }
interface EmailPayload { to: string[]; subject: string; text: string }

interface AlertPayload {
  type: 'low_stock' | 'prescription_ready' | 'expiry_warning' | 'custom'
  sms?: SmsPayload
  email?: EmailPayload
  audit_ref?: {
    organization_id: string
    branch_id?: string
    metadata?: Record<string, unknown>
  }
}

export function dispatchAlert(payload: AlertPayload): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('[notify] SUPABASE env vars not set — alert skipped')
    return
  }

  const url = `${supabaseUrl}/functions/v1/send-alert`

  // Intentionally not awaited — caller continues immediately
  fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(err => {
    // Log to console only — never throw back to caller
    console.error('[notify] Failed to dispatch alert:', err)
  })
}

// ─── Convenience builders ─────────────────────────────────────────────────────

export function notifyLowStock(opts: {
  medicationName: string
  currentStock: number
  reorderLevel: number
  branchName: string
  managerPhones: string[]
  adminEmails: string[]
  organizationId: string
  branchId: string
}): void {
  const message =
    `[MedLink] Low stock alert: ${opts.medicationName} at ${opts.branchName}. ` +
    `Current: ${opts.currentStock} units (reorder level: ${opts.reorderLevel}).`

  dispatchAlert({
    type: 'low_stock',
    sms: opts.managerPhones.length > 0
      ? { to: opts.managerPhones, message }
      : undefined,
    email: opts.adminEmails.length > 0
      ? {
          to: opts.adminEmails,
          subject: `[MedLink] Low stock: ${opts.medicationName} — ${opts.branchName}`,
          text: [
            `Low stock alert`,
            ``,
            `Medication: ${opts.medicationName}`,
            `Branch: ${opts.branchName}`,
            `Current stock: ${opts.currentStock} units`,
            `Reorder level: ${opts.reorderLevel} units`,
            ``,
            `Please log in to MedLink Cloud to create a purchase order.`,
          ].join('\n'),
        }
      : undefined,
    audit_ref: {
      organization_id: opts.organizationId,
      branch_id: opts.branchId,
      metadata: {
        medication_name: opts.medicationName,
        current_stock: opts.currentStock,
        reorder_level: opts.reorderLevel,
      },
    },
  })
}

export function notifyPrescriptionReady(opts: {
  patientName: string
  prescriptionRef: string
  branchName: string
  staffPhones: string[]
  staffEmails: string[]
  organizationId: string
  branchId: string
}): void {
  const message =
    `[MedLink] Prescription ready: ${opts.patientName} (Ref: ${opts.prescriptionRef}) at ${opts.branchName}.`

  dispatchAlert({
    type: 'prescription_ready',
    sms: opts.staffPhones.length > 0
      ? { to: opts.staffPhones, message }
      : undefined,
    email: opts.staffEmails.length > 0
      ? {
          to: opts.staffEmails,
          subject: `[MedLink] Prescription ready — ${opts.patientName}`,
          text: [
            `A prescription is ready for dispensing.`,
            ``,
            `Patient: ${opts.patientName}`,
            `Reference: ${opts.prescriptionRef}`,
            `Branch: ${opts.branchName}`,
            ``,
            `Please log in to MedLink Cloud to dispense.`,
          ].join('\n'),
        }
      : undefined,
    audit_ref: {
      organization_id: opts.organizationId,
      branch_id: opts.branchId,
      metadata: { prescription_ref: opts.prescriptionRef },
    },
  })
}
