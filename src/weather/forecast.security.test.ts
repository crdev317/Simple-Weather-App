import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCurrentWeather } from './forecast'

// Captures the URL handed to fetch so we can inspect the outbound Forecast
// request scheme. A minimal success body keeps these tests about the request.
function spyOnForecastFetch() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ current: { temperature_2m: 20, weather_code: 0 } }),
      { status: 200 },
    ),
  )
}

function requestedUrl(spy: ReturnType<typeof spyOnForecastFetch>): URL {
  const firstArg = spy.mock.calls[0]?.[0]
  return new URL(String(firstArg))
}

afterEach(() => vi.restoreAllMocks())

describe('getCurrentWeather request safety (Seam 2 trust boundary)', () => {
  it('targets the Open-Meteo forecast endpoint over HTTPS', async () => {
    const fetchSpy = spyOnForecastFetch()

    await getCurrentWeather({ latitude: 37.21533, longitude: -93.29824 })

    const url = requestedUrl(fetchSpy)
    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('api.open-meteo.com')
  })
})
