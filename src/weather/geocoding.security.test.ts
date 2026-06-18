import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchLocations } from './geocoding'
import malformed200 from './__fixtures__/geocoding-malformed-200.json'

// Captures the URL handed to fetch so we can inspect how the Query was encoded
// into the outbound Geocoding request. The body is an empty no-match response —
// these tests are about request construction, not response mapping.
function spyOnGeocodingFetch() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ generationtime_ms: 0 }), { status: 200 }),
  )
}

// Serves an arbitrary body on a 200 — used to feed a structurally-unexpected
// geocoding payload across the Seam 1 trust boundary.
function mockFetch(body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  )
}

function requestedUrl(spy: ReturnType<typeof spyOnGeocodingFetch>): URL {
  const firstArg = spy.mock.calls[0]?.[0]
  return new URL(String(firstArg))
}

afterEach(() => vi.restoreAllMocks())

describe('searchLocations request safety (Seam 1 trust boundary)', () => {
  it('percent-encodes a Query so it cannot inject or override request parameters', async () => {
    const fetchSpy = spyOnGeocodingFetch()

    // A Query crafted to smuggle a second count parameter into the request.
    await searchLocations('x&count=100')

    const url = requestedUrl(fetchSpy)
    // The whole Query lands in `name` as a literal — the `&count=100` is inert text.
    expect(url.searchParams.get('name')).toBe('x&count=100')
    // count is fixed at 5 and cannot be overridden by the Query.
    expect(url.searchParams.getAll('count')).toEqual(['5'])
    // The raw query string carries the percent-encoded form, not a live delimiter.
    expect(url.search).toContain('name=x%26count%3D100')
  })

  it('percent-encodes reserved and non-ASCII characters in the Query', async () => {
    const fetchSpy = spyOnGeocodingFetch()

    // Every delimiter the threat model calls out, plus a space and a non-ASCII char.
    const query = 'a&b=c#d Zürich'
    await searchLocations(query)

    const url = requestedUrl(fetchSpy)
    // The Query survives the round trip intact as the single `name` value...
    expect(url.searchParams.get('name')).toBe(query)
    // ...and none of its delimiters leak into the raw query string verbatim.
    expect(url.search).toContain('name=a%26b%3Dc%23d%20Z%C3%BCrich')
    // count is still pinned at 5 — the Query cannot add or change it.
    expect(url.searchParams.getAll('count')).toEqual(['5'])
  })

  it('targets the Open-Meteo geocoding endpoint over HTTPS', async () => {
    const fetchSpy = spyOnGeocodingFetch()

    await searchLocations('Paris')

    const url = requestedUrl(fetchSpy)
    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('geocoding-api.open-meteo.com')
  })
})

// A candidate Location needs name + coordinates to be usable; the provider's
// per-result fields are untrusted external input that may be partial on a 200.
// The mapper must skip any result missing a required field rather than emit a
// half-built Location that renders garbage (or breaks coordinate keying).
describe('searchLocations fails closed on malformed results in a 200 (Seam 1 trust boundary)', () => {
  it('skips result entries missing a required name or numeric coordinates', async () => {
    mockFetch(malformed200)

    const locations = await searchLocations('Example')

    // Only the one well-formed entry survives; the three malformed ones are dropped.
    expect(locations).toEqual([
      {
        name: 'Valid City',
        latitude: 10.5,
        longitude: 20.5,
        admin1: 'Example Region',
        country: 'Examplestan',
      },
    ])
  })
})
