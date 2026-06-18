# PRD: Simple Weather Desktop App

## Problem Statement

A person who checks the weather every day wants a dedicated app that lives on their desktop — one they can open in a keystroke, that remembers the places they care about, shows the weather instantly even on a flaky connection, and speaks their preferred units. A browser tab doesn't cut it: it forgets everything between visits, goes blank the moment wifi hiccups, and makes them re-type a place name every time.

## Solution

A native desktop app (Tauri) where the user types a **Query** to find a **Location**, picks the right candidate, and sees that Location's **Current Conditions** followed by a short **Daily Forecast**. The user can keep places as **Saved Locations** to switch between without re-searching, and the app reopens on the **Selected Location** it last showed. Weather values render in the user's chosen **Unit System** (Metric or Imperial). The app shows the last-fetched weather immediately on launch and then revalidates, keeping a visible **Last Updated** time; if the network is down it degrades to clearly-flagged stale data rather than a blank screen. Weather and geocoding come from **Open-Meteo** (no API key), fetched from the Rust core — never directly from the webview.

## User Stories

1. As a user, I want to type a place name into a search box, so that I can look up weather for somewhere I care about.
2. As a user, I want the app to find places matching what I typed, so that I don't have to know exact coordinates.
3. As a user searching an ambiguous name (e.g. "Springfield"), I want a list of candidate Locations, so that I can choose the correct one.
4. As a user, I want each candidate to show enough context (name, region/country), so that I can tell similarly-named places apart.
5. As a user, I want to pick a candidate Location, so that it becomes the Selected Location and the app shows its weather.
6. As a user, I want to see the Current Conditions for my Selected Location first, so that I know what it's like outside right now.
7. As a user, I want the Current Conditions to show temperature, wind, and a Weather Condition (icon + label), so that I grasp the weather instantly.
8. As a user, I want a Daily Forecast after the Current Conditions, so that I can plan ahead.
9. As a user, I want each Forecast Day to show its day label, high/low, and Weather Condition, so that I can scan the coming days at a glance.
10. As a user, I want to save a Location I'm viewing, so that I can return to it later without searching again.
11. As a user, I want my Saved Locations kept across sessions, so that they're still there the next time I open the app.
12. As a user, I want to pick a Saved Location from a list, so that it becomes the Selected Location and skips the Query step.
13. As a user, I want to remove a Saved Location I no longer care about, so that my list stays relevant.
14. As a user, I want saving to be an explicit action, so that the app doesn't clutter my list with every place I glance at.
15. As a user, I want the app to reopen on the Location I last viewed, so that I pick up where I left off.
16. As a first-time user with nothing saved, I want a clear empty/initial state prompting me to search, so that I know what to do first.
17. As a user, I want to choose between Metric and Imperial units, so that weather reads naturally to me.
18. As a user, I want my Unit System remembered across sessions, so that I set it once.
19. As a user, I want every numeric weather value (current and forecast) shown in my chosen Unit System, so that the whole app is consistent.
20. As a user, I want a visible "Last Updated" time on the Current Conditions, so that I know how fresh the weather is.
21. As a user, I want the app to refresh the weather when I bring its window back into focus, so that what I see is current.
22. As a user, I want the weather to auto-refresh on an interval while I'm looking at it, so that I don't have to refresh manually.
23. As a user, I want a manual refresh control, so that I can force an update on demand.
24. As a user, I want auto-refresh to pause when the window isn't visible, so that the app isn't needlessly polling in the background.
25. As a returning user, I want last-known weather shown instantly on launch, then quietly refreshed, so that I never stare at a spinner before seeing anything.
26. As a user on a flaky or absent connection, I want the app to show the last-known weather flagged as stale (with its Last Updated time and a "couldn't update" note), so that the app stays useful offline.
27. As a user with no cached weather and no connection, I want a friendly error with a Retry action, so that I understand what went wrong and can try again.
28. As a user, I want a friendly message when my Query matches no Locations, so that I know to try a different spelling.
29. As a user, I want a loading state while a fetch is genuinely in flight (and no cache exists), so that I know the app is working.
30. As a user, I want the app to recover gracefully if something unexpected breaks, so that one error doesn't leave me with a blank window.
31. As a user, I want a Settings surface where I can change my Unit System and manage Saved Locations, so that I can adjust the app to my preferences.
32. As a user, I want the app to launch quickly and feel native, so that checking the weather is effortless.
33. As a privacy-conscious user, I want the app to not request my location or any permissions it doesn't need, so that I trust it.

## Implementation Decisions

**Architecture**
- Native desktop app built with **Tauri v2**: a **Rust core** plus a **React 19 / TypeScript (strict)** frontend in the system webview, bundled by **Vite 7**. Per `Technical-Context.MD`.
- **All Open-Meteo networking happens in the Rust core via `reqwest`**; the webview makes no direct external HTTP calls. The frontend talks to the core over the Tauri `invoke` command boundary — the app's primary integration **seam**. (Overriding Principle: networking lives in the Rust core.)
- **Least-privilege Tauri capabilities** — only the commands the frontend needs are exposed; no blanket fs/shell/http grants, and no geolocation permission (geolocation is out of scope).

