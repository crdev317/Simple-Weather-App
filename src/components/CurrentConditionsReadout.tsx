import type { CurrentConditions, Location } from '../domain/types'

interface Props {
  location: Location
  conditions: CurrentConditions
}

/** Bare unstyled display of the selected Location's Current Conditions (styling is Feature 4). */
export function CurrentConditionsReadout({ location, conditions }: Props) {
  return (
    <div>
      <h2>{location.name}</h2>
      <p>
        {Math.round(conditions.temperatureC)}°C — {conditions.condition.label}
      </p>
    </div>
  )
}
