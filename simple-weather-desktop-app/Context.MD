# Simple Weather Desktop App

Domain glossary for a native desktop app that shows weather for a place the user looks up. This file is a glossary only — no implementation details.

## Language

**Location**:
A named geographic place — city, town, village, or district — identified by its coordinates (latitude/longitude). What the user ultimately gets weather for.
_Avoid_: City, Place, Spot

**Saved Location**:
A Location the user has explicitly chosen to keep, so they can return to it in a later session without re-entering a Query. Being saved is independent of being the Selected Location: any Location may be saved or not, the app does not auto-save looked-up Locations, and a Saved Location becomes the Selected Location when the user picks it.
_Avoid_: Favourite, Bookmark, Pinned place

**Selected Location**:
The one Location whose weather is currently on screen — a session state rather than a deliberately kept choice (unlike a Saved Location), though the app restores the last one on launch as a convenience. Orthogonal to being a Saved Location: the Selected Location may or may not also be saved.
_Avoid_: Active location, Current location, Chosen place

**Query**:
The free-text the user types to find a Location (e.g. "Paris", "Springfield"). Resolved into one or more candidate Locations.
_Avoid_: Search term, input

**Current Conditions**:
The weather at a Location right now — the present-moment snapshot the user sees first.
_Avoid_: Now, Current weather, Live weather

**Last Updated**:
The time at which the displayed Current Conditions were fetched from the provider, shown to the user so the freshness of the on-screen weather is honest. Current Conditions older than the user expects are stale until re-fetched.
_Avoid_: Timestamp, Fetched at, As of

**Daily Forecast**:
A short multi-day outlook for a Location, made up of one Forecast Day per day.
_Avoid_: Outlook, Prediction, Weekly weather

**Forecast Day**:
A single day's summary entry within a Daily Forecast (e.g. its high/low and overall conditions). Hour-by-hour detail is out of scope.
_Avoid_: Day, Forecast entry

**Weather Condition**:
The human-readable category of weather at a point in time — e.g. "Clear", "Partly cloudy", "Rain", "Snow" — shown as an icon and a label. Derived from the provider's numeric weather code (the code itself is an implementation detail, not domain language).
_Avoid_: Weather code, Weather type, Sky state

**Unit System**:
The user's chosen, persisted system for displaying weather values — Metric (°C, km/h) or Imperial (°F, mph). A display preference governing how numeric values are shown; it does not change the underlying weather or which Location is fetched.
_Avoid_: Units, Measurement system, Locale

## Relationships

- A **Query** resolves to zero or more candidate **Locations**
- The user picks one candidate, which becomes the **Selected Location**
- A user may explicitly keep a **Location** as a **Saved Location**; the app never auto-saves
- Picking a **Saved Location** makes it the **Selected Location**, skipping the **Query** step
- Being a **Saved Location** and being the **Selected Location** are independent: either, both, or neither can hold for a given **Location**
- Weather is fetched for exactly one **Selected Location** (by its coordinates)
- A **Location** has one set of **Current Conditions** and one **Daily Forecast**
- **Current Conditions** carries a **Last Updated** time recording when it was fetched
- A **Daily Forecast** is made up of one or more **Forecast Days**
- Both **Current Conditions** and a **Forecast Day** carry a **Weather Condition**
- All numeric weather values (in **Current Conditions** and each **Forecast Day**) are displayed in the user's chosen **Unit System**

## Example dialogue

> **Dev:** "If someone searches 'Springfield', which **Location** do we show weather for?"
> **Domain expert:** "We don't guess — the **Query** resolves to several candidate **Locations** and the user picks one. That picked one becomes the selected **Location**."
> **Dev:** "And if they come back tomorrow — do they search again?"
> **Domain expert:** "Only if they want a new place. If they kept it as a **Saved Location**, they pick it from their list and go straight to the weather — no **Query** needed."
> **Dev:** "Once they've picked, what do they see?"
> **Domain expert:** "The **Current Conditions** first, then a **Daily Forecast** — one **Forecast Day** per day. Both the now-snapshot and each day show a **Weather Condition** like 'Partly cloudy', as an icon and a label."

## Flagged ambiguities

- "City" was used for the thing being searched — resolved: the canonical term is **Location**, since towns, villages, and districts are all in scope, not just cities.
- "Favourite" / "Bookmark" were floated for the kept-place concept — resolved: the canonical term is **Saved Location**. The desktop app keeps these across sessions; the persistence mechanism is an implementation detail, not domain language.
- "Saved" vs "selected" were conflated — resolved: a **Saved Location** is an explicit, persisted choice; the **Selected Location** is the transient on-screen one. They are orthogonal, and the app never auto-saves a looked-up Location.
- The web app fixed units to Metric with no toggle — relaxed here: the desktop app has a persisted **Unit System** preference (Metric/Imperial). Auto-refresh and native notifications remain scope decisions for the PRD/Roadmap, not glossary terms, and are deliberately not named here yet.
