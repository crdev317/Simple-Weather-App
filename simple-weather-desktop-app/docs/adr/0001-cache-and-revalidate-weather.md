# Cache the last-fetched weather and revalidate; degrade to stale, never to blank

## Context

This is a long-lived desktop app launched on unreliable networks (flaky wifi, planes, captive portals), unlike a web tab. We need a first-paint and a network-failure story.

## Decision

We persist the last-fetched weather (Current Conditions + Daily Forecast) for the Selected Location, alongside the Selected Location identity and preferences. On launch and on window-focus we **show the cached weather immediately, then revalidate** with a background fetch — first paint never blocks on the network. When revalidation fails and a cache exists, we keep showing the stale data flagged by its **Last Updated** timestamp plus a non-alarming "couldn't update" note. Only when there is no cache at all (first launch, or a Query that has never succeeded) does an error own the screen, with a friendly message and a Retry action.

## Considered options

- **Always-fresh / block-on-fetch** — show nothing until a live fetch succeeds. Rejected: a desktop app that goes blank the moment wifi hiccups feels broken, and it makes every launch hostage to network latency.
- **Cache-and-revalidate, degrade to stale (chosen)** — honest staleness via Last Updated, instant restart, graceful offline.

## Consequences

- The persistence layer stores more than identity: it caches weather payloads, which must carry their fetch time (Last Updated) to keep displayed staleness honest.
- The Tauri command seam has a real behavioural contract worth testing: cached-then-revalidate on restore/focus, and stale-with-flag on fetch failure.
- "Current Conditions can be displayed while stale" is now a deliberate, supported state (see `Context.MD` → Last Updated), not an edge case.
