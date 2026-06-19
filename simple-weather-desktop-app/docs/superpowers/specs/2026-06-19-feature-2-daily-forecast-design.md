# Feature 2 — See the multi-day Daily Forecast

**Context references:**
- `Context.MD`
- `Technical-Context.MD`
- `PRD.md` (GitHub issue #15)
- `Roadmap.md` → Feature 2: See the multi-day Daily Forecast
- `docs/adr/0001-cache-and-revalidate-weather.md` (out of scope here — persistence is Feature 3 — but the design must not contradict its single combined-snapshot model)
- `docs/superpowers/specs/2026-06-18-feature-1-place-current-weather-design.md` (the feature this extends; inherits its seams)

## Summary

After the **Current Conditions**, the user sees a **Daily Forecast** — a 7-day strip of **Forecast Days**, each showing its day label, high/low temperature (°C), and **Weather Condition** (icon + label). Feature 1's single-purpose `fetch_current` is widened into one `fetch_weather` call that returns both the Current Conditions and the Daily Forecast in a single round-trip to Open-Meteo (the forecast endpoint already returns both). No new command seam is introduced; the existing forecast HTTP call is widened with `daily` parameters. Units stay fixed Metric (°C); no persistence, no refresh — those are later Features.

## Scope

**In scope**
- Widen `WeatherProvider.fetch_current → CurrentConditions` into `WeatherProvider.fetch_weather → WeatherSnapshot { current: CurrentConditions, daily: ForecastDay[] }`.
- One combined Open-Meteo forecast request returning current weather + a 7-day `daily` block (`forecast_days=7`, `timezone=auto`).
- New `DailyForecast` UI strip below the Current Conditions panel: 7 Forecast Days, each with day label + high/low °C + Weather Condition (icon + label).
- Day-label rendering: first day as **"Today"**, the rest as short weekday names ("Mon", "Tue"…), derived on the frontend from each Forecast Day's ISO date.
- Reuse Feature 1's WMO-code → Weather Condition label table (Rust) and code → icon table (frontend) for Forecast Days.
- Fail-closed parsing: a 200 response whose `daily` block is missing or whose parallel arrays are length-mismatched → `provider` error (no partial render), consistent with Feature 1 (Story #9).

**Out of scope** (later Roadmap Features)
- Persistence / caching / offline / Last Updated (Feature 3, ADR-0001) — `fetch_weather` remains stateless; no stale fallback.
- Saved Locations (Feature 4); Unit System / Settings — **units fixed Metric** here (Feature 5); manual/auto refresh (Feature 6).
- Hour-by-hour / sub-daily detail — Daily Forecast only (one Forecast Day per day), per `Context.MD`.
- A dedicated `formatting` module (Feature 5) — Feature 2 adds only a small local day-label helper, not the cross-cutting units formatter.

## Architecture

**Rust core**
- **`WeatherProvider`** *(deep)* — `geocode(query) → [LocationCandidate]` (unchanged from Feature 1) and the widened `fetch_weather(lat, lon) → WeatherSnapshot`. Owns URL/param shaping (now including the `daily` params), JSON parsing of both the `current` and the `daily` parallel-array blocks, the shared WMO-code → Weather Condition label mapping applied to current **and** each Forecast Day, and error normalisation into the one typed error.
  - `WeatherSnapshot = { current: CurrentConditions, daily: ForecastDay[] }`.
  - `CurrentConditions` unchanged: `{ temperatureC, weatherCode, conditionLabel }`.
  - `ForecastDay = { date, highC, lowC, weatherCode, conditionLabel }`.
  - Parses the Open-Meteo `daily` object (parallel arrays) by zipping `time[]`, `temperature_2m_max[]`, `temperature_2m_min[]`, `weather_code[]` index-wise into `ForecastDay[]`. **The four arrays must be equal length; a mismatch, or an absent `daily` block, is a `provider` error.**
- **Command layer** *(shallow)* — Feature 1's `fetch_current` `#[tauri::command]` is **renamed/widened to `fetch_weather`**, mapping the provider error to the same serializable envelope. `geocode` command unchanged.
- **Capabilities** — the allowlist entry `fetch_current` is renamed to `fetch_weather`; still exactly two commands (`geocode`, `fetch_weather`) exposed to the webview, no fs/shell/http/geolocation grants.

**Frontend (React 19 / TS strict)**
- The react-query / `weatherState` data call switches from `fetch_current` to `fetch_weather`. The **Current Conditions panel reads `snapshot.current`** — its shape is unchanged, so no visual change there.
- **New `DailyForecast` component** renders `snapshot.daily` as a horizontal strip of 7 Forecast Day cards: day label, high/low (°C), Weather Condition icon + label. Reuses Feature 1's `weatherCode → icon` table — every WMO code the provider can emit must resolve to an icon (or the defined fallback).
- **`dayLabel` helper** *(pure)* — maps a Forecast Day's ISO `date` to its display label: index 0 → `"Today"`, otherwise the short weekday name. Pure, no side effects; unit-tested. (Deliberately local, not the Feature 5 `formatting` module.)
- Inline states + Error Boundary inherited from Feature 1; the forecast adds no new state.

The frontend remains the sole holder of the transient selection; the Rust core stays stateless between `geocode` and `fetch_weather`.

## Data flow

```
type Query → invoke('geocode', {query}) → WeatherProvider.geocode → Open-Meteo geocoding
  → LocationCandidate[] → render list → user picks → Selected Location (lat/lon held in frontend)
  → invoke('fetch_weather', {latitude, longitude}) → WeatherProvider.fetch_weather
  → Open-Meteo forecast (current + daily, forecast_days=7, timezone=auto)
  → WeatherSnapshot { current, daily[7] }
  → render Current Conditions (snapshot.current) + DailyForecast strip (snapshot.daily)
```

## Error handling

- **`fetch_weather` failure** (transport/non-2xx, or a 200 with a missing/short/malformed `daily` block) → the **same generic inline error + Retry** as Feature 1. The forecast arrives in the *same* fetch as Current Conditions, so there is no "current succeeded, forecast failed" partial state — the snapshot contract requires both, and a body that can't satisfy it fails closed as a `provider` error rather than rendering a partial or `NaN` strip.
- **No stale fallback** — nothing is cached yet (Feature 3).
- **Render crash** — inherited Error Boundary fallback.
- **Logging** — Rust logs the (now widened) Open-Meteo request + failures via `tauri-plugin-log`; frontend `console.error` on rejected `invoke`.

## Testing

Per `Technical-Context.MD` (every seam gets real-IO on ≥1 side; treat Open-Meteo as the nondeterministic source; platform matrix Win/Mac/Linux for OS-touching code):

- **`WeatherProvider` (Rust)** — the Open-Meteo seam. Tier 1 against a captured forecast fixture that now carries the 7-entry `daily` block; assert the parallel arrays zip into 7 `ForecastDay`s in order, the WMO code → label mapping on each day, and that **(i) an absent `daily` block and (ii) a length-mismatched `daily` (e.g. `time` has 7 entries, `weather_code` has 6) each normalise to a `provider` error** (the fail-closed nullability/shape break this widening introduces). Live Open-Meteo at Tier 2.
- **Contract round-trip** — extend Feature 1's golden-fixture pattern to `WeatherSnapshot`: a Rust test asserts `serde_json::to_value(WeatherSnapshot { .. })` equals a committed golden fixture (`contract-fixtures/weather_snapshot.json`), and a frontend test parses that **same** fixture into the TS `WeatherSnapshot`, asserting the exact camelCase key set for `current` and for each `daily[]` entry (`date`, `highC`, `lowC`, `weatherCode`, `conditionLabel`) and that the array carries 7 entries. The golden file is the genuine Rust serializer output, so a `rename_all` / field-name drift on either side turns a test red.
- **Frontend** — `fetch_weather` mocked at the `invoke` boundary; assert the 7-card strip renders from `snapshot.daily`, that day 0 reads "Today" and subsequent days read weekday labels, high/low display in °C, and that every day resolves an icon. The `dayLabel` helper is unit-tested directly (index-0 → "Today"; a known date → its weekday; deterministic regardless of the machine's current date by passing the index + date explicitly).

## Seam inventory

> Feature 2 inherits Feature 1's `geocode` command seam (Seam 1) and Open-Meteo geocoding HTTP seam (Seam 3) **unchanged** — they are not re-litigated here. It **replaces** Feature 1's `fetch_current` command seam and **widens** its Open-Meteo forecast HTTP seam, both below. Auth ("none — Open-Meteo is keyless") is inherited by reference from Feature 1's first-contact note (Seam 3); not re-established.

### Seam A: `fetch_weather` command boundary (frontend ↔ Rust core) — replaces Feature 1 Seam 2
- **(a) class:** cross-process I/O — internal
- **(b) sides:** React frontend (`invoke('fetch_weather', { latitude, longitude })`) ↔ Rust `#[tauri::command] fetch_weather`
- **(c) contract:** Request `{ latitude: number, longitude: number }` (finite f64). Success resolves to `WeatherSnapshot = { current: CurrentConditions, daily: ForecastDay[] }` where `CurrentConditions = { temperatureC: number, weatherCode: number, conditionLabel: string }` (unchanged from Feature 1) and `ForecastDay = { date: string ("YYYY-MM-DD"), highC: number, lowC: number, weatherCode: number, conditionLabel: string }`. **`daily` is a non-empty array of exactly 7 entries on success; it is never null and never absent on success.** No field on a successful snapshot is nullable. `temperatureC`/`highC`/`lowC` are °C (Metric fixed); `weatherCode` is the raw WMO integer (0–99); `conditionLabel` is the Rust-resolved human label. The frontend maps every `weatherCode` (current and each day) → icon and must have an icon or defined fallback for the whole WMO set. Failure rejects with `{ kind: "network" | "provider" | "unexpected", message: string }` (unchanged envelope); a 200 body that cannot yield a complete 7-day snapshot rejects as `provider`. Field names are serde `camelCase` on the Rust side and consumed as the TS type — names and the 7-element array shape must match exactly.
- **(d) proof:** A **contract round-trip on the real serializer output**: a Rust test asserts `serde_json::to_value(WeatherSnapshot { .. })` equals committed golden fixture `contract-fixtures/weather_snapshot.json`, and a frontend test parses that **same** fixture into the TS `WeatherSnapshot`, asserting the exact camelCase key sets for `current` and for each `daily[]` entry and that `daily.length === 7`. The golden file is the genuine Rust writer output (pinned by the Rust equality assertion), so the frontend consumes the real serialized shape; a `rename_all` or field rename on either side turns both assertions red. The flow tests may still mock `invoke`. Owning symbols: `fetch_weather` command fn + `WeatherSnapshot`/`CurrentConditions`/`ForecastDay` serde structs + the TS `WeatherSnapshot` type + `contract-fixtures/weather_snapshot.json` + the WMO code→label table (Rust) and code→icon table (frontend).

### Seam B: Open-Meteo forecast HTTP (Rust core ↔ Open-Meteo) — widens Feature 1 Seam 4
- **(a) class:** network-protocol — external
- **(b) sides:** Rust `WeatherProvider.fetch_weather` (reqwest) ↔ Open-Meteo forecast service
- **(c) contract:** `GET https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=auto&temperature_unit=celsius&wind_speed_unit=kmh`. **Authentication: none (inherited from Feature 1 Seam 3).** Success body contains the Feature 1 `current` block **plus** a `daily` object of **parallel arrays**: `daily.time: string[]` (ISO `"YYYY-MM-DD"`, in the location's local timezone because `timezone=auto`), `daily.temperature_2m_max: number[]` (°C), `daily.temperature_2m_min: number[]` (°C), `daily.weather_code: number[]` (WMO integers). **With `forecast_days=7`, all four arrays have length 7 and are index-aligned** (entry `i` of each describes the same day). `daily.time[0]` is the location's local *today* (the `timezone=auto` anchor — without it, day boundaries would be GMT and "today" could be wrong). **Critical shape contract: the four `daily` arrays must be equal-length; the provider zips them index-wise and treats any length mismatch, or an absent `daily` object, as a `provider` error** (fail-closed). `daily_units` echoes `°C` / `wmo code`. Non-2xx or transport failure → normalised `network`/`provider` error.
- **(d) proof:** Rust integration test issuing the real GET (Tier 2) plus Tier 1 replay of a captured forecast fixture carrying the 7-entry `daily` block, asserting the parallel arrays parse and zip to 7 `ForecastDay`s in order, and that a deliberately length-mismatched fixture (and an absent-`daily` fixture) each map to a `provider` error. Round-trip: real provider body → `WeatherSnapshot`.
- **(e) authority:** Live Open-Meteo forecast API response captured **2026-06-19** from `https://api.open-meteo.com/v1/forecast?latitude=51.51&longitude=-0.13&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=auto` (observed: `daily` as parallel arrays `time`/`temperature_2m_max`/`temperature_2m_min`/`weather_code`, each length 7; `daily_units.temperature_2m_max = "°C"`, `daily_units.weather_code = "wmo code"`; `daily.time[0]` = local today after `timezone=auto` resolved to `Europe/London`), corroborated by the official docs `https://open-meteo.com/en/docs`. Not grounded on model memory.

**Channel classes deliberately not crossed by Feature 2:** subprocess, env-var, prior-remote-state, persistent-on-disk-state (still no caching until Feature 3), and host-OS/runtime (the widened fetch→render path has no OS-divergent contract; the platform matrix still runs the Rust tests on Win/Mac/Linux, but there is no OS-specific boundary assertion to make here). The `geocode` command seam and Open-Meteo geocoding seam are unchanged from Feature 1 and inherited, not re-enumerated.
