import { describe, it, expect, vi } from 'vitest'
import { coalesceRequest, inFlightRequestCount } from './request-coalesce'

describe('coalesceRequest', () => {
  it('collapses concurrent calls with the same key into one execution', async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return 'value'
    })

    const [a, b, c] = await Promise.all([
      coalesceRequest('k', fn),
      coalesceRequest('k', fn),
      coalesceRequest('k', fn),
    ])

    expect(fn).toHaveBeenCalledTimes(1)
    expect([a, b, c]).toEqual(['value', 'value', 'value'])
  })

  it('re-executes for a fresh call after the previous one settled (no stale cache)', async () => {
    const fn = vi.fn(async () => 'x')

    await coalesceRequest('k2', fn)
    await coalesceRequest('k2', fn)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(inFlightRequestCount()).toBe(0)
  })

  it('does not coalesce across different keys', async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5))
      return 1
    })

    await Promise.all([coalesceRequest('a', fn), coalesceRequest('b', fn)])

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures — a rejected call clears the entry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok')

    await expect(coalesceRequest('k3', fn)).rejects.toThrow('boom')
    await expect(coalesceRequest('k3', fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(inFlightRequestCount()).toBe(0)
  })
})
