# Find a Place and See Its Weather — Implementation Plan

> **For agentic workers:** Do NOT implement this plan directly. It must first pass `/feature-doc-gauntlet` in a clean session, then be broken into stories by `/enate-to-stories`; AFK implementation happens per-story from there. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the tracer-bullet slice — type a Query, pick from up to five candidate Locations, and see the selected Location's current temperature (°C) and Weather Condition label, fetched live from Open-Meteo.

**Architecture:** A single-page React app with no router and no global state library. Three framework-agnostic deep modules (Weather Condition mapping, Geocoding, Forecast) own all logic and I/O and are unit-tested with real captured fixtures; thin React components render them, wired together with TanStack Query and a 300ms debounce hook.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8 (strict), @tanstack/react-query v5, styled-components v6, native `fetch`. Tests: Vitest + @testing-library/react + jsdom. (All per Technical-Context.MD → Packages in use.)

**Context references:**
- Spec: `docs/superpowers/specs/2026-06-17-find-a-place-and-see-its-weather-design.md`
- `Context.MD`
- `Technical-Context.MD` (Overriding Principles that apply: **(2) TypeScript strict mode**, **(3) tests for logic**, **(4) no new dependencies without reason**)
- ADRs: none (the spec referenced no ADRs)

> An AFK Developer Agent picking up this plan MUST load every file in the Context references block before writing code.

---

## File structure

```
Simple-Weather-App/
├── package.json                       # scaffolded by Vite, deps added
├── vite.config.ts                     # Vite + Vitest config (jsdom)
├── tsconfig.json                      # strict mode on
├── index.html
├── src/
│   ├── main.tsx                       # React root + QueryClientProvider
│   ├── App.tsx                        # owns Query + selectedLocation state, wires queries
│   ├── test/setup.ts                  # jest-dom matchers
│   ├── domain/
│   │   └── types.ts                   # Location, WeatherCondition, CurrentConditions
│   ├── weather/
│   │   ├── weatherCondition.ts        # toWeatherCondition(code)
│   │   ├── weatherCondition.test.ts
│   │   ├── geocoding.ts               # searchLocations(query)   [Seam 1]
│   │   ├── geocoding.test.ts
│   │   ├── forecast.ts                # getCurrentWeather(coords) [Seam 2]
│   │   ├── forecast.test.ts
│   │   └── __fixtures__/
│   │       ├── geocoding-springfield.json   # real capture
│   │       ├── geocoding-no-match.json       # real capture
│   │       ├── forecast-success.json         # real capture, committed (2026-06-18)
│   │       └── forecast-error-429.json       # real capture
│   ├── hooks/
│   │   ├── useDebouncedValue.ts
│   │   └── useDebouncedValue.test.ts
│   └── components/
│       ├── SearchBar.tsx
│       ├── CandidateList.tsx
│       └── CurrentConditionsReadout.tsx
```

---

### Task 1: Scaffold the project and test tooling

**Files:**
- Create (via scaffold): `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Scaffold a React + TypeScript Vite app into the existing repo**

Run from the repo root (the directory already contains `README.md`, `Context.MD`, etc.):

```bash
npm create vite@latest . -- --template react-ts
```

When prompted that the directory is not empty, choose **"Ignore files and continue"** (it will not delete the existing markdown docs).

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install @tanstack/react-query styled-components
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Expected: installs succeed; `package.json` lists React 19, Vite 7, TypeScript ~5.8, and the packages above. (These match Technical-Context.MD — no other dependencies are added.)

- [ ] **Step 3: Confirm TypeScript strict mode is on**

Open `tsconfig.json` (or `tsconfig.app.json` if Vite split it) and verify `"strict": true` is present under `compilerOptions`. The Vite `react-ts` template enables it by default; if absent, add it. This satisfies Overriding Principle (2).

- [ ] **Step 4: Configure Vitest in `vite.config.ts`**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 5: Create the test setup file**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add a test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Verify the toolchain runs**

Run: `npm run test`
Expected: Vitest starts and reports **"No test files found"** (exit 0 or the "no tests" notice). This proves the test runner is wired before any test exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS app with Vitest"
```

---

### Task 2: Domain types

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Write the domain types**

Create `src/domain/types.ts` using the canonical vocabulary from `Context.MD`:

```ts
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
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add domain types (Location, WeatherCondition, CurrentConditions)"
```

---

### Task 3: Weather Condition mapping module

