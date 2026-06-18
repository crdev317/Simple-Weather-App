# Simple Weather Desktop App

Domain glossary for a native desktop app that shows weather for a place the user looks up. This file is a glossary only — no implementation details.

## Language

**Location**:
A named geographic place — city, town, village, or district — identified by its coordinates (latitude/longitude). What the user ultimately gets weather for.
_Avoid_: City, Place, Spot

**Saved Location**:
A Location the user has pinned to return to directly in a later session, without re-entering a Query. Distinct from the transient selected Location (which comes from a Query in the current session): a Saved Location persists across sessions and is chosen from the user's own kept list.
_Avoid_: Favourite, Bookmark, Pinned place

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
- A user may keep a **Location** as a **Saved Location**; selecting a Saved Location skips the **Query** step and fetches weather directly
- Weather is fetched for exactly one selected **Location** (by its coordinates)
- A **Location** has one set of **Current Conditions** and one **Daily Forecast**
- A **Daily Forecast** is made up of one or more **Forecast Days**
- Both **Current Conditions** and a **Forecast Day** carry a **Weather Condition**

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
- Units (Metric vs Imperial), auto-refresh, and native notifications are scope decisions for the PRD/Roadmap, not glossary terms — they are deliberately not named here yet.
