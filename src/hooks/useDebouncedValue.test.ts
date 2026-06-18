import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  it('returns the latest value only after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } },
    )
    expect(result.current).toBe('a')

    rerender({ value: 'ab' })
    expect(result.current).toBe('a') // not yet — delay not elapsed

    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('ab')
  })
})