Covers the **`weather_code` totality contract from Seam 2**: every integer (including unknown codes) maps to a `WeatherCondition` whose `label` is a non-null string; unknown codes fall back; the function never throws and never returns null.

**Files:**
- Create: `src/weather/weatherCondition.ts`
- Test: `src/weather/weatherCondition.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/weather/weatherCondition.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toWeatherCondition } from './weatherCondition'

describe('toWeatherCondition', () => {
  it('maps known WMO codes to their labels', () => {
    expect(toWeatherCondition(0).label).toBe('Clear sky')
    expect(toWeatherCondition(3).label).toBe('Overcast')
    expect(toWeatherCondition(61).label).toBe('Slight rain')
    expect(toWeatherCondition(95).label).toBe('Thunderstorm')
  })

  it('falls back to a generic label for an unknown code (totality)', () => {
    const result = toWeatherCondition(999)
    expect(result.label).toBe('Unknown')
    expect(typeof result.label).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weather/weatherCondition.test.ts`
Expected: FAIL — cannot resolve `./weatherCondition`.

- [ ] **Step 3: Write minimal implementation**

Create `src/weather/weatherCondition.ts`. The code→text table is the standard WMO interpretation Open-Meteo documents; the label wording is ours:

```ts
import type { WeatherCondition } from '../domain/types'

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

/** Total over all integers: unknown codes fall back to 'Unknown'; never throws. */
export function toWeatherCondition(code: number): WeatherCondition {
  return { label: WMO_LABELS[code] ?? 'Unknown' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weather/weatherCondition.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/weather/weatherCondition.ts src/weather/weatherCondition.test.ts
git commit -m "feat: add Weather Condition mapping with total fallback"
```

---

### Task 4: Geocoding module — **Seam 1**

Covers **Seam 1 (network-protocol, external)**. Contract verbatim: anonymous `GET .../v1/search?name=<query>&count=5&language=en&format=json`; `results` is an array **present only on matches** and **absent on zero matches** (still HTTP 200) → the module **coalesces missing `results` to `[]`**; per result `id/name/latitude/longitude` are always present while `country/admin1` are **optional**; non-OK HTTP rejects. Proof: tests against the real captured Springfield + no-match fixtures.

**Files:**
- Create: `src/weather/__fixtures__/geocoding-springfield.json`
- Create: `src/weather/__fixtures__/geocoding-no-match.json`
- Create: `src/weather/geocoding.ts`
- Test: `src/weather/geocoding.test.ts`

- [ ] **Step 1: Save the real captured success fixture**

Create `src/weather/__fixtures__/geocoding-springfield.json` (captured live from `geocoding-api.open-meteo.com` on 2026-06-17):

```json
{
  "results": [
    {
      "id": 4409896,
      "name": "Springfield",
      "latitude": 37.21533,
      "longitude": -93.29824,
      "elevation": 396.0,
      "feature_code": "PPLA2",
      "country_code": "US",
      "timezone": "America/Chicago",
      "population": 170188,
      "country_id": 6252001,
      "country": "United States",
      "admin1": "Missouri",
      "admin2": "Greene"
    },
    {
      "id": 4250542,
      "name": "Springfield",
      "latitude": 39.80172,
      "longitude": -89.64371,
      "elevation": 182.0,
      "feature_code": "PPLA",
      "country_code": "US",
      "timezone": "America/Chicago",
      "population": 114394,
      "country_id": 6252001,
      "country": "United States",
      "admin1": "Illinois",
      "admin2": "Sangamon"
    },
    {
      "id": 4951788,
      "name": "Springfield",
      "latitude": 42.10148,
      "longitude": -72.58981,
      "elevation": 25.0,
      "feature_code": "PPL",
      "country_code": "US",
      "timezone": "America/New_York",
      "population": 154341,
      "country_id": 6252001,
      "country": "United States",
      "admin1": "Massachusetts",
      "admin2": "Hampden"
    }
  ],
  "generationtime_ms": 1.2015104
}
```

- [ ] **Step 2: Save the real captured no-match fixture**

Create `src/weather/__fixtures__/geocoding-no-match.json` (captured live — note the **absent** `results` key):

```json
{ "generationtime_ms": 0.42819977 }
```

- [ ] **Step 3: Write the failing test**

