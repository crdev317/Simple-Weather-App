# Feature 2 — See the multi-day Daily Forecast — Implementation Plan

> **For agentic workers:** Do NOT implement this plan directly. It must first pass `/feature-doc-gauntlet` in a clean session, then be broken into stories by `/enate-to-stories`; AFK implementation happens per-story from there. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the Current Conditions, the user sees a 7-day Daily Forecast strip (today + 6), each Forecast Day showing its day label, high/low (°C), and Weather Condition (icon + label) — fetched in the same Open-Meteo round-trip as the current weather.

**Architecture:** Feature 1's single-purpose `fetch_current → CurrentConditions` is widened into `fetch_weather → WeatherSnapshot { current, daily[7] }`. The Rust `WeatherProvider` widens its one forecast HTTP call with `daily=…&forecast_days=7&timezone=auto`, parses the parallel `daily` arrays by zipping them index-wise into `ForecastDay[]` (fail-closed on a missing/length-mismatched `daily` block), and reuses the existing WMO-code → label table. The frontend renders a new `DailyForecast` strip below the unchanged Current Conditions panel, using a small pure `dayLabel` helper. No persistence, no refresh, units stay Metric.

**Tech Stack:** Tauri v2, Rust (reqwest, serde, serde_json, tokio, tauri-plugin-log); React 19, TypeScript (strict), Vite 7, @tauri-apps/api, @tanstack/react-query, styled-components; vitest + @testing-library/react. (All from `Technical-Context.MD` → Packages in use — **no new dependency**; `dayLabel` uses the built-in `Intl.DateTimeFormat`.)

