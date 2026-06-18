/** A named geographic place resolved to coordinates. */
export interface Location {
  name: string
  latitude: number
  longitude: number
  /** Region (Open-Meteo `admin1`). May be absent for some places — see Seam 1. */
  admin1?: string
  /** Country name. May be absent for some places — see Seam 1. */
  country?: string
}

/** The human-readable category of weather (icon added in Feature 2). */
export interface WeatherCondition {
  label: string
}

/** The present-moment snapshot for a Location (wind added in Feature 2). */
export interface CurrentConditions {
  temperatureC: number
  condition: WeatherCondition
}
