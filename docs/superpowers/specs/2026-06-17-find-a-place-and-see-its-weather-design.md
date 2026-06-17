# Spec: Find a place and see its weather (Feature 1 — tracer bullet)

**Context references:**
- `Context.MD`
- `Technical-Context.MD`
- `PRD.md`
- `Roadmap.md` → Feature 1: Find a place and see its weather (tracer bullet)
- `docs/adr/` — empty, no ADRs yet

## Purpose

The thinnest vertical slice that proves the whole pipeline works end-to-end against the real Open-Meteo API. The user types a **Query**, sees up to five candidate **Locations** live as they type, picks one, and sees one real piece of weather for the selected **Location**: the current temperature (°C) and its **Weather Condition** as a text label.

It de-risks every later Feature by forcing search → geocode → pick → fetch → render to exist and work against the live service.

## Scope

### In scope
- Live, debounced geocoding search (as-you-type).
- A candidate list (up to 5) the user picks from.
- Fetching and rendering current temperature (°C) + Weather Condition **label** for the selected Location.
- Bare, deliberately unstyled loading and error feedback.
- Unit tests for the three deep modules and the debounce hook.

### Out of scope (deferred per Roadmap)
- Wind, the full Current Conditions panel, weather **icons** (label only) → Feature 2.
- The Daily Forecast → Feature 3.
- Friendly/styled loading, empty ("no matches"), and error states; a React Error Boundary; responsive/mobile layout → Feature 4.
- Persistence, geolocation, unit toggle — out of scope product-wide.

## Architecture

A single-page React app — no router, no global state library.

### Deep modules (pure logic / I/O, framework-agnostic, unit-tested)

- **Geocoding** — `searchLocations(query: string) => Promise<Location[]>`. Calls Open-Meteo geocoding with `count=5`; maps raw results to `Location` objects; returns `[]` when the service omits results. See Seam 1.
- **Forecast** (minimal for F1) — `getCurrentWeather(coords: { latitude: number; longitude: number }) => Promise<CurrentConditions>`. Requests only the current `temperature_2m` + `weather_code`; maps to `CurrentConditions`. See Seam 2.
- **Weather Condition mapping** (minimal for F1) — `toWeatherCondition(code: number) => WeatherCondition`. Pure, total over all integers; unknown codes fall back to a generic label. (Icon field added in F2.)

### Domain types (TypeScript, strict)
- `Location` — `{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }`. `country`/`admin1` are optional context for disambiguation (see Seam 1 — they may be absent).
- `WeatherCondition` — `{ label: string }` (F1). Icon added in F2.
- `CurrentConditions` — `{ temperatureC: number; condition: WeatherCondition }`. Wind added in F2.

### Thin UI components (presentational, not unit-tested in F1)
- `App` — owns view state: the Query text and the selected Location; wires the two queries.
- `SearchBar` — controlled input, emits Query changes.
- `CandidateList` — renders up to 5 candidate Locations, emits the picked one.
- `CurrentConditionsReadout` — bare unstyled display of `temperatureC` + condition label.

### Wiring
- `@tanstack/react-query` provides two queries:
  - **geocoding query** — keyed on the debounced Query; `enabled` only when `debouncedQuery.trim().length >= 2`.
  - **forecast query** — keyed on the selected Location's coordinates; `enabled` only once a Location is selected.
- `useDebouncedValue(value, 300)` — small hook feeding the geocoding query key.
- styled-components is configured but barely used (styling polish is Feature 4).
- Native `fetch` only inside the two deep modules (no axios, per Technical-Context.MD).

## Data flow

1. User types into `SearchBar` → updates `query` state in `App`.
2. `useDebouncedValue(query, 300)` → `debouncedQuery`.
3. Geocoding query fires when `debouncedQuery.trim().length >= 2` → `searchLocations` → up to 5 candidate `Location[]`. TanStack Query caches per query string and discards stale in-flight results as the key changes.
4. `CandidateList` renders candidates. While fetching: bare "Loading…"; on error: bare "Something went wrong" + `console.error`.
5. User picks a candidate → stored as `selectedLocation`; the candidate list is hidden.
6. Forecast query fires (enabled by selection) → `getCurrentWeather` → `CurrentConditions`. Same bare loading/error treatment.
7. `CurrentConditionsReadout` renders `temperatureC` + Weather Condition label.

### Behaviour decisions
- Picking a candidate commits the selection and hides the candidate list.
- Typing a new Query starts a fresh search **and clears the selected Location**, so the readout never shows stale weather for a place no longer being searched.
- The forecast query is keyed on coordinates, so re-picking the same place is a cache hit (no refetch).

## Error & edge handling (tracer-bullet minimum)