Create `src/weather/geocoding.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchLocations } from './geocoding'
import springfield from './__fixtures__/geocoding-springfield.json'
import noMatch from './__fixtures__/geocoding-no-match.json'

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, statusText: ok ? 'OK' : 'Error' }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('searchLocations', () => {
  it('maps the geocoding response to Locations', async () => {
    mockFetch(springfield)
    const locations = await searchLocations('Springfield')
    expect(locations).toHaveLength(3)
    expect(locations[0]).toEqual({
      name: 'Springfield',
      latitude: 37.21533,
      longitude: -93.29824,
      admin1: 'Missouri',
      country: 'United States',
    })
  })

  it('returns [] when the response omits the results key (no matches)', async () => {
    mockFetch(noMatch)
    expect(await searchLocations('zzzxqv')).toEqual([])
  })

  it('rejects on a non-OK HTTP response', async () => {
    mockFetch({}, false, 500)
    await expect(searchLocations('Paris')).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/weather/geocoding.test.ts`
Expected: FAIL — cannot resolve `./geocoding`.

- [ ] **Step 5: Write minimal implementation**

Create `src/weather/geocoding.ts`:

```ts
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/weather/geocoding.test.ts`
Expected: PASS (all three tests — including the absent-`results` → `[]` proof).

- [ ] **Step 7: Commit**

```bash
git add src/weather/geocoding.ts src/weather/geocoding.test.ts src/weather/__fixtures__/geocoding-springfield.json src/weather/__fixtures__/geocoding-no-match.json
git commit -m "feat: add Geocoding module (Seam 1) with real fixtures"
```

---

### Task 5: Forecast module — **Seam 2**

Covers **Seam 2 (network-protocol, external)**. Contract verbatim: anonymous `GET .../v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,weather_code`; success → `current.temperature_2m:number` (°C) + `current.weather_code:number` mapped to `CurrentConditions`; **non-200 returns `{error:true, reason:string}` and the module treats any non-OK HTTP as a rejection, never parsing it as weather.**

> ✅ **Seam 2 success proof GROUNDED (2026-06-18).** A real success payload was captured from `api.open-meteo.com` (HTTP 200) once the daily rate limit reset, and committed as `src/weather/__fixtures__/forecast-success.json`. The previously-gated capture is **done**; the success shape is confirmed (`current.temperature_2m:number`, `current.weather_code:number`, `current_units` present). Step 1 below is now a quick verify-the-committed-fixture step, not a blocker.

**Files:**
- Use: `src/weather/__fixtures__/forecast-success.json` (real capture, already committed 2026-06-18)
- Create: `src/weather/__fixtures__/forecast-error-429.json`
- Create: `src/weather/forecast.ts`
- Test: `src/weather/forecast.test.ts`

- [ ] **Step 1: Verify the committed real success fixture**

The real fixture is already captured and committed at `src/weather/__fixtures__/forecast-success.json` (live capture from `api.open-meteo.com`, HTTP 200, 2026-06-18). Its content is:

```json
{"latitude":37.2072,"longitude":-93.30584,"generationtime_ms":0.12946128845214844,"utc_offset_seconds":0,"timezone":"GMT","timezone_abbreviation":"GMT","elevation":397.0,"current_units":{"time":"iso8601","interval":"seconds","temperature_2m":"°C","weather_code":"wmo code"},"current":{"time":"2026-06-18T08:45","interval":900,"temperature_2m":23.6,"weather_code":3}}
```

Confirm it is present and that the module reads `current.temperature_2m` (number) and `current.weather_code` (number) — the paths used by `ForecastResponse` (Step 5) and the test assertion (Step 3). The service echoes its grid-cell `latitude/longitude` (37.2072/-93.30584), which the module ignores. If you re-capture and the shape ever differs, correct `ForecastResponse`, the URL, the mapping (Step 5), and the test (Step 3) to match — but do **not** hand-author the fixture; it must remain a real capture.

- [ ] **Step 2: Save the real captured error fixture**

Create `src/weather/__fixtures__/forecast-error-429.json` (captured live from `api.open-meteo.com` on 2026-06-17, served with HTTP status 429):

```json
{ "error": true, "reason": "Daily API request limit exceeded. Please try again tomorrow." }
```

- [ ] **Step 3: Write the failing test**

