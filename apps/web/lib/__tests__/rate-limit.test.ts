import { describe, it, expect, beforeEach, vi } from 'vitest'

// The module uses Date.now() and a module-level Map. We re-import fresh via dynamic import
// so the Map is isolated per test (vitest re-evaluates on each isolateModules call).

let checkRateLimit: (key: string, limit?: number) => boolean

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../rate-limit')
  checkRateLimit = mod.checkRateLimit
})

describe('checkRateLimit', () => {
  it('allows first request for any key', () => {
    expect(checkRateLimit('test:1')).toBe(true)
  })

  it('allows up to the limit within a window', () => {
    const key = 'test:burst'
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5)).toBe(true)
    }
  })

  it('blocks the request that exceeds the limit', () => {
    const key = 'test:block'
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3)
    expect(checkRateLimit(key, 3)).toBe(false)
  })

  it('blocks all subsequent calls after the limit is hit', () => {
    const key = 'test:blocked-forever'
    for (let i = 0; i < 2; i++) checkRateLimit(key, 2)
    expect(checkRateLimit(key, 2)).toBe(false)
    expect(checkRateLimit(key, 2)).toBe(false)
  })

  it('uses different buckets for different keys', () => {
    const key1 = 'test:k1'
    const key2 = 'test:k2'
    for (let i = 0; i < 2; i++) checkRateLimit(key1, 2)
    // key1 is now exhausted, but key2 should still be fresh
    expect(checkRateLimit(key2, 2)).toBe(true)
    expect(checkRateLimit(key1, 2)).toBe(false)
  })

  it('resets after the window expires', () => {
    vi.useFakeTimers()
    const key = 'test:reset'
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3)
    expect(checkRateLimit(key, 3)).toBe(false)

    // Advance past the 15-minute window
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(checkRateLimit(key, 3)).toBe(true)
    vi.useRealTimers()
  })

  it('defaults to a limit of 10', () => {
    const key = 'test:default-limit'
    for (let i = 0; i < 10; i++) expect(checkRateLimit(key)).toBe(true)
    expect(checkRateLimit(key)).toBe(false)
  })
})
