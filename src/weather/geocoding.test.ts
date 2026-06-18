import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchLocations } from './geocoding'
import springfield from './__fixtures__/geocoding-springfield.json'
import noMatch from './__fixtures__/geocoding-no-match.json'

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, statusText: ok ? 'OK' : 'Error' }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('searchLocations', () => {
  it('resolves a Query to candidate Locations', async () => {
    mockFetch(springfield)
    const locations = await searchLocations('Springfield')
    expect(locations).toHaveLength(3)
    expect(locations[0]).toEqual({
      name: 'Springfield',
      latitude: 37.21533,
      longitude: -93.29824,
      admin1: 'Missouri',
      country: 'United States',
    })
  })

  it('resolves a no-match Query to zero candidate Locations (results key absent)', async () => {
    mockFetch(noMatch)
    expect(await searchLocations('zzzxqv')).toEqual([])
  })

  it('rejects when the geocoding service returns a non-OK response', async () => {
    mockFetch({}, false, 500)
    await expect(searchLocations('Paris')).rejects.toThrow()
  })
})
