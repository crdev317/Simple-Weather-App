# Feature 1 — Look up a place and see its current weather — Implementation Plan

> **For agentic workers:** Do NOT implement this plan directly. It must first pass `/feature-doc-gauntlet` in a clean session, then be broken into stories by `/enate-to-stories`; AFK implementation happens per-story from there. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tauri desktop app where the user types a Query, picks a candidate Location, and sees its Current Conditions (temperature in °C + Weather Condition icon + label).

**Architecture:** All Open-Meteo networking lives in a Rust `WeatherProvider` (deep module) exposed to a React/TS webview through two stateless Tauri commands (`geocode`, `fetch_current`). The frontend holds the transient Selected Location and renders five inline states. Parsing is split from HTTP so it can be proven against real captured payloads (Tier 1) with a live test on top (Tier 2).

**Tech Stack:** Tauri v2, Rust (reqwest, serde, serde_json, tokio, tauri-plugin-log); React 19, TypeScript (strict), Vite 7, @tauri-apps/api, @tanstack/react-query, styled-components; vitest + @testing-library/react. (All from `Technical-Context.MD` → Packages in use.)

**Context references:**
- Spec: `docs/superpowers/specs/2026-06-18-feature-1-place-current-weather-design.md`
- `Context.MD`
- `Technical-Context.MD` (Overriding Principles that apply: networking-in-Rust; least-privilege capabilities; strict typing both sides; tests for logic; no new deps beyond Packages-in-use)
- ADRs: `docs/adr/0001-cache-and-revalidate-weather.md` (constraint: do not contradict — no persistence in Feature 1)

> An AFK Developer Agent picking up this plan MUST load every file in the Context references block before writing code.

---

## File structure

```
simple-weather-desktop-app/
├── package.json                      # frontend + Tauri CLI deps, test scripts
├── index.html
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
├── src/                              # React frontend (webview)
│   ├── main.tsx                      # React entry; QueryClientProvider + ErrorBoundary
│   ├── App.tsx                       # orchestrates the five states + flow
│   ├── api.ts                        # invoke wrappers: geocode(), fetchCurrent()  (Seam 1/2 frontend side)
│   ├── types.ts                      # LocationCandidate, CurrentConditions, WeatherError TS types
│   ├── weatherIcons.ts               # WMO weatherCode → icon  (Seam 2 icon coverage)
│   ├── components/
│   │   ├── QueryInput.tsx
│   │   ├── CandidateList.tsx
│   │   ├── CurrentConditionsPanel.tsx
│   │   └── ErrorBoundary.tsx
│   └── __tests__/
│       ├── api.test.ts
│       ├── weatherIcons.test.ts
│       ├── CandidateList.test.tsx
│       └── App.test.tsx
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json     # least-privilege: only the two commands
    └── src/
        ├── main.rs                   # bin entry → app_lib::run()
        ├── lib.rs                    # builder, plugin-log, command registration
        ├── weather_provider.rs       # WeatherProvider + types + parse fns + WMO labels  (Seam 3/4)
        ├── commands.rs               # #[tauri::command] geocode/fetch_current + error envelope (Seam 1/2 Rust side)
        └── fixtures/                 # real Open-Meteo payloads captured 2026-06-18 (Tier 1 proof)
            ├── geocode_multi.json
            ├── geocode_zero.json     # results key ABSENT
            ├── geocode_no_admin1.json
            └── forecast_current.json
```

---

## Task 1: Scaffold the Tauri + React + TS project

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src/main.tsx`, `src/App.tsx` (placeholder)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "simple-weather-desktop-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.51.0",
    "@tauri-apps/api": "^2.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "styled-components": "^6.1.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` (strict — Overriding Principle 4)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`, `vitest.config.ts`, `index.html`**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Simple Weather</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "simple-weather-desktop-app"
version = "0.1.0"
edition = "2021"

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-log = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["macros"] }
log = "0.4"
```

- [ ] **Step 5: Create `src-tauri/tauri.conf.json`, `main.rs`, `lib.rs` (minimal placeholder app)**

`src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    app_lib::run();
}
```