**Weather & data (ADR-0001 — cache-and-revalidate)**
- The last-fetched **WeatherSnapshot** (Current Conditions + Daily Forecast) for the Selected Location is persisted with its **Last Updated** time. On launch and on window-focus the app **shows the cached snapshot immediately, then revalidates** with a background fetch — first paint never blocks on the network.
- On revalidation failure with a cache present, the app keeps showing the stale snapshot, flagged by Last Updated plus a non-alarming "couldn't update" note. With no cache, a friendly error owns the screen with a Retry action.
- Auto-refresh runs on an interval **only while the window is focused/visible**; a manual refresh is always available.

**Modules** (confirmed with developer)
- **`WeatherProvider`** (Rust, deep) — `geocode(query) → [Location]` and `fetch_weather(coords, unit_system) → WeatherSnapshot`. Encapsulates reqwest, URL/param shaping, weather-code → **Weather Condition** mapping, and error normalisation into a typed error.
- **`Store`** (Rust, deep) — load/save of Saved Locations, last-Selected Location, the cached WeatherSnapshot (+ Last Updated), and the Unit System. Single source of truth for persisted state, over serde + the app's data dir.
- **Command layer** (Rust, shallow) — thin `invoke` adapters over the two modules, mapping domain errors to a typed envelope the frontend can render as friendly copy.
- **`formatting`** (frontend, deep, pure) — formats raw numeric values into the chosen Unit System (°C/°F, km·h/mph) and renders Last Updated for display. No side effects.
- **`weatherState`** (frontend, deep) — the cache-then-revalidate / staleness state machine over react-query + `invoke`: cached → revalidating → fresh, and cached → stale-flagged on failure.
- **UI components** (frontend, shallow) — Query input, candidate list, Current Conditions panel, Daily Forecast strip, Saved Locations list, Settings (Unit System), stale banner, and error/empty/loading states wrapped by a React Error Boundary.

**Units**
- A persisted **Unit System** preference (Metric: °C, km/h · Imperial: °F, mph), applied to all displayed values. Not a per-quantity mix. Relaxes the web app's fixed-Metric scope cut.

**Instrumentation**
- Frontend: React Error Boundary + `console.error` on failed `invoke` calls / caught exceptions. Rust: structured logging via `tauri-plugin-log` — always log outbound Open-Meteo requests and their failures, plus command errors.

## Testing Decisions

**What makes a good test here:** assert on observable behaviour and the deterministic envelope across the `invoke` seam — the typed command payload shape, the cache→revalidate→stale state transitions, and formatted output — never on Open-Meteo's exact response text or transient fields. Per `Technical-Context.MD`, every seam gets a real-IO test on at least one side; treat Open-Meteo as the nondeterministic source (replay recorded fixtures at Tier 1, hit live at Tier 2/3).

Modules the developer chose to test (all four):
- **`WeatherProvider` (Rust)** — the Open-Meteo seam. Cover geocode + weather fetch, weather-code → Weather Condition mapping, and error normalisation. Real-IO: replayed fixtures at Tier 1, live Open-Meteo at Tier 2/3. This is the seam, so it carries the real-IO test.
- **`Store` (Rust)** — real local-IO round-trip: Saved Locations, last-Selected, cached WeatherSnapshot + Last Updated, and Unit System persist and reload faithfully.
- **`formatting` (frontend)** — pure unit tests over Metric/Imperial conversion and boundary values, plus Last Updated rendering. Cheap and high-value.
- **`weatherState` (frontend)** — behavioural tests of the cache-then-revalidate machine: shows cache first, revalidates on restore/focus, degrades to stale-flagged on failure, surfaces error+Retry when no cache exists (the ADR-0001 contract).

**Platform matrix:** Tauri is OS-touching — `WeatherProvider` and `Store` tests run Tier 1 + Tier 2 on every OS the app ships to (Windows / macOS / Linux), not just the dev box's. **Prior art:** the existing web app's `vitest` + Testing Library setup is the reference for the frontend tier.

## Out of Scope

- **OS geolocation / auto-detect location** — deferred; no location permission is requested in this version.
- **Native OS notifications / weather alerts** — deferred to a later Feature.
- **System-tray / menubar-resident mode** — v1 is a normal application window; tray lifecycle is a later decision (it would change the Tauri capability set).
- **Hour-by-hour forecast** — only the Daily Forecast (one Forecast Day per day) is in scope, matching the domain glossary.
- **Per-quantity unit mixing, additional unit systems, or locale/number-format localisation** beyond the Metric/Imperial Unit System.
- **Accounts, sync, or cross-device persistence** — all state is local to the install.
- **A designated "home"/default Location concept** — startup restores the last Selected Location instead.

## Further Notes

- The number of Forecast Days shown and the exact auto-refresh interval are tuning details to settle during `/roadmap` → `/brainstorming`, not architectural decisions.
- Open-Meteo requires no API key today; if a keyed provider is ever added, the key lives in the Rust core (never the webview bundle), per `Technical-Context.MD`.
- Vocabulary throughout follows `Context.MD` (Location, Saved Location, Selected Location, Query, Current Conditions, Daily Forecast, Forecast Day, Weather Condition, Unit System, Last Updated). The caching stance is recorded in `docs/adr/0001-cache-and-revalidate-weather.md`.

> GitHub Issue: https://github.com/crdev317/Simple-Weather-App/issues/15