- **In-flight:** plain unstyled "Loading…" for the fetching query.
- **Request failure** (network error or non-OK HTTP): plain unstyled "Something went wrong" + `console.error` (per Technical-Context.MD — always log failed API calls). TanStack Query retry left at default.
- **No matches** (geocoding omits `results`): candidate list renders nothing — no "no results" copy (Feature 4). Deliberate gap.
- **Short/empty Query** (`< 2` chars after trim): no request fires, nothing renders.
- **Render-time crash:** no Error Boundary in F1 (Feature 4). F1 relies on the bare async-error lines.
- **Malformed/partial API response:** the module mapping functions are the single place that trusts the wire shape; a missing required field throws, surfacing as the query's error state. See Seams 1 & 2.

## Testing

Per Technical-Context.MD ("tests for logic"). Tests assert external behaviour through each module's public interface, with `fetch` mocked at the boundary using **real captured fixtures** (not hand-authored shapes — see Seam authority). Tooling: Vitest. UI components are not unit-tested in F1.

- **Geocoding** — real Springfield fixture → correct `Location[]` (name/country/admin1/coords, capped at 5); real no-match fixture (no `results` key) → `[]`; non-OK HTTP → rejection.
- **Forecast** — real success fixture (capture-pending, see Seam 2) → `CurrentConditions` with correct `temperatureC` + mapped `condition`; real `429 {error:true,reason}` fixture → rejection; missing required field → rejection.
- **Weather Condition mapping** — sample of known WMO codes → expected labels; unknown code → generic fallback (proves totality / non-null label).
- **useDebouncedValue** — timer-based test: value updates only after the 300ms delay.

## Seam inventory

### Seam 1: Geocoding HTTPS call
- **(a) class:** network-protocol — external. *First contact with Open-Meteo: pins authentication.*
- **(b) sides:** Geocoding module (native `fetch`) ↔ Open-Meteo geocoding service, `https://geocoding-api.open-meteo.com/v1/search`.
- **(c) contract:**
  - **Auth:** Open-Meteo's free/non-commercial tier requires **no authentication** — an anonymous HTTPS `GET`, no API key, no auth header. (A separate commercial tier exists using an `apikey` query parameter on a `customer-` host; **not used** here. This keeps the Technical-Context.MD "secrets via env var" principle dormant.)
  - **Request:** `GET .../v1/search?name=<query>&count=5&language=en&format=json`.
  - **Response (HTTP 200):** JSON object. `results` is an array that is **present only when there are matches**; on zero matches the `results` key is **absent entirely** (body ≈ `{"generationtime_ms": <number>}`), still HTTP 200. The module **MUST** coalesce a missing `results` to `[]` — it is not an empty array.
  - **Per result shape:** `id:number`, `name:string`, `latitude:number`, `longitude:number` are **always present**; `country:string`, `country_code:string`, `admin1:string` (region) are **optional / may be absent** for some places. Mapped to `Location { name, latitude, longitude, country?, admin1? }`; the module tolerates absent `country`/`admin1`.
  - Capped to 5 via `count=5`.
- **(d) proof:** Geocoding unit tests against **real captured fixtures** — the Springfield response (captured live 2026-06-17, → 3 mapped Locations) and the no-match response `{"generationtime_ms":0.42819977}` (captured live, → `[]`). Real payloads from the service, not hand-written. A non-OK HTTP test asserts rejection.
- **(e) authority:** live API responses captured via `curl` to `geocoding-api.open-meteo.com` on 2026-06-17 (success + no-match, both HTTP 200). The published docs page returns 403 to automated fetch; the live endpoint is the grounding authority.

