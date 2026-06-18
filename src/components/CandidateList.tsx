import type { Location } from '../domain/types'

interface Props {
  candidates: Location[]
  onPick: (location: Location) => void
}

/** Renders up to five candidate Locations with enough context to disambiguate. */
function label(l: Location): string {
  return [l.name, l.admin1, l.country].filter(Boolean).join(', ')
}

export function CandidateList({ candidates, onPick }: Props) {
  return (
    <ul>
      {candidates.map((l) => (
        <li key={`${l.latitude},${l.longitude}`}>
          <button type="button" onClick={() => onPick(l)}>
            {label(l)}
          </button>
        </li>
      ))}
    </ul>
  )
}
