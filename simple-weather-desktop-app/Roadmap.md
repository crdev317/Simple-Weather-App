# Roadmap

**Product:** Simple Weather Desktop App — a native Tauri desktop app for daily weather lookup, with saved places, units, and offline-tolerant caching.
**Last reviewed:** 2026-06-18

## Sequencing

Features are listed in delivery order. Each Feature gets its own `/brainstorming` session, Spec, and Plan.

Dependency spine: 1 → 2 → 3 → {4, 6}, with 5 depending on 1–3. Feature 3 is the keystone — it introduces the Rust `Store` and the frontend `weatherState` machine that Features 4 and 6 build on.

---

## Feature 1: Look up a place and see its current weather 🔫 *tracer bullet*

The user types a **Query**, the app geocodes it via the Rust `WeatherProvider` (Open-Meteo) over a Tauri command, resolves a **Location**, fetches its **Current Conditions**, and renders temperature + **Weather Condition** (icon + label) in the webview. This pierces every layer — React UI → `invoke` seam → Rust core → Open-Meteo → back — and puts working weather on screen.

**Out of scope:** Daily Forecast; Saved Locations; last-Selected restore; Unit System (fixed Metric for now); caching / offline / Last Updated; refresh; Settings. Candidate-disambiguation UI kept minimal.

**Dependencies:** None (this is the tracer bullet).

**Why first:** Typing a place and seeing its weather is the thinnest genuinely user-facing slice, and it proves the two hardest seam operations — geocode and weather fetch — at once.

---

## Feature 2: See the multi-day Daily Forecast

After the **Current Conditions**, the user sees a **Daily Forecast** — a strip of **Forecast Days**, each with its day label, high/low, and **Weather Condition** (icon + label). The `WeatherProvider.fetch_weather` call already returns a full **WeatherSnapshot**, so this widens that fetch and adds the forecast UI; no new seam.

**Out of scope:** Hour-by-hour detail (daily only); Saved Locations; persistence / caching; units (still Metric); refresh; Settings.

**Dependencies:** Feature 1 (extends its `WeatherProvider` fetch and Current Conditions render — same fetch pipeline).

**Why second:** It completes the core read-only "what's the weather here" view with the smallest possible addition to Feature 1, before any persistence or preferences.

---

## Feature 3: Instant restart with cached weather (offline-tolerant)

The first Feature that needs persistence, so it introduces the Rust `Store`. It implements ADR-0001 end-to-end: persist the last **Selected Location** and its last-fetched **WeatherSnapshot** with a **Last Updated** time; on launch, show the cached snapshot immediately, then revalidate in the background. On a failed revalidation with a cache present, keep showing the stale snapshot flagged by Last Updated plus a "couldn't update" note; with no cache, show the friendly error + Retry. Introduces the frontend `weatherState` cache-then-revalidate state machine.

**Out of scope:** Saved Locations (a *list* of kept places — this persists only the single last-Selected one); Unit System; auto-refresh on an interval / focus (manual revalidate-on-launch only here); Settings surface.

**Dependencies:** Features 1 & 2 (persists and re-displays the `WeatherSnapshot` they produce). Introduces `Store` + `weatherState`, which Features 4 and 6 build on.

**Why third:** Both this and Saved Locations need the `Store`; ADR-0001's offline/stale behaviour is the riskiest, most architectural slice and is worth establishing once — so Saved Locations later just adds a list on top of an existing persistence layer.

---

## Feature 4: Save and switch between favourite places

Adds **Saved Locations** on top of the existing `Store`. The user can explicitly save the Location they're viewing, see their Saved Locations in a list, pick one to make it the **Selected Location** (skipping the **Query** step), and remove ones they no longer want. The list persists across sessions. No auto-save.

**Out of scope:** Unit System / Settings surface; refresh behaviour; reordering or renaming Saved Locations (add / pick / remove only); any "home/default" Location concept (startup still restores last-Selected from Feature 3).

**Dependencies:** Feature 3 (extends its `Store`; reuses last-Selected restore and the `weatherState` / fetch pipeline when a Saved Location is picked).

**Why fourth:** With persistence and the offline contract already established, Saved Locations is purely additive — a persisted list plus the UI to manage it and switch the Selected Location.

---

## Feature 5: Choose your units (Metric / Imperial) in Settings

Introduces the **Settings** surface and the persisted **Unit System** preference. The user picks Metric (°C, km/h) or Imperial (°F, mph); the choice is saved in the `Store` and applied to all numeric weather values (Current Conditions and every Forecast Day) via the pure frontend `formatting` module. Settings is also the natural home for the Saved-Location management surfaced in Feature 4.

**Out of scope:** Per-quantity unit mixing or extra unit systems; locale / number-format localisation; refresh behaviour; non-unit settings beyond what Features 4–5 introduce.

**Dependencies:** Features 1–2 (the values being formatted) and Feature 3 (`Store` persists the preference). Introduces `formatting` as a tested deep module.

**Why fifth:** Units is a cross-cutting display preference best layered once all the values it formats already exist on screen, and it brings the Settings surface the product needs.

---

## Feature 6: Keep the weather fresh — manual and auto-refresh

Completes the freshness story. Adds an explicit manual refresh control plus auto-refresh on an interval that runs only while the window is focused/visible, and a re-fetch on window-focus when the displayed weather is older than a threshold. Each successful fetch updates **Last Updated**; failures fall back to the stale-flagged behaviour from Feature 3.

**Out of scope:** Background/headless polling while hidden (explicitly excluded); native notifications / alerts; tray-resident behaviour; a user-configurable interval in Settings (the interval is a fixed tuning value).

**Dependencies:** Feature 3 (extends `weatherState` and the Last Updated / revalidate machinery; reuses the offline fallback).

**Why last:** Auto-refresh is a refinement on top of the settled cache-then-revalidate engine — it needs Last Updated, the fetch pipeline, and the offline contract all in place.