### Seam 2: Forecast HTTPS call
- **(a) class:** network-protocol — external. (Inherits the auth decision from Seam 1.)
- **(b) sides:** Forecast module (native `fetch`) ↔ Open-Meteo forecast service, `https://api.open-meteo.com/v1/forecast`.
- **(c) contract:**
  - **Auth:** inherits Seam 1 — free tier, anonymous GET, no key.
  - **Request:** `GET .../v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,weather_code`.
  - **Response (HTTP 200, success) — SHAPE NOT YET GROUNDED:** the success body is expected to be JSON with a `current` object containing `temperature_2m` (°C) and `weather_code` (a WMO integer) plus a `current_units` object, mapped to `CurrentConditions { temperatureC:number, condition: WeatherCondition }`. **This success shape is provisional — it has NOT been grounded against a real capture** (see (d)/(e) and the gating Plan Task 5). The exact field names/types MUST be confirmed against a real captured payload before the mapping is trusted. **The `weather_code` interpretation is total:** every integer — including codes we don't recognise — yields a `WeatherCondition` whose `label` is a non-null string (unknown → generic fallback); the mapping never throws and never returns null. (This totality IS grounded — proven by the internal Weather Condition mapping test, independent of the wire capture.)
  - **Error contract (grounded live):** on failure the service returns a **non-200** status with body `{"error": true, "reason": <string>}`. The module **MUST** treat any non-OK HTTP as a rejection (surfacing as the forecast query's error state) and never parse such a body as weather.
  - **Rate limit:** the free tier enforces a daily per-IP request cap; exceeding it yields HTTP 429 with the error envelope above. The 300ms debounce, the `>= 2` char gate, and TanStack Query caching keep request volume down.
- **(d) proof:**
  - **Success path — proof GATED to implementation (Plan Task 5), by accepted limitation.** A live success payload could not be captured from this environment on 2026-06-17 (the shared egress IP returned HTTP 429 "Daily API request limit exceeded. Please try again tomorrow."; the published docs page 403s automated fetch and the OpenAPI raw path 404'd). Per the human-accepted limitation recorded in the sign-off below, the success-path real-I/O proof is a **mandatory, blocking task at implementation time**: Plan Task 5 MUST capture a real success payload from `api.open-meteo.com` and confirm the field names/types **before** any forecast success code is written or trusted. The success shape must NOT be relied on from memory.
  - **Error path — grounded now.** Error test against the **real captured** `429 {"error":true,"reason":"Daily API request limit exceeded. Please try again tomorrow."}` envelope → rejection. (Real I/O capture, this environment, 2026-06-17.)
  - **Request shape — grounded now** by the same live calls (the request was accepted/processed by the service).
  - **`weather_code` totality — grounded now** by the internal Weather Condition mapping unit test (independent of the wire capture).
- **(e) authority:** live API via `curl` to `api.open-meteo.com`, 2026-06-17 — the error envelope and non-200 behaviour were captured directly (HTTP 429). The **success-payload shape is NOT yet grounded** (live capture rate-limited; docs 403; OpenAPI path 404 from this environment) and is gated to a real capture in Plan Task 5. This residual gap is an **accepted doc-stage limitation** (see sign-off), not a closed proof.

> Note on internal boundaries: the module → React component calls (`Location[]`, `CurrentConditions` crossing into `CandidateList`/`CurrentConditionsReadout`) are in-process, statically-typed TypeScript contracts within one bundle — code (the types) is the authority. They are not one of the seven taxonomy channels and are intentionally not listed as seams. The data-shape/nullability risk that *does* bite lives at the two external network boundaries above, where it is fully specified.

## Feature-doc-gauntlet sign-off

- **Result:** pass (by accepted limitation — human override, see below)
- **Date:** 2026-06-17
- **Automated gauntlet result (run 1):** fail. check-seam-cynicism (fail), check-doc-adr-consistency (pass), check-artefact-consistency (pass). The seam leaf flagged Seam 2's forecast *success* path as an unproven external contract.
- **Fix pass (`/fix-feature-docs`, 2026-06-17):** the four findings deduplicated to one root cause — the Open-Meteo forecast success payload cannot be captured from this environment (live API 429 "try again tomorrow"; docs 403; OpenAPI raw path 404). Re-verified live against the service, not assumed. Resolution actions taken:
  1. Seam 2's success-path (c)/(d)/(e) reworded to state honestly that the success shape is **not yet grounded** and that its real-I/O proof is **gated to implementation**.
  2. Plan Task 5 restructured into an explicit **blocking** "capture real fixture + verify shape **before** any forecast success code" task.
  3. The request-shape, error-envelope, and `weather_code` totality contracts — which **are** grounded — separated out and left proven.
- **Accepted limitation (human decision):** the Feature owner (cristina.raicovici@enate.net, 2026-06-17) explicitly **accepted** that Seam 2's success real-capture cannot be produced at doc-stage from this environment, and **gated** the proof to the blocking implementation task above. On that decision the Feature is cleared for `enate-to-stories`. This is a deliberate, recorded human override of the seam-cynicism doc-stage bar for this one seam — **not** a clean automated gauntlet pass.
- **Residual risk carried forward:** if the gated capture later reveals the success shape differs from the provisional one, the Forecast module mapping, its types, and its test (Plan Task 5) must be corrected to match the real payload before the forecast success path is trusted.
- **Note for any future re-run:** a fresh `check-seam-cynicism` leaf will, by its bar, re-flag Seam 2's success proof until a real capture exists. The clearance here rests on the recorded human acceptance above, not on a green automated re-run.
- **Automated gauntlet result (run 2, post-fix, 2026-06-17):** fail, as anticipated. check-seam-cynicism (fail — re-flagged Seam 2's success proof, confirming the override-not-pass status), check-doc-adr-consistency (pass), check-artefact-consistency (pass — and verified the reworded Seam 2 / sign-off / Plan Task 5 gating are mutually consistent, no new contradictions). The fix pass introduced no regressions; the single open item remains the accepted, gated forecast success capture. Clearance for `enate-to-stories` stands on the human acceptance above.