`src-tauri/src/lib.rs` (commands wired in Task 6):
```rust
pub mod commands;
pub mod weather_provider;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::geocode,
            commands::fetch_current
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/tauri.conf.json` (build/window config; capabilities filled in Task 7):
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Simple Weather",
  "version": "0.1.0",
  "identifier": "net.enate.simpleweatherdesktop",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{ "title": "Simple Weather", "width": 420, "height": 640 }],
    "security": { "csp": null }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/package.json simple-weather-desktop-app/*.ts simple-weather-desktop-app/*.json simple-weather-desktop-app/index.html simple-weather-desktop-app/src-tauri
git commit -m "chore: scaffold Tauri + React + TS project for Feature 1"
```

---

## Task 2: Rust types + WMO weather-code → Weather Condition label

Covers the code→label half of the **Current Conditions** data shape (Seam 2 / Seam 4 (c)).

**Files:**
- Create: `src-tauri/src/weather_provider.rs`

- [ ] **Step 1: Write the failing test** (append to `weather_provider.rs`)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_wmo_codes_to_labels() {
        assert_eq!(condition_label(0), "Clear sky");
        assert_eq!(condition_label(2), "Partly cloudy");
        assert_eq!(condition_label(61), "Rain");
        assert_eq!(condition_label(95), "Thunderstorm");
    }

    #[test]
    fn maps_unknown_code_to_unknown_label() {
        assert_eq!(condition_label(123), "Unknown");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test condition_label`
Expected: FAIL — `condition_label` not found.

- [ ] **Step 3: Write minimal implementation** (top of `weather_provider.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LocationCandidate {
    pub name: String,
    pub region: Option<String>,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CurrentConditions {
    pub temperature_c: f64,
    pub weather_code: i32,
    pub condition_label: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum WeatherError {
    Network(String),
    Provider(String),
    Unexpected(String),
}

/// WMO weather interpretation codes → human label (Open-Meteo `weather_code`).
pub fn condition_label(code: i32) -> &'static str {
    match code {
        0 => "Clear sky",
        1 => "Mainly clear",
        2 => "Partly cloudy",
        3 => "Overcast",
        45 | 48 => "Fog",
        51 | 53 | 55 => "Drizzle",
        56 | 57 => "Freezing drizzle",
        61 | 63 | 65 => "Rain",
        66 | 67 => "Freezing rain",
        71 | 73 | 75 => "Snow",
        77 => "Snow grains",
        80 | 81 | 82 => "Rain showers",
        85 | 86 => "Snow showers",
        95 => "Thunderstorm",
        96 | 99 => "Thunderstorm with hail",
        _ => "Unknown",
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test condition_label`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/src/weather_provider.rs
git commit -m "feat(rust): weather types + WMO code->label mapping"
```

---

## Task 3: Parse + fetch Open-Meteo geocoding (Seam 3)

**Seam 3 contract (verbatim from the spec):** `GET https://geocoding-api.open-meteo.com/v1/search?name=<query>&count=<N>&language=en&format=json`; no auth; **on zero matches the `results` key is ABSENT** → must map to empty list; `admin1` (→ `region`) may be absent → `null`.

**Files:**
- Create: `src-tauri/src/fixtures/geocode_multi.json`, `geocode_zero.json`, `geocode_no_admin1.json`
- Modify: `src-tauri/src/weather_provider.rs`

- [ ] **Step 1: Capture real fixtures (Tier 1 proof — payloads from the live service)**

```bash
cd simple-weather-desktop-app/src-tauri/src/fixtures
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=Springfield&count=3&language=en&format=json" -o geocode_multi.json
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=zzzzxqnotaplace&count=3&language=en&format=json" -o geocode_zero.json
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=Vatican&count=1&language=en&format=json" -o geocode_no_admin1.json
```
Expected: `geocode_zero.json` has **no** `results` key (just `generationtime_ms`); `geocode_no_admin1.json`'s result has no `admin1`.

- [ ] **Step 2: Write the failing test** (in `weather_provider.rs` `mod tests`)

```rust
    const MULTI: &str = include_str!("fixtures/geocode_multi.json");
    const ZERO: &str = include_str!("fixtures/geocode_zero.json");
    const NO_ADMIN1: &str = include_str!("fixtures/geocode_no_admin1.json");

    #[test]
    fn parses_multiple_candidates() {
        let got = parse_geocode_response(MULTI).unwrap();
        assert!(got.len() >= 2);
        assert_eq!(got[0].name, "Springfield");
        assert!(got[0].region.is_some());
    }

    #[test]
    fn absent_results_key_maps_to_empty_list() {
        let got = parse_geocode_response(ZERO).unwrap();
        assert_eq!(got, vec![]);
    }

    #[test]
    fn candidate_without_admin1_has_null_region() {
        let got = parse_geocode_response(NO_ADMIN1).unwrap();
        assert_eq!(got[0].region, None);
    }
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd src-tauri && cargo test geocode_response`
Expected: FAIL — `parse_geocode_response` not found.

- [ ] **Step 4: Write minimal implementation** (in `weather_provider.rs`)

```rust
#[derive(Deserialize)]
struct GeocodingResponse {
    results: Option<Vec<RawGeoResult>>,
}

#[derive(Deserialize)]
struct RawGeoResult {
    name: String,
    latitude: f64,
    longitude: f64,
    country: String,
    admin1: Option<String>,
}

/// Parse a geocoding response body. Absent `results` => empty list (zero matches).
pub fn parse_geocode_response(body: &str) -> Result<Vec<LocationCandidate>, WeatherError> {
    let parsed: GeocodingResponse =
        serde_json::from_str(body).map_err(|e| WeatherError::Provider(e.to_string()))?;
    let candidates = parsed
        .results
        .unwrap_or_default()
        .into_iter()
        .map(|r| LocationCandidate {
            name: r.name,
            region: r.admin1,
            country: r.country,
            latitude: r.latitude,
            longitude: r.longitude,
        })
        .collect();
    Ok(candidates)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd src-tauri && cargo test geocode_response`
Expected: PASS (3 tests).

- [ ] **Step 6: Add the live fetch + a Tier-2 (ignored) integration test**

Add to `weather_provider.rs`:
```rust
pub struct WeatherProvider {
    client: reqwest::Client,
    geocoding_base: String,
    forecast_base: String,
}

impl WeatherProvider {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            geocoding_base: "https://geocoding-api.open-meteo.com/v1/search".into(),
            forecast_base: "https://api.open-meteo.com/v1/forecast".into(),
        }
    }

    pub async fn geocode(&self, query: &str) -> Result<Vec<LocationCandidate>, WeatherError> {
        if query.trim().is_empty() {
            return Ok(vec![]);
        }
        let resp = self
            .client
            .get(&self.geocoding_base)
            .query(&[("name", query), ("count", "8"), ("language", "en"), ("format", "json")])
            .send()
            .await
            .map_err(|e| WeatherError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(WeatherError::Provider(format!("geocoding HTTP {}", resp.status())));
        }
        let body = resp.text().await.map_err(|e| WeatherError::Network(e.to_string()))?;
        parse_geocode_response(&body)
    }
}
```
And in `mod tests`:
```rust
    #[tokio::test]
    #[ignore] // Tier 2: live Open-Meteo; run on schedule, not every commit
    async fn live_geocode_returns_candidates() {
        let got = WeatherProvider::new().geocode("Springfield").await.unwrap();
        assert!(!got.is_empty());
    }
```

- [ ] **Step 7: Run tests**

Run: `cd src-tauri && cargo test` (Tier 1) and `cargo test -- --ignored` (Tier 2, networked)
Expected: Tier-1 PASS; Tier-2 PASS when run with network.

- [ ] **Step 8: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/src/weather_provider.rs simple-weather-desktop-app/src-tauri/src/fixtures
git commit -m "feat(rust): geocode parse + fetch (Seam 3) with real-payload fixtures"
```

---

## Task 4: Parse + fetch Open-Meteo current weather (Seam 4)

**Seam 4 contract (verbatim):** `GET .../v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,weather_code&temperature_unit=celsius&wind_speed_unit=kmh`; auth inherited (none); `current.temperature_2m` (°C number), `current.weather_code` (WMO int) both required; absent `current` → provider error.

**Files:**
- Create: `src-tauri/src/fixtures/forecast_current.json`
- Modify: `src-tauri/src/weather_provider.rs`

- [ ] **Step 1: Capture the fixture**

```bash
cd simple-weather-desktop-app/src-tauri/src/fixtures
curl -s "https://api.open-meteo.com/v1/forecast?latitude=39.80&longitude=-89.64&current=temperature_2m,weather_code&temperature_unit=celsius&wind_speed_unit=kmh" -o forecast_current.json
```

- [ ] **Step 2: Write the failing test** (`mod tests`)

```rust
    const FORECAST: &str = include_str!("fixtures/forecast_current.json");

    #[test]
    fn parses_current_conditions_with_label() {
        let got = parse_forecast_response(FORECAST).unwrap();
        assert!(got.temperature_c.is_finite());
        assert_eq!(got.condition_label, condition_label(got.weather_code));
    }

    #[test]
    fn missing_current_is_provider_error() {
        let err = parse_forecast_response("{\"generationtime_ms\":0.1}").unwrap_err();
        assert!(matches!(err, WeatherError::Provider(_)));
    }
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd src-tauri && cargo test forecast`
Expected: FAIL — `parse_forecast_response` not found.

- [ ] **Step 4: Write minimal implementation**

```rust
#[derive(Deserialize)]
struct ForecastResponse {
    current: Option<RawCurrent>,
}

#[derive(Deserialize)]
struct RawCurrent {
    temperature_2m: f64,
    weather_code: i32,
}

pub fn parse_forecast_response(body: &str) -> Result<CurrentConditions, WeatherError> {
    let parsed: ForecastResponse =
        serde_json::from_str(body).map_err(|e| WeatherError::Provider(e.to_string()))?;
    let current = parsed
        .current
        .ok_or_else(|| WeatherError::Provider("response had no `current` block".into()))?;
    Ok(CurrentConditions {
        temperature_c: current.temperature_2m,
        weather_code: current.weather_code,
        condition_label: condition_label(current.weather_code).to_string(),
    })
}
```

- [ ] **Step 5: Add the live fetch method** (in `impl WeatherProvider`)

```rust
    pub async fn fetch_current(&self, lat: f64, lon: f64) -> Result<CurrentConditions, WeatherError> {
        let lat_s = lat.to_string();
        let lon_s = lon.to_string();
        let resp = self
            .client
            .get(&self.forecast_base)
            .query(&[
                ("latitude", lat_s.as_str()),
                ("longitude", lon_s.as_str()),
                ("current", "temperature_2m,weather_code"),
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
        parse_forecast_response(&body)
    }
```

- [ ] **Step 6: Run tests**

Run: `cd src-tauri && cargo test forecast`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/src/weather_provider.rs simple-weather-desktop-app/src-tauri/src/fixtures/forecast_current.json
git commit -m "feat(rust): current-weather parse + fetch (Seam 4)"
```

---

## Task 5: Tauri command layer + error envelope (Seam 1 & 2, Rust side)

**Seam 1/2 contract (verbatim):** commands resolve to `LocationCandidate[]` / `CurrentConditions` (camelCase JSON; `region` nullable; zero matches → `[]`) or reject with `{ kind: "network" | "provider" | "unexpected", message: string }`.

**Files:**
- Create: `src-tauri/src/commands.rs`

- [ ] **Step 1: Write the failing test** (in `commands.rs`)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_envelope_serializes_with_kind_and_message() {
        let env = ErrorEnvelope::from(crate::weather_provider::WeatherError::Network("boom".into()));
        let json = serde_json::to_string(&env).unwrap();
        assert_eq!(json, r#"{"kind":"network","message":"boom"}"#);
    }

    #[test]
    fn location_candidate_serializes_null_region() {
        let c = crate::weather_provider::LocationCandidate {
            name: "Vatican City".into(), region: None, country: "Vatican".into(),
            latitude: 41.9, longitude: 12.45,
        };
        let json = serde_json::to_string(&c).unwrap();
        assert!(json.contains(r#""region":null"#));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib commands`
Expected: FAIL — `ErrorEnvelope` not found.

- [ ] **Step 3: Write minimal implementation** (`commands.rs`)

```rust
use serde::Serialize;
use crate::weather_provider::{CurrentConditions, LocationCandidate, WeatherError, WeatherProvider};

#[derive(Serialize)]
pub struct ErrorEnvelope {
    pub kind: String,
    pub message: String,
}

impl From<WeatherError> for ErrorEnvelope {
    fn from(e: WeatherError) -> Self {
        match e {
            WeatherError::Network(m) => ErrorEnvelope { kind: "network".into(), message: m },
            WeatherError::Provider(m) => ErrorEnvelope { kind: "provider".into(), message: m },
            WeatherError::Unexpected(m) => ErrorEnvelope { kind: "unexpected".into(), message: m },
        }
    }
}

#[tauri::command]
pub async fn geocode(query: String) -> Result<Vec<LocationCandidate>, ErrorEnvelope> {
    log::info!("geocode query len={}", query.len());
    WeatherProvider::new().geocode(&query).await.map_err(|e| {
        log::error!("geocode failed: {:?}", e);
        e.into()
    })
}

#[tauri::command]
pub async fn fetch_current(latitude: f64, longitude: f64) -> Result<CurrentConditions, ErrorEnvelope> {
    log::info!("fetch_current lat={latitude} lon={longitude}");
    WeatherProvider::new().fetch_current(latitude, longitude).await.map_err(|e| {
        log::error!("fetch_current failed: {:?}", e);
        e.into()
    })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test --lib commands`
Expected: PASS (2 tests).

- [ ] **Step 5: Build the whole crate to confirm command registration (from Task 1 `lib.rs`) compiles**

Run: `cd src-tauri && cargo build`
Expected: builds clean (no warnings — Overriding Principle 4 / clippy-clean).

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/src/commands.rs
git commit -m "feat(rust): geocode/fetch_current commands + error envelope (Seam 1/2)"
```

---

## Task 6: Least-privilege Tauri capabilities (Overriding Principle 2)

**Files:**
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Write the capabilities file — expose only the two commands, nothing else**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Least-privilege: only the weather commands and core window.",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-focus"
  ]
}
```

> Note: `geocode`/`fetch_current` are app-defined commands registered via `invoke_handler`; Tauri v2 exposes registered commands to the webview without an extra ACL permission, while **no** `fs`, `shell`, `http`, or geolocation permission is granted. Confirm the generated schema lists no broad capabilities.

- [ ] **Step 2: Verify config loads**

Run: `cd src-tauri && cargo build`
Expected: builds clean; `tauri.conf.json` + capabilities parse.

- [ ] **Step 3: Commit**

```bash
git add simple-weather-desktop-app/src-tauri/capabilities/default.json
git commit -m "chore(tauri): least-privilege capabilities (only weather commands)"
```

---

## Task 7: Frontend types + `invoke` wrappers (Seam 1 & 2, frontend side)

**Seam 1/2 (c) frontend side:** the TS types must mirror the Rust camelCase JSON exactly, including `region: string | null`.

**Files:**
- Create: `src/types.ts`, `src/api.ts`
- Create: `src/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test** (`src/__tests__/api.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { geocode, fetchCurrent } from "../api";

describe("api wrappers (Seam 1/2 frontend side)", () => {
  beforeEach(() => invokeMock.mockReset());

  it("geocode passes the query and returns candidates incl null region", async () => {
    invokeMock.mockResolvedValue([
      { name: "Vatican City", region: null, country: "Vatican", latitude: 41.9, longitude: 12.45 },
    ]);
    const got = await geocode("Vatican");
    expect(invokeMock).toHaveBeenCalledWith("geocode", { query: "Vatican" });
    expect(got[0].region).toBeNull();
  });

  it("fetchCurrent passes coords and returns conditions", async () => {
    invokeMock.mockResolvedValue({ temperatureC: 21, weatherCode: 0, conditionLabel: "Clear sky" });
    const got = await fetchCurrent(41.9, 12.45);
    expect(invokeMock).toHaveBeenCalledWith("fetch_current", { latitude: 41.9, longitude: 12.45 });
    expect(got.conditionLabel).toBe("Clear sky");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL — cannot resolve `../api`.

- [ ] **Step 3: Write `src/types.ts`**

```ts
export interface LocationCandidate {
  name: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
}

export interface CurrentConditions {
  temperatureC: number;
  weatherCode: number;
  conditionLabel: string;
}

export interface WeatherError {
  kind: "network" | "provider" | "unexpected";
  message: string;
}
```

- [ ] **Step 4: Write `src/api.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import type { LocationCandidate, CurrentConditions } from "./types";

export function geocode(query: string): Promise<LocationCandidate[]> {
  return invoke<LocationCandidate[]>("geocode", { query });
}

export function fetchCurrent(latitude: number, longitude: number): Promise<CurrentConditions> {
  return invoke<CurrentConditions>("fetch_current", { latitude, longitude });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add simple-weather-desktop-app/src/types.ts simple-weather-desktop-app/src/api.ts simple-weather-desktop-app/src/__tests__/api.test.ts
git commit -m "feat(ui): typed invoke wrappers for geocode/fetch_current (Seam 1/2)"
```

---

## Task 8: Frontend WMO code → icon, with coverage (Seam 2 icon coverage)

**Seam 2 (c):** the frontend must have an icon (or defined fallback) for every WMO code the provider can emit.

**Files:**
- Create: `src/weatherIcons.ts`, `src/__tests__/weatherIcons.test.ts`

- [ ] **Step 1: Write the failing test** (`src/__tests__/weatherIcons.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { iconForCode, WMO_CODES } from "../weatherIcons";

describe("weatherIcons (Seam 2 icon coverage)", () => {
  it("returns a non-empty icon for every WMO code Open-Meteo emits", () => {
    for (const code of WMO_CODES) {
      expect(iconForCode(code).length).toBeGreaterThan(0);
    }
  });
  it("falls back for an unknown code", () => {
    expect(iconForCode(123)).toBe("❓");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- weatherIcons`
Expected: FAIL — cannot resolve `../weatherIcons`.

- [ ] **Step 3: Write `src/weatherIcons.ts`**

```ts
// The full set of WMO weather_code values Open-Meteo returns.
export const WMO_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
  71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
] as const;

const ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

export function iconForCode(code: number): string {
  return ICONS[code] ?? "❓";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- weatherIcons`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add simple-weather-desktop-app/src/weatherIcons.ts simple-weather-desktop-app/src/__tests__/weatherIcons.test.ts
git commit -m "feat(ui): WMO code->icon map with full-coverage test (Seam 2)"
```

---

## Task 9: CandidateList component (render + null region)

**Files:**
- Create: `src/components/CandidateList.tsx`, `src/__tests__/CandidateList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CandidateList } from "../components/CandidateList";
import type { LocationCandidate } from "../types";

const withRegion: LocationCandidate = { name: "Springfield", region: "Illinois", country: "United States", latitude: 39.8, longitude: -89.6 };
const noRegion: LocationCandidate = { name: "Vatican City", region: null, country: "Vatican", latitude: 41.9, longitude: 12.45 };

describe("CandidateList", () => {
  it("renders region only when present and fires onPick", () => {
    const onPick = vi.fn();
    render(<CandidateList candidates={[withRegion, noRegion]} onPick={onPick} />);
    expect(screen.getByText(/Illinois/)).toBeInTheDocument();
    expect(screen.queryByText(/Illinois.*Vatican/)).toBeNull();
    fireEvent.click(screen.getByText("Springfield"));
    expect(onPick).toHaveBeenCalledWith(withRegion);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CandidateList`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Write `src/components/CandidateList.tsx`**

```tsx
import type { LocationCandidate } from "../types";

export function CandidateList({
  candidates,
  onPick,
}: {
  candidates: LocationCandidate[];
  onPick: (c: LocationCandidate) => void;
}) {
  return (
    <ul>
      {candidates.map((c, i) => (
        <li key={`${c.latitude},${c.longitude},${i}`}>
          <button type="button" onClick={() => onPick(c)}>
            {c.name}
            {c.region ? `, ${c.region}` : ""}, {c.country}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CandidateList`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add simple-weather-desktop-app/src/components/CandidateList.tsx simple-weather-desktop-app/src/__tests__/CandidateList.test.tsx
git commit -m "feat(ui): CandidateList with conditional region render"
```

---

## Task 10: CurrentConditionsPanel + ErrorBoundary

**Files:**
- Create: `src/components/CurrentConditionsPanel.tsx`, `src/components/ErrorBoundary.tsx`

- [ ] **Step 1: Write the failing test** (`src/__tests__/CandidateList.test.tsx` sibling — new file `CurrentConditionsPanel.test.tsx`)

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrentConditionsPanel } from "../components/CurrentConditionsPanel";

describe("CurrentConditionsPanel", () => {
  it("shows temperature in °C, the icon, and the label", () => {
    render(<CurrentConditionsPanel conditions={{ temperatureC: 21, weatherCode: 0, conditionLabel: "Clear sky" }} />);
    expect(screen.getByText(/21°C/)).toBeInTheDocument();
    expect(screen.getByText(/Clear sky/)).toBeInTheDocument();
    expect(screen.getByText("☀️")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CurrentConditionsPanel`
Expected: FAIL.

- [ ] **Step 3: Write the components**

`src/components/CurrentConditionsPanel.tsx`:
```tsx
import type { CurrentConditions } from "../types";
import { iconForCode } from "../weatherIcons";

export function CurrentConditionsPanel({ conditions }: { conditions: CurrentConditions }) {
  return (
    <section aria-label="Current conditions">
      <span role="img" aria-label={conditions.conditionLabel}>{iconForCode(conditions.weatherCode)}</span>
      <div>{Math.round(conditions.temperatureC)}°C</div>
      <div>{conditions.conditionLabel}</div>
    </section>
  );
}
```

`src/components/ErrorBoundary.tsx`:
```tsx
import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) { console.error("Render error", error); }
  render() {
    if (this.state.hasError) return <div>Something went wrong. Please restart the app.</div>;
    return this.props.children;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CurrentConditionsPanel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add simple-weather-desktop-app/src/components/CurrentConditionsPanel.tsx simple-weather-desktop-app/src/components/ErrorBoundary.tsx simple-weather-desktop-app/src/__tests__/CurrentConditionsPanel.test.tsx
git commit -m "feat(ui): CurrentConditionsPanel + ErrorBoundary"
```

---

## Task 11: App orchestration — the five states + flow

**Files:**
- Create: `src/components/QueryInput.tsx`, `src/App.tsx`, `src/main.tsx`
- Create: `src/__tests__/App.test.tsx`

- [ ] **Step 1: Write the failing test** (covers flow + states; api mocked at the boundary)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const geocodeMock = vi.fn();
const fetchCurrentMock = vi.fn();
vi.mock("../api", () => ({ geocode: (q: string) => geocodeMock(q), fetchCurrent: (a: number, b: number) => fetchCurrentMock(a, b) }));

import { App } from "../App";

describe("App flow + states", () => {
  beforeEach(() => { geocodeMock.mockReset(); fetchCurrentMock.mockReset(); });

  it("empty initial state prompts to search", () => {
    render(<App />);
    expect(screen.getByText(/search for a place/i)).toBeInTheDocument();
  });

  it("no-matches state when geocode returns empty", async () => {
    geocodeMock.mockResolvedValue([]);
    render(<App />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zzz" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(screen.getByText(/couldn't find that place/i)).toBeInTheDocument());
  });

  it("pick -> Selected Location -> Current Conditions", async () => {
    geocodeMock.mockResolvedValue([{ name: "Springfield", region: "Illinois", country: "United States", latitude: 39.8, longitude: -89.6 }]);
    fetchCurrentMock.mockResolvedValue({ temperatureC: 21, weatherCode: 0, conditionLabel: "Clear sky" });
    render(<App />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Springfield" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.click(await screen.findByText(/Springfield, Illinois/));
    expect(await screen.findByText(/21°C/)).toBeInTheDocument();
  });

  it("error + Retry when fetch fails", async () => {
    geocodeMock.mockResolvedValue([{ name: "X", region: null, country: "Y", latitude: 1, longitude: 2 }]);
    fetchCurrentMock.mockRejectedValue({ kind: "network", message: "boom" });
    render(<App />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "X" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.click(await screen.findByText(/X, Y/));
    expect(await screen.findByText(/couldn't reach the weather service/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL — cannot resolve `../App`.

- [ ] **Step 3: Write `src/components/QueryInput.tsx`**

```tsx
import { useState } from "react";

export function QueryInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onSearch(value); }}>
      <input type="text" aria-label="Place name" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit">Search</button>
    </form>
  );
}
```

- [ ] **Step 4: Write `src/App.tsx`** (the five states, no persistence — ADR-0001 stays out)

```tsx
import { useState } from "react";
import { geocode, fetchCurrent } from "./api";
import type { CurrentConditions, LocationCandidate } from "./types";
import { QueryInput } from "./components/QueryInput";
import { CandidateList } from "./components/CandidateList";
import { CurrentConditionsPanel } from "./components/CurrentConditionsPanel";

type Phase =
  | { t: "empty" }
  | { t: "loading" }
  | { t: "candidates"; items: LocationCandidate[] }
  | { t: "no-matches" }
  | { t: "conditions"; data: CurrentConditions }
  | { t: "error"; retry: () => void };

export function App() {
  const [phase, setPhase] = useState<Phase>({ t: "empty" });

  async function runSearch(query: string) {
    setPhase({ t: "loading" });
    try {
      const items = await geocode(query);
      setPhase(items.length === 0 ? { t: "no-matches" } : { t: "candidates", items });
    } catch {
      setPhase({ t: "error", retry: () => runSearch(query) });
    }
  }

  async function pick(c: LocationCandidate) {
    setPhase({ t: "loading" });
    try {
      const data = await fetchCurrent(c.latitude, c.longitude);
      setPhase({ t: "conditions", data });
    } catch {
      setPhase({ t: "error", retry: () => pick(c) });
    }
  }

  return (
    <main>
      <QueryInput onSearch={runSearch} />
      {phase.t === "empty" && <p>Search for a place to see its weather.</p>}
      {phase.t === "loading" && <p role="status">Loading…</p>}
      {phase.t === "no-matches" && <p>Couldn't find that place — check the spelling and try again.</p>}
      {phase.t === "candidates" && <CandidateList candidates={phase.items} onPick={pick} />}
      {phase.t === "conditions" && <CurrentConditionsPanel conditions={phase.data} />}
      {phase.t === "error" && (
        <div>
          <p>Couldn't reach the weather service. Try again.</p>
          <button type="button" onClick={phase.retry}>Retry</button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Write `src/main.tsx`** (entry + ErrorBoundary + QueryClientProvider)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- App`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full suite (both tiers' cheap tier) + Rust**

Run: `npm test` and `cd src-tauri && cargo test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add simple-weather-desktop-app/src/components/QueryInput.tsx simple-weather-desktop-app/src/App.tsx simple-weather-desktop-app/src/main.tsx simple-weather-desktop-app/src/__tests__/App.test.tsx
git commit -m "feat(ui): App orchestration with five inline states + Selected Location flow"
```

---

## Task 12: Manual smoke + platform-matrix note

- [ ] **Step 1: Run the app**

Run: `npm run tauri dev`
Expected: window opens; typing "Springfield" → candidate list; picking one → Current Conditions (temp °C + icon + label); an unknown query → no-matches; offline → error + Retry.

- [ ] **Step 2: Platform matrix (Technical-Context)**

Run the Rust Tier-1 (`cargo test`) and the frontend suite (`npm test`) on Windows, macOS, and Linux CI runners. Run the Tier-2 ignored Rust test (`cargo test -- --ignored`) on a schedule against live Open-Meteo on each OS.

- [ ] **Step 3: Final commit (if any config changed)**

```bash
git add -A && git commit -m "test: confirm Feature 1 across platform matrix" || echo "nothing to commit"
```

---

## Self-review

**1. Spec coverage:** Query input + candidate list (T9, T11) · Selected Location + Current Conditions render temp+condition (T10, T11) · five states (T11) · networking in Rust (T3–T5) · least-privilege capabilities (T6) · logging (T5) · no stale fallback / no persistence — ADR-0001 untouched (T11 has no Store). All spec sections map to tasks. ✅

**2. Placeholder scan:** No TBD/TODO; every code step carries real code and exact commands. ✅

**3. Type consistency:** `LocationCandidate`/`CurrentConditions` identical across Rust (camelCase serde) and TS; `geocode`/`fetch_current` command names match between `lib.rs`, `commands.rs`, and `api.ts`; error envelope `{kind,message}` matches the TS `WeatherError`. ✅

**4. Seam coverage:**
- **Seam 1 (geocode command, cross-process I/O):** contract named in T5 + T7; proof = serialization test (T5: `location_candidate_serializes_null_region`) + frontend parse test (T7). ✅
- **Seam 2 (fetch_current command, cross-process I/O):** contract in T5 + T7 + T8; proof = T5 envelope/serialize + T7 parse + T8 icon-coverage over all WMO codes. ✅
- **Seam 3 (Open-Meteo geocoding, network-protocol external):** contract in T3; proof = T3 real-payload fixtures incl `results`-absent → `[]` and `admin1`-absent → `null`, plus the Tier-2 `#[ignore]` live test; authority = fixtures captured from the live API + docs page. ✅
- **Seam 4 (Open-Meteo forecast, network-protocol external):** contract in T4; proof = T4 real-payload fixture + live fetch; authority = captured live response + docs. ✅
- First-contact auth (no auth) is encoded by sending no credentials and asserted implicitly by the live tests succeeding. ✅

All four seams have a covering task naming the contract and a step writing the boundary-crossing test.
