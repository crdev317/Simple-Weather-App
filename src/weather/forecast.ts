import type { CurrentConditions } from '../domain/types'
import { toWeatherCondition } from './weatherCondition'

interface ForecastResponse {
  current: {
    temperature_2m: number
    weather_code: number
  }
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

/** Fetch the Current Conditions for a Location's coordinates (Seam 2). */
export async function getCurrentWeather(coords: {
  latitude: number
  longitude: number
}): Promise<CurrentConditions> {
  const url =
    `${ENDPOINT}?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    `&current=temperature_2m,weather_code`
  const response = await fetch(url)
  if (!response.ok) {
    // Never parse a non-OK body as weather — surface it as the query's error state.
    console.error('Forecast request failed', response.status)
    throw new Error(`Forecast failed: ${response.status}`)
  }
  const data = (await response.json()) as unknown
  const current = (data as Partial<ForecastResponse>).current
  // A 200 is not a promise the body is well-shaped: a partial or malformed
  // payload must fail closed here (surfacing as the query's error state) rather
  // than flow downstream as a non-numeric temperature to be rendered as NaN.
  if (!current || typeof current.temperature_2m !== 'number' || !Number.isFinite(current.temperature_2m)) {
    console.error('Forecast response was malformed: missing or non-numeric temperature')
    throw new Error('Forecast response was malformed')
  }
  return {
    temperatureC: current.temperature_2m,
    condition: toWeatherCondition(current.weather_code),
  }
}
