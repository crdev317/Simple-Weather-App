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
  const data = (await response.json()) as ForecastResponse
  return {
    temperatureC: data.current.temperature_2m,
    condition: toWeatherCondition(data.current.weather_code),
  }
}