**Context references:**
- Spec: `docs/superpowers/specs/2026-06-19-feature-2-daily-forecast-design.md`
- `Context.MD`
- `Technical-Context.MD` (Overriding Principles that apply: #1 networking-in-Rust; #2 least-privilege capabilities; #4 strict typing both sides; #5 tests for logic; #6 no new deps)
- ADRs: `docs/adr/0001-cache-and-revalidate-weather.md` (constraint: do not contradict — no persistence/caching in Feature 2; the combined-snapshot shape aligns with it)
- Builds on: `docs/superpowers/plans/2026-06-18-feature-1-place-current-weather.md` (Feature 2 modifies the code that plan produces)

> An AFK Developer Agent picking up this plan MUST load every file in the Context references block before writing code.

---

## File structure (Δ from Feature 1)

```
simple-weather-desktop-app/
├── contract-fixtures/
│   └── weather_snapshot.json          # NEW golden: real Rust WeatherSnapshot serializer output (Seam A proof)
├── src/
│   ├── types.ts                       # MODIFY: add ForecastDay, WeatherSnapshot
│   ├── api.ts                         # MODIFY: fetchCurrent → fetchWeather (returns WeatherSnapshot)
│   ├── dayLabel.ts                    # NEW pure helper: ISO date + index → "Today" | short weekday
│   ├── App.tsx                        # MODIFY: call fetchWeather; render current + DailyForecast
│   ├── components/
│   │   └── DailyForecast.tsx          # NEW: the 7-day strip
│   └── __tests__/
│       ├── api.test.ts                # MODIFY: fetchWeather wrapper
│       ├── contract.test.ts           # MODIFY: add WeatherSnapshot golden parse
│       ├── dayLabel.test.ts           # NEW
│       ├── DailyForecast.test.tsx     # NEW
│       └── App.test.tsx               # MODIFY: pick → current + forecast
└── src-tauri/
    ├── capabilities/default.json      # UNCHANGED (registered commands need no ACL entry; rename is transparent)
    └── src/
        ├── lib.rs                     # MODIFY: register fetch_weather (was fetch_current)
        ├── weather_provider.rs        # MODIFY: ForecastDay + WeatherSnapshot, parse_weather_response, fetch_weather
        ├── commands.rs                # MODIFY: fetch_current command → fetch_weather (returns WeatherSnapshot)
        └── fixtures/
            ├── forecast_weather.json       # NEW real capture: current + 7-day daily block
            ├── forecast_no_daily.json      # NEW hand-authored: current present, daily absent (fail-closed)
            └── forecast_daily_mismatch.json# NEW hand-authored: daily arrays of unequal length (fail-closed)
```

> `forecast_current.json` from Feature 1 is superseded by `forecast_weather.json`; remove it in Task 1 once the new fixture is in place.

---

## Task 1: Rust — `ForecastDay` + `WeatherSnapshot` types and `parse_weather_response` (Seam B parse contract)

**Seam B contract (verbatim from the spec):** the success body carries the F1 `current` block **plus** a `daily` object of parallel arrays `daily.time: string[]` (ISO `"YYYY-MM-DD"`), `daily.temperature_2m_max: number[]` (°C), `daily.temperature_2m_min: number[]` (°C), `daily.weather_code: number[]` (WMO ints); with `forecast_days=7` all four arrays have length 7 and are index-aligned; **the four arrays must be equal-length — a mismatch, or an absent `daily` object, is a `provider` error** (fail-closed).

**Files:**
- Create: `src-tauri/src/fixtures/forecast_weather.json`, `forecast_no_daily.json`, `forecast_daily_mismatch.json`
- Modify: `src-tauri/src/weather_provider.rs`
- Remove: `src-tauri/src/fixtures/forecast_current.json`

- [ ] **Step 1: Capture the real 7-day fixture (Tier 1 proof — payload from the live service)**

```bash
cd simple-weather-desktop-app/src-tauri/src/fixtures
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.51&longitude=-0.13&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=auto&temperature_unit=celsius&wind_speed_unit=kmh" -o forecast_weather.json
rm -f forecast_current.json
```
Expected: `forecast_weather.json` contains a `current` block and a `daily` object whose `time`, `temperature_2m_max`, `temperature_2m_min`, `weather_code` arrays each have **7** entries; `daily_units.temperature_2m_max == "°C"`, `daily_units.weather_code == "wmo code"`. (Grounded against this exact request on 2026-06-19 — Seam B (e).)

- [ ] **Step 2: Write the two hand-authored fail-closed fixtures**

`src-tauri/src/fixtures/forecast_no_daily.json` (current present, `daily` absent):
```json
{"current":{"time":"2026-06-19T16:00","interval":900,"temperature_2m":29.6,"weather_code":0}}
```

`src-tauri/src/fixtures/forecast_daily_mismatch.json` (`time` has 2 entries, `weather_code` has 1):
```json
{"current":{"temperature_2m":29.6,"weather_code":0},"daily":{"time":["2026-06-19","2026-06-20"],"temperature_2m_max":[29.6,25.4],"temperature_2m_min":[18.5,17.9],"weather_code":[0]}}
```

- [ ] **Step 3: Write the failing tests** (in `weather_provider.rs` `mod tests`; replaces the Feature 1 `parses_current_conditions_with_label` / `missing_current_is_provider_error` tests, which referenced the now-removed `parse_forecast_response`)

```rust
    const WEATHER: &str = include_str!("fixtures/forecast_weather.json");
    const NO_DAILY: &str = include_str!("fixtures/forecast_no_daily.json");
    const DAILY_MISMATCH: &str = include_str!("fixtures/forecast_daily_mismatch.json");

    #[test]
    fn parses_current_and_seven_forecast_days() {
        let got = parse_weather_response(WEATHER).unwrap();
        assert!(got.current.temperature_c.is_finite());
        assert_eq!(got.current.condition_label, condition_label(got.current.weather_code));
        assert_eq!(got.daily.len(), 7);
        // each Forecast Day's label is derived from its own code
        assert_eq!(got.daily[0].condition_label, condition_label(got.daily[0].weather_code));
        assert!(got.daily[0].high_c >= got.daily[0].low_c);
    }

    #[test]
    fn missing_current_is_provider_error() {
        let err = parse_weather_response("{\"generationtime_ms\":0.1}").unwrap_err();
        assert!(matches!(err, WeatherError::Provider(_)));
    }

    #[test]
    fn missing_daily_is_provider_error() {
        let err = parse_weather_response(NO_DAILY).unwrap_err();
        assert!(matches!(err, WeatherError::Provider(_)));
    }

    #[test]
    fn mismatched_daily_array_lengths_is_provider_error() {
        let err = parse_weather_response(DAILY_MISMATCH).unwrap_err();
        assert!(matches!(err, WeatherError::Provider(_)));
    }
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd src-tauri && cargo test weather_response`
Expected: FAIL — `parse_weather_response`, `ForecastDay`, `WeatherSnapshot` not found.

- [ ] **Step 5: Write minimal implementation** (in `weather_provider.rs`; add the types near `CurrentConditions`, replace `parse_forecast_response` + its `ForecastResponse`/`RawCurrent` with the below)

```rust
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForecastDay {
    pub date: String,
    pub high_c: f64,
    pub low_c: f64,
    pub weather_code: i32,
    pub condition_label: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct WeatherSnapshot {
    pub current: CurrentConditions,
    pub daily: Vec<ForecastDay>,
}

#[derive(Deserialize)]
struct WeatherResponse {
    current: Option<RawCurrent>,
    daily: Option<RawDaily>,
}

#[derive(Deserialize)]
struct RawCurrent {
    temperature_2m: f64,
    weather_code: i32,
}

#[derive(Deserialize)]
struct RawDaily {
    time: Vec<String>,
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    weather_code: Vec<i32>,
}

/// Parse a forecast response into current + a Daily Forecast.
/// Absent `current` or `daily`, or mismatched `daily` array lengths, are provider errors (fail-closed).
pub fn parse_weather_response(body: &str) -> Result<WeatherSnapshot, WeatherError> {
    let parsed: WeatherResponse =
        serde_json::from_str(body).map_err(|e| WeatherError::Provider(e.to_string()))?;
    let current = parsed
        .current
        .ok_or_else(|| WeatherError::Provider("response had no `current` block".into()))?;
    let daily = parsed
        .daily
        .ok_or_else(|| WeatherError::Provider("response had no `daily` block".into()))?;

    let n = daily.time.len();
    if daily.temperature_2m_max.len() != n
        || daily.temperature_2m_min.len() != n
        || daily.weather_code.len() != n
    {
        return Err(WeatherError::Provider(
            "daily arrays have mismatched lengths".into(),
        ));
    }

    let days = (0..n)
        .map(|i| ForecastDay {
            date: daily.time[i].clone(),
            high_c: daily.temperature_2m_max[i],
            low_c: daily.temperature_2m_min[i],
            weather_code: daily.weather_code[i],
            condition_label: condition_label(daily.weather_code[i]).to_string(),
        })
        .collect();

    Ok(WeatherSnapshot {
        current: CurrentConditions {
            temperature_c: current.temperature_2m,
            weather_code: current.weather_code,
            condition_label: condition_label(current.weather_code).to_string(),
        },
        daily: days,
    })
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd src-tauri && cargo test weather_response`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/src/weather_provider.rs simple-weather-desktop-app/src-tauri/src/fixtures
git commit -m "feat(rust): WeatherSnapshot + ForecastDay parse with fail-closed daily checks (Seam B)"
```

---

## Task 2: Rust — widen the live fetch to `fetch_weather` + rewire the command (Seam B request, Seam A Rust side)

**Seam B request (verbatim):** `GET .../v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=auto&temperature_unit=celsius&wind_speed_unit=kmh`; auth inherited (none). `timezone=auto` anchors `daily.time[0]` to the location's local *today*.

**Files:**
- Modify: `src-tauri/src/weather_provider.rs` (replace `fetch_current` method + live test)
- Modify: `src-tauri/src/commands.rs` (replace `fetch_current` command)
- Modify: `src-tauri/src/lib.rs` (registration)

- [ ] **Step 1: Replace the `fetch_current` method with `fetch_weather`** (in `impl WeatherProvider`)

```rust
    pub async fn fetch_weather(&self, lat: f64, lon: f64) -> Result<WeatherSnapshot, WeatherError> {
        let lat_s = lat.to_string();
        let lon_s = lon.to_string();
        let resp = self
            .client
            .get(&self.forecast_base)
            .query(&[
                ("latitude", lat_s.as_str()),
                ("longitude", lon_s.as_str()),
                ("current", "temperature_2m,weather_code"),
                ("daily", "temperature_2m_max,temperature_2m_min,weather_code"),
                ("forecast_days", "7"),
                ("timezone", "auto"),
                ("temperature_unit", "celsius"),
                ("wind_speed_unit", "kmh"),
            ])
            .send()
            .await
            .map_err(|e| WeatherError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(WeatherError::Provider(format!("forecast HTTP {}", resp.status())));
        }
        let body = resp.text().await.map_err(|e| WeatherError::Network(e.to_string()))?;
        parse_weather_response(&body)
    }
```

- [ ] **Step 2: Replace the Feature 1 live forecast test with a Tier-2 (ignored) `fetch_weather` test** (in `mod tests`)

```rust
    #[tokio::test]
    #[ignore] // Tier 2: live Open-Meteo; run on schedule, not every commit
    async fn live_fetch_weather_returns_snapshot_with_seven_days() {
        let got = WeatherProvider::new().fetch_weather(51.51, -0.13).await.unwrap();
        assert!(got.current.temperature_c.is_finite());
        assert_eq!(got.daily.len(), 7);
    }
```

- [ ] **Step 3: Replace the `fetch_current` command with `fetch_weather`** (in `commands.rs`; extend the `use` to include `WeatherSnapshot`)

```rust
use crate::weather_provider::{
    CurrentConditions, LocationCandidate, WeatherError, WeatherProvider, WeatherSnapshot,
};

// ... (geocode command unchanged) ...

#[tauri::command]
pub async fn fetch_weather(latitude: f64, longitude: f64) -> Result<WeatherSnapshot, ErrorEnvelope> {
    log::info!("fetch_weather lat={latitude} lon={longitude}");
    WeatherProvider::new()
        .fetch_weather(latitude, longitude)
        .await
        .map_err(|e| {
            log::error!("fetch_weather failed: {:?}", e);
            e.into()
        })
}
```
> `CurrentConditions` may now be unused in `commands.rs`'s imports — drop it from the `use` if `cargo build` warns (Overriding Principle 4: no warnings).

- [ ] **Step 4: Update command registration** (`lib.rs`)

```rust
        .invoke_handler(tauri::generate_handler![
            commands::geocode,
            commands::fetch_weather
        ])
```

- [ ] **Step 5: Build the crate clean**

Run: `cd src-tauri && cargo build && cargo clippy -- -D warnings`
Expected: builds and lints clean (no warnings).

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/src/weather_provider.rs simple-weather-desktop-app/src-tauri/src/commands.rs simple-weather-desktop-app/src-tauri/src/lib.rs
git commit -m "feat(rust): widen fetch_current into fetch_weather command (current + 7-day daily)"
```

---

## Task 3: Seam A contract round-trip — real Rust serializer output parsed by the TS type (Seam A proof)

This is the **boundary-crossing proof** for the widened `invoke` seam. A committed golden fixture is pinned to the *real* Rust `WeatherSnapshot` serializer output by a Rust equality test, and the frontend parses that **same** fixture into the TS `WeatherSnapshot`. Neither side hand-authors the payload the other trusts, so the `camelCase` contract (`highC`/`lowC`/`weatherCode`/`conditionLabel`/`temperatureC`) and the 7-element `daily` shape cannot drift silently.

**Files:**
- Create: `contract-fixtures/weather_snapshot.json`
- Modify: `src-tauri/src/commands.rs` (add round-trip test)
- Modify: `src/__tests__/contract.test.ts`

- [ ] **Step 1: Write the golden fixture** (the agreed wire shape; the Rust test below proves the real serializer emits exactly this — values mirror the captured forecast)

`contract-fixtures/weather_snapshot.json`:
```json
{
  "current": {"temperatureC":29.6,"weatherCode":0,"conditionLabel":"Clear sky"},
  "daily": [
    {"date":"2026-06-19","highC":29.6,"lowC":18.5,"weatherCode":0,"conditionLabel":"Clear sky"},
    {"date":"2026-06-20","highC":25.4,"lowC":17.9,"weatherCode":3,"conditionLabel":"Overcast"},
    {"date":"2026-06-21","highC":28.7,"lowC":19.7,"weatherCode":3,"conditionLabel":"Overcast"},
    {"date":"2026-06-22","highC":30.5,"lowC":19.4,"weatherCode":95,"conditionLabel":"Thunderstorm"},
    {"date":"2026-06-23","highC":31.2,"lowC":19.8,"weatherCode":1,"conditionLabel":"Mainly clear"},
    {"date":"2026-06-24","highC":32.3,"lowC":23.9,"weatherCode":2,"conditionLabel":"Partly cloudy"},
    {"date":"2026-06-25","highC":28.9,"lowC":18.9,"weatherCode":2,"conditionLabel":"Partly cloudy"}
  ]
}
```

- [ ] **Step 2: Write the failing Rust round-trip test** (append to `commands.rs` `mod tests`; extend the `use` with `ForecastDay`, `WeatherSnapshot`)

```rust
    use crate::weather_provider::{CurrentConditions, ForecastDay, WeatherSnapshot};

    fn day(date: &str, high: f64, low: f64, code: i32, label: &str) -> ForecastDay {
        ForecastDay { date: date.into(), high_c: high, low_c: low, weather_code: code, condition_label: label.into() }
    }

    #[test]
    fn weather_snapshot_serializer_matches_golden_fixture() {
        let sample = WeatherSnapshot {
            current: CurrentConditions { temperature_c: 29.6, weather_code: 0, condition_label: "Clear sky".into() },
            daily: vec![
                day("2026-06-19", 29.6, 18.5, 0, "Clear sky"),
                day("2026-06-20", 25.4, 17.9, 3, "Overcast"),
                day("2026-06-21", 28.7, 19.7, 3, "Overcast"),
                day("2026-06-22", 30.5, 19.4, 95, "Thunderstorm"),
                day("2026-06-23", 31.2, 19.8, 1, "Mainly clear"),
                day("2026-06-24", 32.3, 23.9, 2, "Partly cloudy"),
                day("2026-06-25", 28.9, 18.9, 2, "Partly cloudy"),
            ],
        };
        let golden: serde_json::Value =
            serde_json::from_str(include_str!("../../contract-fixtures/weather_snapshot.json")).unwrap();
        // The ONLY assertion proving WeatherSnapshot's camelCase wire shape (incl ForecastDay).
        assert_eq!(serde_json::to_value(&sample).unwrap(), golden);
    }
```

- [ ] **Step 3: Run to verify it fails, then passes**

Run: `cd src-tauri && cargo test weather_snapshot_serializer_matches_golden`
Expected: FAIL if the golden keys disagree with the serializer (e.g. `ForecastDay` missing `rename_all` → `high_c` ≠ `highC`); PASS once the Task-1 structs serialize to the golden shape.

- [ ] **Step 4: Write the failing frontend round-trip test** (append to `src/__tests__/contract.test.ts`)

```ts
import snapshot from "../../contract-fixtures/weather_snapshot.json";
import type { WeatherSnapshot } from "../types";

describe("fetch_weather seam contract — real Rust serializer output parses as the TS type", () => {
  it("WeatherSnapshot golden has the exact key sets and 7 daily entries", () => {
    const parsed = snapshot as WeatherSnapshot;
    expect(Object.keys(parsed).sort()).toEqual(["current", "daily"]);
    expect(Object.keys(parsed.current).sort()).toEqual(["conditionLabel", "temperatureC", "weatherCode"]);
    expect(parsed.daily).toHaveLength(7);
    expect(Object.keys(parsed.daily[0]).sort()).toEqual(["conditionLabel", "date", "highC", "lowC", "weatherCode"]);
    expect(parsed.daily[0].highC).toBe(29.6);
  });
});
```

- [ ] **Step 5: Run to verify it fails, then passes**

Run: `npm test -- contract`
Expected: FAIL until `src/types.ts` (Task 4) defines `WeatherSnapshot`/`ForecastDay` with the golden key set; PASS once they agree. A future divergence (TS rename, or Rust `rename_all` dropped) turns this **and** the Step-2 Rust test red.

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/contract-fixtures/weather_snapshot.json simple-weather-desktop-app/src-tauri/src/commands.rs simple-weather-desktop-app/src/__tests__/contract.test.ts
git commit -m "test: pin fetch_weather wire contract via real-serializer golden round-trip (Seam A)"
```

---

## Task 4: Frontend types + `fetchWeather` wrapper (Seam A frontend side)

**Seam A (c) frontend side:** the TS `WeatherSnapshot`/`ForecastDay` must mirror the Rust camelCase JSON exactly; `daily` is a non-null array of 7 on success.

**Files:**
- Modify: `src/types.ts`, `src/api.ts`, `src/__tests__/api.test.ts`

- [ ] **Step 1: Update the failing test** (replace the `fetchCurrent` case in `src/__tests__/api.test.ts`)

```ts
  it("fetchWeather passes coords and returns a snapshot with current + daily", async () => {
    invokeMock.mockResolvedValue({
      current: { temperatureC: 21, weatherCode: 0, conditionLabel: "Clear sky" },
      daily: [{ date: "2026-06-19", highC: 22, lowC: 14, weatherCode: 0, conditionLabel: "Clear sky" }],
    });
    const got = await fetchWeather(41.9, 12.45);
    expect(invokeMock).toHaveBeenCalledWith("fetch_weather", { latitude: 41.9, longitude: 12.45 });
    expect(got.current.conditionLabel).toBe("Clear sky");
    expect(got.daily[0].highC).toBe(22);
  });
```
And update the import line at the top of the file:
```ts
import { geocode, fetchWeather } from "../api";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL — `fetchWeather` is not exported.

- [ ] **Step 3: Add the types** (append to `src/types.ts`)

```ts
export interface ForecastDay {
  date: string;
  highC: number;
  lowC: number;
  weatherCode: number;
  conditionLabel: string;
}

export interface WeatherSnapshot {
  current: CurrentConditions;
  daily: ForecastDay[];
}
```

- [ ] **Step 4: Replace `fetchCurrent` with `fetchWeather`** (`src/api.ts`)

```ts
import { invoke } from "@tauri-apps/api/core";
import type { LocationCandidate, WeatherSnapshot } from "./types";

export function geocode(query: string): Promise<LocationCandidate[]> {
  return invoke<LocationCandidate[]>("geocode", { query });
}

export function fetchWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  return invoke<WeatherSnapshot>("fetch_weather", { latitude, longitude });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/src/types.ts simple-weather-desktop-app/src/api.ts simple-weather-desktop-app/src/__tests__/api.test.ts
git commit -m "feat(ui): WeatherSnapshot/ForecastDay types + fetchWeather wrapper (Seam A)"
```

---

## Task 5: `dayLabel` pure helper (Forecast Day label)

Maps a Forecast Day's ISO `date` + its index to a display label: index 0 → `"Today"`, otherwise the short weekday name. Deterministic (parses as UTC, formats in UTC) so the test never depends on the runner's clock or timezone. No new dependency — `Intl.DateTimeFormat` is built in.

**Files:**
- Create: `src/dayLabel.ts`, `src/__tests__/dayLabel.test.ts`

- [ ] **Step 1: Write the failing test** (`src/__tests__/dayLabel.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { dayLabel } from "../dayLabel";

describe("dayLabel", () => {
  it("labels index 0 as Today regardless of the date", () => {
    expect(dayLabel("2026-06-19", 0)).toBe("Today");
  });

  it("labels later days with their short weekday name", () => {
    // 2026-06-20 is a Saturday, 2026-06-22 is a Monday
    expect(dayLabel("2026-06-20", 1)).toBe("Sat");
    expect(dayLabel("2026-06-22", 3)).toBe("Mon");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dayLabel`
Expected: FAIL — cannot resolve `../dayLabel`.

- [ ] **Step 3: Write `src/dayLabel.ts`**

```ts
// Index 0 is always "Today"; later days show their short weekday name.
// Parsed and formatted in UTC so the label matches the provider's calendar day
// and the result is independent of the machine's timezone.
const weekdayFmt = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });

export function dayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  return weekdayFmt.format(new Date(`${date}T00:00:00Z`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dayLabel`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add simple-weather-desktop-app/src/dayLabel.ts simple-weather-desktop-app/src/__tests__/dayLabel.test.ts
git commit -m "feat(ui): dayLabel helper (Today + short weekday, UTC-deterministic)"
```

---

## Task 6: `DailyForecast` component (the 7-day strip)

Renders `ForecastDay[]` as a strip, reusing Feature 1's `iconForCode` and the Task-5 `dayLabel`. Each day shows label + icon (with `conditionLabel` as its accessible name) + rounded high/low °C.

**Files:**
- Create: `src/components/DailyForecast.tsx`, `src/__tests__/DailyForecast.test.tsx`

- [ ] **Step 1: Write the failing test** (`src/__tests__/DailyForecast.test.tsx`)

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DailyForecast } from "../components/DailyForecast";
import type { ForecastDay } from "../types";

const days: ForecastDay[] = [
  { date: "2026-06-19", highC: 29.6, lowC: 18.5, weatherCode: 0, conditionLabel: "Clear sky" },
  { date: "2026-06-20", highC: 25.4, lowC: 17.9, weatherCode: 3, conditionLabel: "Overcast" },
  { date: "2026-06-21", highC: 28.7, lowC: 19.7, weatherCode: 3, conditionLabel: "Overcast" },
  { date: "2026-06-22", highC: 30.5, lowC: 19.4, weatherCode: 95, conditionLabel: "Thunderstorm" },
  { date: "2026-06-23", highC: 31.2, lowC: 19.8, weatherCode: 1, conditionLabel: "Mainly clear" },
  { date: "2026-06-24", highC: 32.3, lowC: 23.9, weatherCode: 2, conditionLabel: "Partly cloudy" },
  { date: "2026-06-25", highC: 28.9, lowC: 18.9, weatherCode: 2, conditionLabel: "Partly cloudy" },
];

describe("DailyForecast", () => {
  it("renders all 7 days, Today first then weekday labels, with rounded high/low", () => {
    render(<DailyForecast days={days} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("32° / 24°")).toBeInTheDocument(); // 2026-06-24, rounded
  });

  it("resolves an icon for every day (incl the thunderstorm day)", () => {
    render(<DailyForecast days={days} />);
    expect(screen.getByLabelText("Thunderstorm")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DailyForecast`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Write `src/components/DailyForecast.tsx`**

```tsx
import type { ForecastDay } from "../types";
import { iconForCode } from "../weatherIcons";
import { dayLabel } from "../dayLabel";

export function DailyForecast({ days }: { days: ForecastDay[] }) {
  return (
    <section aria-label="Daily forecast">
      <ul>
        {days.map((d, i) => (
          <li key={d.date}>
            <span>{dayLabel(d.date, i)}</span>
            <span role="img" aria-label={d.conditionLabel}>
              {iconForCode(d.weatherCode)}
            </span>
            <span>
              {Math.round(d.highC)}° / {Math.round(d.lowC)}°
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DailyForecast`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add simple-weather-desktop-app/src/components/DailyForecast.tsx simple-weather-desktop-app/src/__tests__/DailyForecast.test.tsx
git commit -m "feat(ui): DailyForecast 7-day strip (label + icon + high/low)"
```

---

## Task 7: App orchestration — render Current Conditions + Daily Forecast from one snapshot

The `pick` flow now calls `fetchWeather` and the `conditions` phase carries a `WeatherSnapshot`; the Current Conditions panel reads `snapshot.current` (unchanged shape, no visual change) and the new `DailyForecast` reads `snapshot.daily`. A failed `fetch_weather` still drops into the single generic error + Retry — no partial render.

**Files:**
- Modify: `src/App.tsx`, `src/__tests__/App.test.tsx`

- [ ] **Step 1: Update the App flow test** (`src/__tests__/App.test.tsx`)

Replace the `fetchCurrent` mock wiring and the pick-success test:
```tsx
const geocodeMock = vi.fn();
const fetchWeatherMock = vi.fn();
vi.mock("../api", () => ({
  geocode: (q: string) => geocodeMock(q),
  fetchWeather: (a: number, b: number) => fetchWeatherMock(a, b),
}));
```
```tsx
  beforeEach(() => { geocodeMock.mockReset(); fetchWeatherMock.mockReset(); });

  it("pick -> Selected Location -> Current Conditions + Daily Forecast", async () => {
    geocodeMock.mockResolvedValue([{ name: "Springfield", region: "Illinois", country: "United States", latitude: 39.8, longitude: -89.6 }]);
    fetchWeatherMock.mockResolvedValue({
      current: { temperatureC: 21, weatherCode: 0, conditionLabel: "Clear sky" },
      daily: [
        { date: "2026-06-19", highC: 22, lowC: 14, weatherCode: 0, conditionLabel: "Clear sky" },
        { date: "2026-06-20", highC: 20, lowC: 13, weatherCode: 3, conditionLabel: "Overcast" },
        { date: "2026-06-21", highC: 19, lowC: 12, weatherCode: 3, conditionLabel: "Overcast" },
        { date: "2026-06-22", highC: 23, lowC: 15, weatherCode: 1, conditionLabel: "Mainly clear" },
        { date: "2026-06-23", highC: 24, lowC: 16, weatherCode: 2, conditionLabel: "Partly cloudy" },
        { date: "2026-06-24", highC: 25, lowC: 17, weatherCode: 2, conditionLabel: "Partly cloudy" },
        { date: "2026-06-25", highC: 21, lowC: 13, weatherCode: 0, conditionLabel: "Clear sky" },
      ],
    });
    render(<App />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Springfield" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.click(await screen.findByText(/Springfield, Illinois/));
    expect(await screen.findByText(/21°C/)).toBeInTheDocument();          // Current Conditions
    expect(screen.getByLabelText("Daily forecast")).toBeInTheDocument();  // Daily Forecast strip
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
```
Update the error-case test to reject `fetchWeatherMock` (rename from `fetchCurrentMock`):
```tsx
    fetchWeatherMock.mockRejectedValue({ kind: "network", message: "boom" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL — App still imports/uses `fetchCurrent`; no "Daily forecast" region.

- [ ] **Step 3: Update `src/App.tsx`**

Change the imports:
```tsx
import { geocode, fetchWeather } from "./api";
import type { WeatherSnapshot, LocationCandidate } from "./types";
import { DailyForecast } from "./components/DailyForecast";
```
Change the `conditions` phase to carry the snapshot:
```tsx
  | { t: "conditions"; data: WeatherSnapshot }
```
Change `pick` to call `fetchWeather`:
```tsx
  async function pick(c: LocationCandidate) {
    setPhase({ t: "loading" });
    try {
      const data = await fetchWeather(c.latitude, c.longitude);
      setPhase({ t: "conditions", data });
    } catch {
      setPhase({ t: "error", retry: () => pick(c) });
    }
  }
```
Change the `conditions` render to show both panels:
```tsx
      {phase.t === "conditions" && (
        <>
          <CurrentConditionsPanel conditions={phase.data.current} />
          <DailyForecast days={phase.data.daily} />
        </>
      )}
```
> Remove the now-unused `CurrentConditions` type import if `tsc` flags it (strict `noUnusedLocals`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- App`
Expected: PASS.

- [ ] **Step 5: Run the full suites (cheap tier) + typecheck + Rust**

Run: `npm test && npx tsc --noEmit && (cd src-tauri && cargo test)`
Expected: all green; no type errors; Rust Tier-1 green.

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/src/App.tsx simple-weather-desktop-app/src/__tests__/App.test.tsx
git commit -m "feat(ui): render Current Conditions + Daily Forecast from one WeatherSnapshot"
```

---

## Task 8: Manual smoke + platform-matrix note

- [ ] **Step 1: Run the app**

Run: `npm run tauri dev`
Expected: window opens; typing "Springfield" → candidate list; picking one → Current Conditions **and** a 7-day strip below it (first column "Today", then weekday labels, each with an icon + high/low °C); offline → the single generic error + Retry (no partial strip).

- [ ] **Step 2: Platform matrix (Technical-Context)**

Run the Rust Tier-1 (`cargo test`) and the frontend suite (`npm test`) on Windows, macOS, and Linux CI runners. Run the Tier-2 ignored Rust test (`cargo test -- --ignored`) on a schedule against live Open-Meteo on each OS.

- [ ] **Step 3: Final commit (if any config changed)**

```bash
git add -A && git commit -m "test: confirm Feature 2 across platform matrix" || echo "nothing to commit"
```

---

## Self-review

**1. Spec coverage:** Widen to `fetch_weather → WeatherSnapshot{current,daily[7]}` (T1, T2, T4) · combined Open-Meteo call with `daily`/`forecast_days=7`/`timezone=auto` (T2) · zip parallel arrays into `ForecastDay[]` + fail-closed on missing/mismatched `daily` (T1) · reuse WMO label table (T1) + icon table (T6) · `DailyForecast` strip with day label + high/low + Weather Condition (T6) · "Today" + weekday labels via `dayLabel` (T5, T6) · same generic error, no partial render, no stale fallback (T7) · capabilities unchanged, still two commands (file-structure note + T2) · units stay Metric (no unit logic introduced). All spec sections map to tasks. ✅

**2. Placeholder scan:** No TBD/TODO; every code step carries real code and exact commands. ✅

**3. Type consistency:** `WeatherSnapshot { current, daily }` and `ForecastDay { date, highC/high_c, lowC/low_c, weatherCode/weather_code, conditionLabel/condition_label }` are identical across Rust (camelCase serde via `rename_all`) and TS; the command name `fetch_weather` matches across `lib.rs`, `commands.rs`, `api.ts`, the golden round-trip, and the App flow test; the golden fixture key sets in T3 match the TS interfaces in T4 and the serde structs in T1. ✅

**4. Seam coverage:**
- **Seam A (`fetch_weather` command, cross-process I/O — internal):** contract named verbatim in T2 (Rust side) + T4 (frontend side); **boundary-crossing proof = T3 golden round-trip** — the real Rust `WeatherSnapshot` serializer output (pinned by the T3 Rust equality test) is parsed by the TS `WeatherSnapshot` with exact key-set + `daily.length===7` assertions. The flow-test `invoke` mocks (T4, T7) exercise orchestration only; the wire shape is pinned by T3, not by mocks. ✅
- **Seam B (Open-Meteo forecast HTTP widened, network-protocol — external):** request contract named verbatim in T2; response/shape contract in T1; **proof = T1 real 7-day fixture** (`forecast_weather.json`, captured from the live service) parsed and zipped to 7 `ForecastDay`s, **plus** the missing-`daily` and length-mismatch fail-closed tests, **plus** the Tier-2 `#[ignore]` live `fetch_weather` test (T2); authority = the live capture on 2026-06-19 + the docs page (Seam B (e), recorded in the spec). Auth ("none") inherited by reference from Feature 1 Seam 3 — not re-litigated. ✅
- Inherited Feature 1 seams (geocode command / Open-Meteo geocoding) are untouched and not re-enumerated. ✅

Every seam in the spec's inventory has a covering task naming its (c) contract and a step writing its (d) boundary-crossing proof.
