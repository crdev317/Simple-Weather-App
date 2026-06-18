# Simple-Weather-App

A fast, frontend-only web app for looking up the weather for a place — no sign-up, no API key, no clutter. Type a place name, pick the right match from the candidate list, and (in upcoming slices) see its weather.

Weather and place data come from [Open-Meteo](https://open-meteo.com), which needs no API key.

## Status

This is an in-progress, vertically-sliced build. **Currently implemented:** the search slice — type a **Query** and see up to five candidate **Locations** to pick from.

- Debounced (300 ms), as-you-type geocoding search against Open-Meteo (fires once the Query is ≥ 2 non-whitespace characters).
- A candidate list of up to five Locations, each labelled with name, region, and country to disambiguate similarly-named places.
- Picking a candidate selects that Location; typing a new Query starts a fresh search.

The weather readout (current conditions, daily forecast, icons) lands in later slices — see `PRD.md` and `Roadmap.md`.

## Tech stack

- **React 19** SPA built with **Vite 7**, **TypeScript** (strict mode).
- **TanStack Query** for data fetching and server-state (caching, loading/error) over the native `fetch` API.
- **styled-components** for styling.
- **Vitest** + Testing Library for tests.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server
npm run build    # type-check (tsc -b) and produce a production build
npm run test     # run the Vitest suite once
npm run test:watch   # run Vitest in watch mode
npm run typecheck    # type-check without emitting
```

Open the dev-server URL Vite prints, type a place name, and pick a candidate.

## Project layout

- `src/weather/geocoding.ts` — the Geocoding deep module: `searchLocations(query) → Location[]`, mapping Open-Meteo results to domain `Location`s (tested with `fetch` mocked, in `geocoding.test.ts`).
- `src/hooks/useDebouncedValue.ts` — generic debounce hook feeding the search query key (tested).
- `src/components/SearchBar.tsx` — controlled search input that emits Query changes.
- `src/components/CandidateList.tsx` — renders candidate Locations and emits the picked one.
- `src/domain/types.ts` — domain types (`Location`, plus `WeatherCondition`/`CurrentConditions` defined ahead of the weather slices).
- `src/App.tsx` — wires the Query state, debounce, geocoding query, and candidate picker.
