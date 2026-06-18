# Feature 1 — Look up a place and see its current weather (tracer bullet)

**Context references:**
- `Context.MD`
- `Technical-Context.MD`
- `PRD.md` (GitHub issue #15)
- `Roadmap.md` → Feature 1: Look up a place and see its current weather (tracer bullet)
- `docs/adr/0001-cache-and-revalidate-weather.md` (out of scope here — no persistence in Feature 1 — but the design must not contradict it)

## Summary

The thinnest end-to-end slice of the Simple Weather Desktop App: the user types a **Query**, the app geocodes it via the Rust `WeatherProvider` (Open-Meteo) over a Tauri command, renders a minimal list of candidate **Locations**, the user picks one (it becomes the **Selected Location**), and the app fetches and renders that Location's **Current Conditions** as temperature (°C) + **Weather Condition** (icon + label). This pierces every layer — React UI → `invoke` seam → Rust core → Open-Meteo → back.

## Scope

**In scope**
- Two-step lookup: `geocode(query)` → minimal candidate list → user picks → `fetch_current(lat, lon)`.
- Current Conditions render: temperature in °C + Weather Condition (icon + label).
- Five inline UI states: empty/initial, loading, no-matches, generic error + Retry, top-level Error Boundary.
- All Open-Meteo networking in the Rust core via `reqwest`; webview gets only the two commands (least-privilege capabilities).
- Rust logging of Open-Meteo requests/failures via `tauri-plugin-log`; frontend `console.error` on rejected `invoke`.

**Out of scope** (later Roadmap Features)
- Daily Forecast (Feature 2); persistence / caching / offline / Last Updated (Feature 3, ADR-0001); Saved Locations (Feature 4); Unit System / Settings — **units fixed to Metric** here (Feature 5); manual/auto refresh (Feature 6).
- Wind and other Current Conditions fields beyond temperature + Weather Condition.
- Geolocation, notifications, tray mode (PRD scope cuts).

## Architecture

**Rust core**
- **`WeatherProvider`** *(deep)* — `geocode(query) → [LocationCandidate]` and `fetch_current(lat, lon) → CurrentConditions`. Owns URL/param shaping, JSON parsing, WMO weather-code → Weather Condition label mapping, and error normalisation into one typed error.
- **Command layer** *(shallow)* — `#[tauri::command]` adapters `geocode` and `fetch_current`, mapping the provider error to a serializable envelope.
- **Capabilities** — only `geocode` and `fetch_current` exposed to the webview; no fs/shell/http/geolocation grants.

**Frontend (React 19 / TS strict)**
- Query input + candidate list (`name · region? · country`), pick → Selected Location.
- Current Conditions panel: temperature (°C) + Weather Condition (icon + label); maps `weatherCode` → icon asset.
- Inline states + Error Boundary; data fetching via `@tanstack/react-query` wrapping `invoke` (no direct `fetch`).

The frontend is the sole holder of the transient selection; the Rust core is stateless between the two calls.

## Data flow

```
type Query → invoke('geocode', {query}) → WeatherProvider.geocode → Open-Meteo geocoding
  → LocationCandidate[] → render list → user picks → Selected Location (lat/lon held in frontend)
  → invoke('fetch_current', {latitude, longitude}) → WeatherProvider.fetch_current → Open-Meteo forecast
  → CurrentConditions → render temperature + Weather Condition
```

## Error handling

- **No matches** — friendly inline "Couldn't find that place — check the spelling." (driven by an empty candidate array, not an error).
- **geocode / fetch_current failure** — one generic inline "Couldn't reach the weather service. Try again." + Retry. **No stale fallback** (nothing is cached — that is Feature 3).
- **Render crash** — Error Boundary fallback.
- **Logging** — Rust logs each Open-Meteo request + failures (`tauri-plugin-log`); frontend `console.error` on rejected `invoke`.

## Testing

Per `Technical-Context.MD` (every seam gets real-IO on ≥1 side; treat Open-Meteo as the nondeterministic source; platform matrix Win/Mac/Linux for OS-touching code):

- **`WeatherProvider` (Rust)** — the Open-Meteo seam. Tier 1 against recorded fixtures (multi-candidate, **zero-result with `results` absent**, **admin1-absent candidate**, current-weather, network/provider error); live Open-Meteo at Tier 2. Asserts the parsed shape, code→label mapping, and absent→empty/null handling.
- **Command layer** — covered via the provider tests plus a serialization round-trip check of `LocationCandidate[]` / `CurrentConditions` / the error envelope across the `invoke` boundary.
- **Frontend** — `geocode` / `fetch_current` mocked at the `invoke` boundary; assert candidate-list render (including a candidate with `region: null`), pick → Selected Location → Current Conditions render, and all five states. `vitest` + Testing Library (web-app prior art).

## Seam inventory

### Seam 1: `geocode` command boundary (frontend ↔ Rust core)
- **(a) class:** cross-process I/O — internal
- **(b) sides:** React frontend (`invoke('geocode', { query })`) ↔ Rust `#[tauri::command] geocode`
- **(c) contract:** Request `{ query: string }` (non-empty; whitespace-only is treated as empty → empty result). Success resolves to `LocationCandidate[]` where `LocationCandidate = { name: string, region: string | null, country: string, latitude: number, longitude: number }`. **`region` is nullable** and the UI renders it only when non-null. **Zero matches resolve to `[]` (empty array), never null and never a rejection.** Failure rejects with the error envelope (see Seam 2). JSON is serde-serialized on the Rust side and consumed as the TS type on the frontend — field names and nullability must match exactly.
- **(d) proof:** Rust command test that calls `geocode` and asserts the serialized JSON parses to the `LocationCandidate[]` shape — exercised with a real Open-Meteo response (multi-candidate), a zero-result response (→ `[]`), and an `admin1`-absent response (→ `region: null`); frontend test parses the same fixture JSON into the TS type. Owning symbols: `geocode` command fn + the `LocationCandidate` serde struct + the TS `LocationCandidate` type.

### Seam 2: `fetch_current` command boundary (frontend ↔ Rust core)
- **(a) class:** cross-process I/O — internal
- **(b) sides:** React frontend (`invoke('fetch_current', { latitude, longitude })`) ↔ Rust `#[tauri::command] fetch_current`
- **(c) contract:** Request `{ latitude: number, longitude: number }` (finite f64). Success resolves to `CurrentConditions = { temperatureC: number, weatherCode: number, conditionLabel: string }` — none nullable on success; `temperatureC` in °C (Metric fixed); `weatherCode` is the raw WMO integer; `conditionLabel` is the Rust-resolved human label. The frontend maps `weatherCode` → icon and **must have an icon (or a defined fallback) for every WMO code the provider can emit** (0–99 WMO set). Failure rejects with `{ kind: "network" | "provider" | "unexpected", message: string }`; `message` is human-safe; the frontend shows one generic error + Retry regardless of `kind`.
- **(d) proof:** Rust command test calling `fetch_current` against a real Open-Meteo forecast response, asserting the serialized `CurrentConditions` shape and a known code→label mapping; frontend test parses the same fixture into the TS type and asserts icon-mapping coverage (no WMO code renders blank). Owning symbols: `fetch_current` command fn + `CurrentConditions` serde struct + TS type + the code→label table (Rust) and code→icon table (frontend).

### Seam 3: Open-Meteo geocoding HTTP (Rust core ↔ Open-Meteo) — first contact
- **(a) class:** network-protocol — external
- **(b) sides:** Rust `WeatherProvider.geocode` (reqwest) ↔ Open-Meteo geocoding service
- **(c) contract:** `GET https://geocoding-api.open-meteo.com/v1/search?name=<query>&count=<N>&language=en&format=json`. **Authentication: none — Open-Meteo is keyless/open; no header, token, or key is sent** (see authentication note below). Success body: `{ "results": [ { "name": string, "latitude": number, "longitude": number, "country": string, "country_code": string, "admin1"?: string, "admin2"?: string, ... } ], "generationtime_ms": number }`. **Critical nullability: on zero matches the `results` key is ABSENT entirely** (body is `{ "generationtime_ms": number }`) — the provider MUST treat missing `results` as an empty list, not an error. `admin1` (mapped to `region`) **may be absent** per result → `region: null`. Non-2xx or transport failure → normalised `network`/`provider` error.
- **(d) proof:** Rust integration test issuing the real GET (Tier 2) plus Tier 1 replay of captured fixtures: a multi-candidate body, the **`results`-absent** zero-match body, and an `admin1`-absent candidate. The absent-`results` → `[]` mapping is asserted explicitly (the nullability break this seam exists to pin).
- **(e) authority:** Live Open-Meteo geocoding API responses captured 2026-06-18 from `https://geocoding-api.open-meteo.com/v1/search` (the `Springfield` multi-candidate, a no-match query, observed directly), corroborated by the official docs page `https://open-meteo.com/en/docs/geocoding-api`. Not grounded on model memory.

### Seam 4: Open-Meteo forecast HTTP (Rust core ↔ Open-Meteo)
- **(a) class:** network-protocol — external
- **(b) sides:** Rust `WeatherProvider.fetch_current` (reqwest) ↔ Open-Meteo forecast service
- **(c) contract:** `GET https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,weather_code&temperature_unit=celsius&wind_speed_unit=kmh`. **Authentication: none (inherited from Seam 3).** Success body contains `current_units` and `current: { time: string, interval: number, temperature_2m: number, weather_code: number }`. `current.temperature_2m` is a number in °C (because `temperature_unit=celsius`); `current.weather_code` is a WMO-code integer (0–99). Both required on success; absence of `current` → `provider` error. Non-2xx or transport failure → normalised error.
- **(d) proof:** Rust integration test issuing the real GET (Tier 2) plus Tier 1 replay of a captured forecast fixture, asserting `current.temperature_2m`/`current.weather_code` parse and map to `CurrentConditions`. Round-trip: real provider body → `CurrentConditions`.
- **(e) authority:** Live Open-Meteo forecast API response captured 2026-06-18 from `https://api.open-meteo.com/v1/forecast` (observed `current_units.temperature_2m = "°C"`, `current_units.weather_code = "wmo code"`), corroborated by `https://open-meteo.com/en/docs`. Not grounded on model memory.

**Authentication note (first contact, Seam 3):** Open-Meteo's free tier requires **no authentication** — no API key, token, or auth header — for both the geocoding and forecast endpoints (a commercial keyed tier exists but is out of scope; per `Technical-Context.MD`, were a keyed provider ever adopted the key would live in the Rust core, never the webview bundle). All later Open-Meteo seams inherit "no auth" by reference.

**Channel classes deliberately not crossed by Feature 1:** subprocess, env-var, prior-remote-state, persistent-on-disk-state (no caching until Feature 3), and host-OS/runtime (the geocode→fetch→render path has no OS-divergent contract; the platform matrix still runs the Rust tests on Win/Mac/Linux, but there is no OS-specific boundary assertion to make here).