Create `src/weather/forecast.test.ts`. The success assertion uses the values from the fixture you captured in Step 1 — read them from the file and fill in the two expected numbers (`<TEMP_FROM_FIXTURE>`, `<CODE_FROM_FIXTURE>` and its mapped label):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCurrentWeather } from './forecast'
import success from './__fixtures__/forecast-success.json'
import error429 from './__fixtures__/forecast-error-429.json'
import { toWeatherCondition } from './weatherCondition'

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, statusText: ok ? 'OK' : 'Error' }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('getCurrentWeather', () => {
  it('maps the forecast response to CurrentConditions', async () => {
    mockFetch(success)
    const result = await getCurrentWeather({ latitude: 37.21533, longitude: -93.29824 })
    // Values come from the captured fixture (success.current.*):
    expect(result.temperatureC).toBe(success.current.temperature_2m)
    expect(result.condition).toEqual(toWeatherCondition(success.current.weather_code))
  })

  it('rejects on a non-OK HTTP response (e.g. 429 rate limit)', async () => {
    mockFetch(error429, false, 429)
    await expect(
      getCurrentWeather({ latitude: 1, longitude: 1 }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/weather/forecast.test.ts`
Expected: FAIL — cannot resolve `./forecast`.

- [ ] **Step 5: Write minimal implementation**

Create `src/weather/forecast.ts`:

```ts
import type { CurrentConditions } from '../domain/types'
import { toWeatherCondition } from './weatherCondition'

interface ForecastResponse {
  current: {
    temperature_2m: number
    weather_code: number
  }
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

export async function getCurrentWeather(coords: {
  latitude: number
  longitude: number
}): Promise<CurrentConditions> {
  const url =
    `${ENDPOINT}?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    `&current=temperature_2m,weather_code`
  const response = await fetch(url)
  if (!response.ok) {
    console.error('Forecast request failed', response.status)
    throw new Error(`Forecast failed: ${response.status}`)
  }
  const data = (await response.json()) as ForecastResponse
  return {
    temperatureC: data.current.temperature_2m,
    condition: toWeatherCondition(data.current.weather_code),
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/weather/forecast.test.ts`
Expected: PASS (both tests). If the success test fails on a field name, correct `ForecastResponse` and the URL/mapping to match the **real captured fixture** from Step 1.

- [ ] **Step 7: Commit**

```bash
git add src/weather/forecast.ts src/weather/forecast.test.ts src/weather/__fixtures__/forecast-success.json src/weather/__fixtures__/forecast-error-429.json
git commit -m "feat: add Forecast module (Seam 2) with real fixtures"
```

---

### Task 6: Debounce hook

Gates geocoding request volume (300ms) — genuine logic, so it is tested per Overriding Principle (3).

**Files:**
- Create: `src/hooks/useDebouncedValue.ts`
- Test: `src/hooks/useDebouncedValue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useDebouncedValue.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  it('returns the latest value only after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } },
    )
    expect(result.current).toBe('a')

    rerender({ value: 'ab' })
    expect(result.current).toBe('a') // not yet — delay not elapsed

    vi.advanceTimersByTime(300)
    expect(result.current).toBe('ab')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useDebouncedValue.test.ts`
Expected: FAIL — cannot resolve `./useDebouncedValue`.

- [ ] **Step 3: Write minimal implementation**

Create `src/hooks/useDebouncedValue.ts`:

```ts
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useDebouncedValue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDebouncedValue.ts src/hooks/useDebouncedValue.test.ts
git commit -m "feat: add useDebouncedValue hook"
```

---

### Task 7: UI components and wiring

Thin presentational components plus the App that wires the modules through TanStack Query. Not unit-tested (per spec); verified manually in Task 8.

**Files:**
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/CandidateList.tsx`
- Create: `src/components/CurrentConditionsReadout.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: SearchBar**

Create `src/components/SearchBar.tsx`:

```tsx
import styled from 'styled-components'

const Input = styled.input`
  font-size: 1rem;
  padding: 0.5rem;
  width: 100%;
  max-width: 400px;
`

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <Input
      type="text"
      placeholder="Search for a place"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
```

- [ ] **Step 2: CandidateList**

Create `src/components/CandidateList.tsx`:

```tsx
import type { Location } from '../domain/types'

interface Props {
  candidates: Location[]
  onPick: (location: Location) => void
}

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
```

- [ ] **Step 3: CurrentConditionsReadout**

Create `src/components/CurrentConditionsReadout.tsx`:

```tsx
import type { CurrentConditions, Location } from '../domain/types'

interface Props {
  location: Location
  conditions: CurrentConditions
}

export function CurrentConditionsReadout({ location, conditions }: Props) {
  return (
    <div>
      <h2>{location.name}</h2>
      <p>{Math.round(conditions.temperatureC)}°C — {conditions.condition.label}</p>
    </div>
  )
}
```

- [ ] **Step 4: Wire the QueryClient in `main.tsx`**

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Wire `App.tsx`**

Replace `src/App.tsx` with:

```tsx
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
```

- [ ] **Step 6: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components src/main.tsx src/App.tsx
git commit -m "feat: wire search-to-weather UI with TanStack Query"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite serves the app at a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Verify the tracer-bullet flow end-to-end**

In the browser:
1. Type `Spr` → after ~300ms a candidate list of up to 5 Locations appears.
2. Type fewer than 2 characters → no request fires, no candidates.
3. Pick a candidate → the candidate list disappears and the current temperature (°C) + Weather Condition label render for that Location.
4. Type a new Query → the previous weather readout clears.

Expected: each step behaves as described. Failed network calls log to the console via `console.error` and show "Something went wrong".

- [ ] **Step 3: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore: finalize Feature 1 tracer bullet"
```

---

## Self-review notes

- **Spec coverage:** search/geocode (Task 4), pick (Task 7 CandidateList), current temp + condition label (Tasks 3, 5, 7), debounce 300/min-2 (Tasks 6, 7), count=5 (Task 4), bare loading/error (Task 7), clear-on-new-Query (Task 7 `handleQueryChange`), tests for the three modules + hook (Tasks 3–6). All spec sections map to a task.
- **Seam coverage:** Seam 1 → Task 4 (contract named; proof = real Springfield + no-match fixtures incl. absent-`results`→`[]`, plus non-OK rejection). Seam 2 → Task 5 (contract named; proof = **real captured** success fixture + real 429 error fixture rejection; `weather_code` totality proven in Task 3). The forecast success fixture is a real capture committed at `src/weather/__fixtures__/forecast-success.json` (2026-06-18).
- **Type consistency:** `Location`, `WeatherCondition`, `CurrentConditions`, `searchLocations`, `getCurrentWeather`, `toWeatherCondition`, `useDebouncedValue` are named identically across all tasks.
- **No new dependencies** beyond Technical-Context.MD's list (Principle 4); strict mode confirmed (Principle 2); all logic modules tested (Principle 3).

### Fix-pass mapping (feature-doc-gauntlet run 1 → fix, 2026-06-17)

Run 1 failed on check-seam-cynicism with 4 findings, all one root cause: **Seam 2 forecast success path unproven (real capture blocked from the doc environment).** Resolution (human-accepted limitation + gate — Spec sign-off):

| Finding (location) | Fix | Closure check |
|---|---|---|
| Seam 2 (d) success proof unproven | Spec (d) reworded: success real-I/O proof **gated** to Plan Task 5; error/request/totality proofs separated out as grounded-now | Spec Seam 2 (d) no longer claims a captured success fixture; says "gated to implementation" |
| Seam 2 (c)+(e) success shape/authority on memory | Spec (c) marks success shape "NOT YET GROUNDED / provisional"; (e) states success shape not grounded, gated to capture | grep of Spec Seam 2: success shape labelled provisional; (e) says "not yet grounded" |
| Plan Task 5 carries gap forward | Task 5 turned into a **GATING** task with a hard-stop banner; Step 1 blocks success impl until real capture + shape verify | Plan Task 5 header has 🚧 gate; Step 1 titled "BLOCKING" with STOP-and-escalate |
| Task 5 Step 3 success test = mock-on-both-sides until real | Step 1 requires the fixture be a **real capture** before Steps 3–7; hand-authoring forbidden | Plan Task 5 Step 1: "do NOT hand-author this fixture" |

### Fix-pass mapping (feature-doc-gauntlet run 3 → fix, 2026-06-18)

Run 3 surfaced two root causes; both closed:

| Root cause (surfaced_by) | Fix | Closure check |
|---|---|---|
| Seam 2 success path unproven (check-seam-cynicism) | Re-verified the world: rate limit had reset, so a **real success payload was captured** (HTTP 200) and committed at `src/weather/__fixtures__/forecast-success.json`; Seam 2 (c)/(d)/(e) re-grounded; Task 5 de-gated to use the real fixture | Fixture file exists with real `current.temperature_2m:23.6`/`weather_code:3`; Spec Seam 2 says "GROUNDED (real capture, 2026-06-18)"; no "capture-pending"/"NOT YET GROUNDED" remains |
| C1 sign-off self-contradiction (check-artefact-consistency) | Withdrew the override "cleared" clauses from the Spec sign-off; single unambiguous outcome | grep: no "cleared for enate-to-stories"/"clearance stands" outside historical run-note context |

**No open residuals.** The previously-gated forecast success proof is now a real committed capture. Ready for a full `/feature-doc-gauntlet` re-run.
