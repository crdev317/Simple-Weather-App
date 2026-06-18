import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Location } from './domain/types'
import { searchLocations } from './weather/geocoding'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { SearchBar } from './components/SearchBar'
import { CandidateList } from './components/CandidateList'

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Location | null>(null)
  const debouncedQuery = useDebouncedValue(query, 300)

  const geocoding = useQuery({
    queryKey: ['geocoding', debouncedQuery],
    queryFn: () => searchLocations(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  })

  function handleQueryChange(value: string) {
    setQuery(value)
    setSelected(null) // typing a new Query starts a fresh search
  }

  return (
    <main>
      <h1>Simple Weather App</h1>
      <SearchBar value={query} onChange={handleQueryChange} />

      {geocoding.isFetching && <p>Loading…</p>}
      {geocoding.isError && <p>Something went wrong</p>}

      {/* Picking a candidate hides the list; the weather readout arrives in the next slice. */}
      {!selected && geocoding.data && (
        <CandidateList candidates={geocoding.data} onPick={setSelected} />
      )}
    </main>
  )
}
