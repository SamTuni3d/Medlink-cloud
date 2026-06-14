import { getDeviceId } from './deviceId'

/**
 * Returns the next device-scoped sale number for a branch.
 * Format: ML-{deviceShort}-{seq4}   e.g. ML-A1B2C3D4-0042
 *
 * The counter persists in localStorage per (device, branch) pair.
 * The server assigns a sequential branch_sale_number on sync.
 */
export function nextSaleNumber(branchId: string): string {
  const deviceId = getDeviceId()
  const key = `medlink_sale_seq_${deviceId}_${branchId}`
  const current = parseInt(localStorage.getItem(key) ?? '0', 10)
  const next = current + 1
  localStorage.setItem(key, String(next))

  const deviceShort = deviceId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const seq = String(next).padStart(4, '0')
  return `ML-${deviceShort}-${seq}`
}
