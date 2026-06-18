import type { CurrentConditions, Location } from '../domain/types'

interface Props {
  location: Location
  conditions: CurrentConditions
}

/** Bare unstyled display of the selected Location's Current Conditions (styling is Feature 4). */
export function CurrentConditionsReadout({ location, conditions }: Props) {
  // Last line of defence: only render a temperature that is a finite number, so
  // a non-finite value can never reach the DOM as a "NaN°C"/"undefined°C" text
  // node — fail closed to the bare error state instead.
  if (!Number.isFinite(conditions.temperatureC)) {
    return <p>Something went wrong</p>
  }
  return (
    <div>
      <h2>{location.name}</h2>
      <p>
        {Math.round(conditions.temperatureC)}°C — {conditions.condition.label}
      </p>
    </div>
  )
}
