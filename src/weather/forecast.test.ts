import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCurrentWeather } from './forecast'
import { toWeatherCondition } from './weatherCondition'
import success from './__fixtures__/forecast-success.json'
import error429 from './__fixtures__/forecast-error-429.json'

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, statusText: ok ? 'OK' : 'Error' }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('getCurrentWeather', () => {
  it('maps the forecast response to Current Conditions', async () => {
    mockFetch(success)
    const conditions = await getCurrentWeather({ latitude: 37.21533, longitude: -93.29824 })
    // Values come from the real captured fixture (success.current.*):
    expect(conditions.temperatureC).toBe(success.current.temperature_2m)
    expect(conditions.condition).toEqual(toWeatherCondition(success.current.weather_code))
  })

  it('rejects on a non-OK HTTP response (e.g. 429 rate limit) instead of parsing it as weather', async () => {
    mockFetch(error429, false, 429)
    await expect(
      getCurrentWeather({ latitude: 1, longitude: 1 }),
    ).rejects.toThrow()
  })
})
