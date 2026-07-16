/**
 * Sliding-window rate limiter for server actions and API routes.
 *
 * The module-level Map persists for the lifetime of a single serverless
 * function instance / Edge worker. It resets on cold starts, which is
 * acceptable — it stops burst attacks within a session, while Supabase
 * Auth provides durable per-email rate limiting on the auth layer.
 */

interface Bucket {
  count: number
  windowStart: number
}

const store = new Map<string, Bucket>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Returns true if the request is allowed, false if it should be rejected.
 * @param key      Unique key — combine IP + action name, e.g. "1.2.3.4:login"
 * @param limit    Maximum attempts allowed per window (default 10)
 */
export function checkRateLimit(key: string, limit = 10): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    return true
  }

  if (bucket.count >= limit) return false

  bucket.count++
  return true
}
