# Simple Weather App

Domain glossary for a frontend-only app that shows weather for a place the user looks up. This file is a glossary only — no implementation details.

## Language

**Location**:
A named geographic place — city, town, village, or district — identified by its coordinates (latitude/longitude). What the user ultimately gets weather for.
_Avoid_: City, Place, Spot

**Query**:
The free-text the user types to find a Location (e.g. "Paris", "Springfield"). Resolved into one or more candidate Locations.
_Avoid_: Search term, input

**Current Conditions**:
The weather at a Location right now — the present-moment snapshot the user sees first.
_Avoid_: Now, Current weather, Live weather

**Daily Forecast**:
A short multi-day outlook for a Location, made up of one Forecast Day per day.
_Avoid_: Outlook, Prediction, Weekly weather

**Forecast Day**:
A single day's summary entry within a Daily Forecast (e.g. its high/low and overall conditions). Hour-by-hour detail is out of scope.
_Avoid_: Day, Forecast entry

**Weather Condition**:
The human-readable category of weather at a point in time — e.g. "Clear", "Partly cloudy", "Rain", "Snow" — shown as an icon and a label. Derived from the provider's numeric weather code (the code itself is an implementation detail, not domain language).
_Avoid_: Weather code, Weather type, Sky state

## Relationships

- A **Query** resolves to zero or more candidate **Locations**
- The user picks one candidate, which becomes the selected **Location**
- Weather is fetched for exactly one selected **Location** (by its coordinates)
- A **Location** has one set of **Current Conditions** and one **Daily Forecast**
- A **Daily Forecast** is made up of one or more **Forecast Days**
- Both **Current Conditions** and a **Forecast Day** carry a **Weather Condition**

## Example dialogue

> **Dev:** "If someone searches 'Springfield', which **Location** do we show weather for?"
> **Domain expert:** "We don't guess — the **Query** resolves to several candidate **Locations** and the user picks one. That picked one becomes the selected **Location**."
> **Dev:** "And once they've picked, what do they see?"
> **Domain expert:** "The **Current Conditions** first, then a **Daily Forecast** — one **Forecast Day** per day. Both the now-snapshot and each day show a **Weather Condition** like 'Partly cloudy', as an icon and a label."

## Flagged ambiguities

- "City" was used for the thing being searched — resolved: the canonical term is **Location**, since towns, villages, and districts are all in scope, not just cities.
- "Fixed units" was stated alongside "go with your recommendation" (a unit toggle) — resolved: units are **fixed to Metric** (°C, km/h), no toggle. This is a scope/implementation decision, so it lives in the spec, not this glossary.
