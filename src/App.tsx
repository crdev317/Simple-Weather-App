import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Location } from './domain/types'
import { searchLocations } from './weather/geocoding'
import { getCurrentWeather } from './weather/forecast'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { SearchBar } from './components/SearchBar'
import { CandidateList } from './components/CandidateList'
import { CurrentConditionsReadout } from './components/CurrentConditionsReadout'

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Location | null>(null)
  const debouncedQuery = useDebouncedValue(query, 300)

  const geocoding = useQuery({
    queryKey: ['geocoding', debouncedQuery],
    queryFn: () => searchLocations(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  })

  const forecast = useQuery({
    queryKey: ['forecast', selected?.latitude, selected?.longitude],
    queryFn: () => getCurrentWeather(selected!),
    enabled: selected !== null,
  })

  function handleQueryChange(value: string) {
    setQuery(value)
    setSelected(null) // typing a new Query clears stale weather
  }

  return (
    <main>
      <h1>Simple Weather App</h1>
      <SearchBar value={query} onChange={handleQueryChange} />

      {geocoding.isFetching && <p>Loading…</p>}
      {geocoding.isError && <p>Something went wrong</p>}

      {!selected && geocoding.data && (
        <CandidateList candidates={geocoding.data} onPick={setSelected} />
      )}

      {selected && forecast.isFetching && <p>Loading…</p>}
      {selected && forecast.isError && <p>Something went wrong</p>}
      {selected && forecast.data && (
        <CurrentConditionsReadout location={selected} conditions={forecast.data} />
      )}
    </main>
  )
}
