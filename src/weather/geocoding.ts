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
  // A 200 does not guarantee each result is well-shaped: skip any entry missing
  // a usable name or numeric coordinates rather than emit a half-built Location.
  return (data.results ?? [])
    .filter(isUsableResult)
    .map((r) => ({
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      admin1: r.admin1,
      country: r.country,
    }))
}

function isUsableResult(r: GeocodingResult): boolean {
  return (
    typeof r?.name === 'string' &&
    r.name.length > 0 &&
    Number.isFinite(r.latitude) &&
    Number.isFinite(r.longitude)
  )
}
