# PRD: Simple Weather App

## Problem Statement

A person wants to know the weather for a place they care about — right now and over the next several days — without installing an app, creating an account, or wading through ads and clutter. They just want to type a place name and see clear, trustworthy weather.

## Solution

A fast, frontend-only web app where the user types a **Query** (a place name), picks the right match from a list of candidate **Locations**, and immediately sees that Location's **Current Conditions** followed by a short **Daily Forecast**. No sign-up, no settings to configure — open it, search, done. Weather data comes from Open-Meteo, which needs no API key.

## User Stories

1. As a visitor, I want to type a place name into a search box, so that I can look up weather for somewhere I care about.
2. As a visitor, I want the app to find places matching what I typed, so that I don't have to know exact coordinates.
3. As a visitor searching an ambiguous name (e.g. "Springfield"), I want to see a list of candidate Locations, so that I can choose the correct one.
4. As a visitor, I want each candidate to show enough context (name, region/country), so that I can tell similarly-named places apart.
5. As a visitor, I want to pick a candidate Location, so that the app shows weather for exactly the place I meant.
6. As a visitor, I want to see the Current Conditions for my selected Location first, so that I know what it's like outside right now.
7. As a visitor, I want the Current Conditions to show the temperature in °C, so that I can interpret it at a glance.
8. As a visitor, I want the Current Conditions to show the Weather Condition as an icon and a label (e.g. "Partly cloudy"), so that I grasp the weather instantly.
9. As a visitor, I want the Current Conditions to include wind in km/h, so that I have a fuller picture of conditions.
10. As a visitor, I want to see a Daily Forecast for the coming days after the Current Conditions, so that I can plan ahead.
11. As a visitor, I want each Forecast Day to show its date/day label, so that I know which day I'm looking at.
12. As a visitor, I want each Forecast Day to show a high and low temperature in °C, so that I understand the day's range.
13. As a visitor, I want each Forecast Day to show its Weather Condition as an icon and label, so that I can scan the week at a glance.
14. As a visitor, I want a visible loading state while the app fetches results, so that I know it's working.
15. As a visitor, I want a friendly message when my Query matches no Locations, so that I know to try a different spelling.
16. As a visitor, I want a friendly, plain-language error message when weather can't be fetched, so that I'm not staring at a blank or broken screen.
17. As a visitor, I want the app to recover gracefully if something unexpected breaks, so that one error doesn't take down the whole page.
18. As a visitor, I want an empty/initial state before I search, so that I understand what to do first.
19. As a visitor on a phone, I want the layout to work on a small screen, so that I can check weather on the go.
20. As a visitor, I want the app to load quickly, so that checking the weather feels effortless.

## Implementation Decisions

**Architecture**
- Frontend-only React SPA (React 19) built with Vite 7; TypeScript with strict mode. No backend — the browser calls Open-Meteo directly. (Per `Technical-Context.MD`.)
- Weather and geocoding data from **Open-Meteo** (no API key, no auth).
- Data fetching and server-state (caching, loading/error states) via **TanStack Query** over the native `fetch` API. Styling via **styled-components**.
- Units are **fixed to Metric** (°C, km/h) — no unit toggle.
- No persistence (no favourites, no recent searches) and no geolocation — both out of scope.

**Deep modules (logic, testable in isolation)**
- **Geocoding** — interface: `Query → candidate Location[]`. Calls Open-Meteo geocoding; maps raw results into `Location` objects (display name, region/country context, latitude, longitude). Returns an empty list for no matches.
- **Forecast** — interface: `Location coordinates → { currentConditions, dailyForecast }`. Calls Open-Meteo forecast; maps the raw response into domain shapes: `Current Conditions` (temperature, wind, Weather Condition) and a `Daily Forecast` of `Forecast Day` entries (date, high, low, Weather Condition).
- **Weather Condition mapping** — interface: `weatherCode → { label, icon }`. Pure, no I/O. Maps WMO weather codes to a human label and an icon. The numeric code stays an implementation detail; the domain only sees `Weather Condition`.
- **Formatting** — pure metric formatters: temperature (°C), wind (km/h), and Forecast Day date/day labels.

**Thin UI components (presentational shells over the modules)**
- Search input (captures the Query), candidate-list picker (renders candidate Locations, emits the selected Location), current-conditions panel, daily-forecast strip, plus inline loading/empty/error states and a React **Error Boundary** wrapping the app.

**Domain vocabulary** — all code and UI copy use the canonical terms from `Context.MD`: Location, Query, Current Conditions, Daily Forecast, Forecast Day, Weather Condition. Avoid "City", "weather code", etc. in domain-facing names.

## Testing Decisions

**What makes a good test here:** tests assert *external behaviour* through a module's public interface, not its internals. For the data modules, that means: given a representative raw Open-Meteo response (mocked at the `fetch` boundary), the module returns the correct domain objects — including edge cases like zero geocoding results. For the pure modules, that means: given an input, the function returns the expected output. Tests must not assert on private helpers, internal call order, or DOM structure.

**Modules to be tested** (confirmed):
- **Weather Condition mapping** — known WMO codes map to the right label/icon; an unknown/edge code falls back sensibly.
- **Formatting** — temperature, wind, and day-label formatters produce correct metric strings, including boundary values (e.g. negative temperatures, zero wind).
- **Geocoding** — a representative geocoding response maps to the right candidate `Location[]`; a no-match response yields an empty list.
- **Forecast** — a representative forecast response maps to the right `Current Conditions` and `Daily Forecast` (correct number of Forecast Days, correct fields).

**Tooling:** Vitest + Testing Library (per `Technical-Context.MD`). The data modules are tested with `fetch` mocked so no live network calls occur. UI components are **not** unit-tested in this PRD.

**Prior art:** none yet — this is a greenfield repo. These tests establish the prior art (the mocked-`fetch` pattern for the data modules, and plain input/output assertions for the pure modules) that later features should follow.

## Out of Scope

- Unit toggle (imperial / metric switching) — units are fixed to Metric.
- Hourly forecast — only Current Conditions and a Daily Forecast are in scope.
- Persistence of any kind — no saved/favourite Locations, no recent-searches history.
- Browser geolocation / "use my current location".
- User accounts, authentication, settings, or theming.
- A backend, server-side rendering, or any API-key-bearing weather provider.
- Maps, radar, severe-weather alerts, air quality, and other advanced weather data.
- Unit tests for UI components.

## Further Notes

- Open-Meteo requires no API key, so the `Technical-Context.MD` "secrets via env var" principle stays dormant — it only binds if a keyed provider is ever introduced.
- Because the app is frontend-only and stateless, a deployment target hasn't been chosen yet (production is TBD in `Technical-Context.MD`); local `vite` dev is the current environment.
- The four deep modules are deliberately isolated from React so they can be tested without rendering and reused if the UI changes.

> GitHub Issue: https://github.com/crdev317/Simple-Weather-App/issues/1
