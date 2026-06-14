const DEVICE_ID_KEY = 'medlink_device_id'

/** Returns a stable UUID for this browser/device. Generated once and persisted to localStorage. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'

  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}
