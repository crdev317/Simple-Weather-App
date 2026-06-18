import type { Location } from '../domain/types'

interface GeocodingResult {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

interface GeocodingResponse {
  results?: GeocodingResult[]
}

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'

/** Resolve a free-text Query into up to five candidate Locations. */
export async function searchLocations(query: string): Promise<Location[]> {
  const url = `${ENDPOINT}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  const response = await fetch(url)
  if (!response.ok) {
    console.error('Geocoding request failed', response.status)
    throw new Error(`Geocoding failed: ${response.status}`)
  }
  const data = (await response.json()) as GeocodingResponse
  // results is absent (not []) when there are no matches — coalesce.
  return (data.results ?? []).map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    admin1: r.admin1,
    country: r.country,
  }))
}
