# Roadmap

**Product:** Simple Weather App — a frontend-only web app that shows weather for a place you search.
**Last reviewed:** 2026-06-17

## Sequencing

Features are listed in delivery order. Each Feature gets its own `/brainstorming` session, Spec, and Plan.

---

## Feature 1: Find a place and see its weather 🔫 *tracer bullet*

The thinnest end-to-end slice that proves the whole pipe works. The user types a **Query**, the app shows candidate **Locations**, the user picks one, and the app fetches from Open-Meteo and renders one real piece of weather for the selected Location: the current temperature (°C) and its **Weather Condition** as a text label. This exercises every layer of the stack — Vite/React/TypeScript scaffold, styled-components, TanStack Query, the Geocoding module, a minimal Forecast module, and minimal Weather Condition mapping.

**Out of scope:** wind, the full Current Conditions panel, the Daily Forecast, weather *icons* (label-only for now), polished loading/empty/error states, and responsive/mobile layout. These are deferred to later Features.

**Dependencies:** None (this is the tracer bullet).

**Why first:** It is the smallest thing that forces the entire pipeline — query in, geocode, pick, fetch, render — to exist and work against the real Open-Meteo API, de-risking every Feature after it.

---

## Feature 2: Full Current Conditions

Flesh out the present-moment snapshot into the complete **Current Conditions** panel for the selected Location: temperature plus wind (km/h) and the **Weather Condition** shown as an icon alongside its label, presented as a proper styled panel rather than the bare tracer-bullet readout.

**Out of scope:** the Daily Forecast; loading/empty/error-state polish and responsive layout (Feature 4).

**Dependencies:** Feature 1 (specifically: the Geocoding flow, the selected Location, the Forecast module, and Weather Condition mapping — Feature 2 extends the Forecast module to surface wind and upgrades Weather Condition mapping to also return an icon).

---

## Feature 3: Daily Forecast

Add the **Daily Forecast** below the Current Conditions: a strip of **Forecast Days**, each showing its day label, high and low temperature (°C), and **Weather Condition** as an icon and label.

**Out of scope:** hourly forecast (out of scope product-wide); loading/empty/error-state polish and responsive layout (Feature 4).

**Dependencies:** Feature 1 (the Forecast module, which Feature 3 extends to return the daily series) and Feature 2 (the icon + presentation patterns established for Weather Conditions).

---

## Feature 4: Resilient, responsive experience

Make the whole app trustworthy and usable everywhere: inline loading states while fetching, a friendly empty/initial state before searching, a friendly "no matches" message when a Query resolves to zero Locations, plain-language error messages when a fetch fails, a React **Error Boundary** so one render error can't blank the page, and a layout that works on small screens.

**Out of scope:** any new weather data; persistence, geolocation, and unit toggles (all out of scope product-wide).

**Dependencies:** Features 1–3 (it hardens and makes responsive the search, Current Conditions, and Daily Forecast experiences they deliver).
