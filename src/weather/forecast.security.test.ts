import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCurrentWeather } from './forecast'
import malformed200 from './__fixtures__/forecast-malformed-200.json'

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

// Serves an arbitrary body with an explicit HTTP status — used to feed
// structurally-unexpected HTTP 200 payloads across the Seam 2 trust boundary.
function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  )
}

const COORDS = { latitude: 37.21533, longitude: -93.29824 }

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

// A 200 status does not make a body trustworthy: the wire shape can be partial
// or malformed (a tampered proxy, a provider regression). The mapper is the
// single place that trusts the wire shape, so it must fail closed — reject with
// a controlled Forecast error that surfaces as the query's error state — rather
// than pass a non-numeric temperature downstream to be rendered as NaN.
describe('getCurrentWeather fails closed on a malformed 200 (Seam 2 trust boundary)', () => {
  it('rejects a partial 200 whose current object is missing temperature_2m', async () => {
    mockFetch(malformed200)

    await expect(getCurrentWeather(COORDS)).rejects.toThrow(/forecast/i)
  })

  it('rejects a 200 whose temperature_2m is present but not a number', async () => {
    mockFetch({ current: { temperature_2m: 'warm', weather_code: 3 } })

    await expect(getCurrentWeather(COORDS)).rejects.toThrow(/forecast/i)
  })

  it('rejects a 200 that lacks the current object entirely', async () => {
    mockFetch({ latitude: 37.2, longitude: -93.3, generationtime_ms: 0.1 })

    await expect(getCurrentWeather(COORDS)).rejects.toThrow(/forecast/i)
  })
})
