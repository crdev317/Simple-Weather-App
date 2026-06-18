import { describe, it, expect } from 'vitest'
import { toWeatherCondition } from './weatherCondition'

describe('toWeatherCondition', () => {
  it('maps known WMO codes to their Weather Condition label', () => {
    expect(toWeatherCondition(0).label).toBe('Clear sky')
    expect(toWeatherCondition(3).label).toBe('Overcast')
    expect(toWeatherCondition(61).label).toBe('Slight rain')
    expect(toWeatherCondition(95).label).toBe('Thunderstorm')
  })

  it('falls back to a generic Weather Condition for an unknown code (totality)', () => {
    const condition = toWeatherCondition(999)
    expect(condition.label).toBe('Unknown')
    expect(typeof condition.label).toBe('string')
  })
})
