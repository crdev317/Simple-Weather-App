# Changelog

All notable changes to this project are recorded here. The **why** matters as much as the **what**.

## [Unreleased] - 2026-06-18

First vertical slice of the Simple Weather App (Story #4): search for a place and see candidate Locations.

### Added
- **Geocoding deep module** (`src/weather/geocoding.ts`) — `searchLocations(query) → Promise<Location[]>`, calling Open-Meteo's geocoding API (`count=5`) and mapping raw results to domain `Location`s. Coalesces an absent `results` key to `[]`, because Open-Meteo omits the key entirely on a no-match rather than returning an empty array — so the no-match path must not rely on `[]` from the wire.
- **Debounce hook** (`src/hooks/useDebouncedValue.ts`) — generic `useDebouncedValue(value, delayMs)`. Used at 300 ms to throttle as-you-type search so each keystroke doesn't fire a request (keeps Open-Meteo's free-tier request volume down).
- **Search UI** — `SearchBar` (controlled Query input) and `CandidateList` (renders up to five candidate Locations, each labelled `name, region, country` to disambiguate, and emits the picked one).
- **App wiring** (`src/App.tsx`) — Query state + debounce feeding a TanStack Query geocoding query, gated to fire only when the Query is ≥ 2 non-whitespace characters; picking a candidate selects it and typing a new Query clears the selection so a stale pick never lingers.
- **Domain types** (`src/domain/types.ts`) — `Location`; plus `WeatherCondition` and `CurrentConditions` defined ahead of the weather slices (`country`/`admin1` on `Location` are optional, since Open-Meteo omits them for some places).
- **Tests** — `geocoding.test.ts` (Springfield fixture → 3 Locations; no-match fixture → `[]`; non-OK HTTP → rejection) and `useDebouncedValue.test.ts`, both using real captured Open-Meteo fixtures with `fetch` mocked at the boundary.

### Decisions
- **No HTTP client dependency** — the geocoding module uses the native `fetch` directly (no axios), per `Technical-Context.MD`. TanStack Query owns caching/loading/error state on top.
- **Loading/error feedback is deliberately bare** in this slice (`Loading…` / `Something went wrong`). Friendly/styled loading, empty ("no matches"), and error states plus a React Error Boundary are deferred to a later slice (Feature 4 in `Roadmap.md`); the forecast/current-conditions readout is deferred to Features 2–3.
- **Forecast fixtures committed but unused for now** — `src/weather/__fixtures__/forecast-success.json` and `forecast-error-429.json` were captured live during feature-doc grounding; they exist ahead of the Forecast module that the next slice will implement.
