# AETHERA — Product Specification

**Product:** AETHERA  
**Tagline:** Live Airspace Intelligence  
**Status:** Initial Product Definition  
**Version:** 1.0  
**Last Updated:** 2026-08-26

---

## 1. Product Overview

AETHERA is a premium real-time airspace visualization and intelligence web application.

It transforms live aircraft observation data into an elegant, interactive experience where users can:

- Explore aircraft currently observed in the airspace.
- Inspect individual aircraft and their telemetry.
- Follow aircraft in real time.
- Visualize flight trails and altitude.
- Detect and surface unusual aircraft states or telemetry patterns.
- Explore traffic patterns.
- Inspect airports and surrounding traffic.
- Replay historical airspace activity as historical data becomes available.
- Understand the airspace through visualization, telemetry, alerts, and analytics.

AETHERA is **not intended to claim complete worldwide aircraft coverage**. It presents aircraft and states that are observable through its configured data sources.

The core product principle is:

> **Make complex airspace data feel simple, fast, precise, and beautiful.**

---

## 2. Product Positioning

AETHERA should not feel like a generic flight tracker.

Traditional flight trackers primarily answer:

> "Where is this aircraft?"

AETHERA should answer:

> "What is happening in the airspace right now?"

This distinction should influence the entire product.

AETHERA combines:

- Live visualization
- Telemetry
- Spatial analysis
- Anomaly detection
- Historical exploration
- 3D visualization

The application should feel closer to a **professional intelligence and visualization platform** than a consumer map application.

---

## 3. Brand

### Name

**AETHERA**

### Tagline

**Live Airspace Intelligence**

### Brand Character

AETHERA should communicate:

- Precision
- Intelligence
- Technology
- Calmness
- Trust
- Professionalism
- Aviation
- Real-time awareness

Avoid a playful or gaming-oriented identity.

The interface should feel appropriate for:

- Aviation enthusiasts
- Developers
- Data visualization enthusiasts
- Researchers
- Students
- Journalists
- Analysts
- Aviation professionals
- Technology portfolios

---

## 4. Product Principles

### 4.1 Visualization First

The map is the primary product surface.

The UI should support the map rather than compete with it.

### 4.2 Progressive Disclosure

Do not display every piece of information at once.

Show:

1. The airspace
2. The aircraft
3. Relevant telemetry
4. Detailed information on interaction

### 4.3 Real-Time by Default

The application should clearly communicate that its data is live.

Use:

- Live indicators
- Update timestamps
- Smooth aircraft movement
- Real-time counters
- Live alert updates

### 4.4 Data Transparency

AETHERA must distinguish between:

- Observed data
- Derived data
- Estimated/interpolated data
- Detected anomalies
- External metadata

The product must never present an inference as an established fact.

### 4.5 Performance Is a Feature

Large numbers of aircraft should remain visually smooth.

The application should be designed around:

- Efficient rendering
- WebSocket updates
- Client-side interpolation
- Spatial filtering
- Data aggregation
- Efficient state management

### 4.6 Premium Simplicity

The interface should contain substantial functionality without looking complicated.

---

## 5. Target Experience

When a user opens AETHERA, the first impression should be:

> "This looks like a professional system for understanding the world's airspace."

The user should immediately understand:

- The system is live.
- Aircraft are being observed.
- The map is interactive.
- The application contains more than simple aircraft locations.

The experience should be fast enough that users can start exploring without reading documentation.

---

## 6. Core Application Structure

The initial application should contain:

```text
AETHERA
│
├── Explore
│   └── Live airspace map
│
├── Alerts
│   └── Detected unusual conditions
│
├── Airports
│   └── Airport traffic views
│
├── Analytics
│   └── Airspace statistics and patterns
│
└── History
    └── Historical/replay experience
```

These areas share a persistent chrome:

- Product identity
- Search
- Live status
- Observed aircraft count
- Access to filters, layers, and settings

Explore is the default destination. All other areas should return the user to the map with context preserved whenever possible.

---

## 7. Target Users

AETHERA is a public exploration product, not an operational air-traffic control system.

Primary users:

| User | What they want |
| ---- | -------------- |
| Aviation enthusiast | Watch live traffic, follow a flight, inspect telemetry |
| Data visualization enthusiast | Experience a dense, beautiful live dataset |
| Developer / portfolio visitor | Evaluate craft, architecture, and product quality |
| Student / researcher | Understand airspace patterns and observable states |
| Journalist / analyst | Inspect unusual activity with cautious, sourced language |
| Aviation-adjacent professional | Quickly read traffic around an airport or region |

AETHERA should be immediately usable by a first-time visitor and still reward a power user who stays.

It should not assume the user is a licensed controller, dispatcher, or airline operator.

---

## 8. Jobs To Be Done

Users come to AETHERA to:

1. See what is in the air right now.
2. Find a specific aircraft, callsign, or airport.
3. Understand an aircraft's current state.
4. Follow an aircraft as it moves.
5. Notice unusual conditions without hunting for them.
6. Read traffic around an airport.
7. See where the airspace is dense.
8. Replay what happened, once history exists.

Every feature should serve at least one of these jobs.

If a feature does not help the user understand live airspace, it should not ship.

---

## 9. Primary User Journeys

### 9.1 Open and Orient

The user opens AETHERA.

Within a few seconds they should see:

- A dark live map
- Aircraft moving
- A live indicator
- An observed-aircraft count
- A way to search

They should not need to sign in, complete onboarding, or read a tutorial.

### 9.2 Discover an Aircraft

The user pans or zooms, notices an aircraft, and hovers.

They see a compact preview:

```text
LH123
36,250 FT · 482 KT
```

They click. The map focuses. A detail panel opens. The aircraft remains visible.

### 9.3 Find a Specific Flight

The user opens search, types a callsign, registration, ICAO24, or airport, and selects a result.

The map flies to the target. If it is an aircraft, it becomes selected. If it is an airport, surrounding traffic becomes the focus.

### 9.4 Follow a Flight

The user selects an aircraft and chooses Follow.

The camera stays with the aircraft. Telemetry remains visible. The user can exit follow at any time.

### 9.5 Investigate an Alert

The user opens Alerts, selects an item, and is taken to the corresponding aircraft.

The product states what was observed, when it was observed, and that the condition is detected — not confirmed as an incident.

### 9.6 Inspect Airport Traffic

The user opens an airport and sees nearby observed traffic, basic airport identity, and a way back to the wider airspace.

---

## 10. Explore — Live Airspace

Explore is the core product.

It is a live geospatial view of currently observed aircraft.

### 10.1 Default View

On first load, AETHERA should present a meaningful live airspace rather than an empty ocean or a fully zoomed-out unreadable globe.

Recommended default:

- A populated region with active traffic
- 2D or gentle 3D, depending on device capability
- No aircraft pre-selected
- Search, live status, and stats visible

The user may later persist last camera position as a preference.

### 10.2 Map Responsibilities

The map must support:

- Pan
- Zoom
- Rotate / pitch where 3D is available
- Hover
- Select
- Touch and mouse
- Keyboard-accessible controls

The map is the workspace. Panels, stats, and controls are supporting surfaces.

### 10.3 What Is Shown

At any moment the Explore view may show:

- Observed aircraft
- Selected aircraft emphasis
- Optional trail for the selected or followed aircraft
- Airport markers at appropriate zoom
- Alert emphasis on affected aircraft
- Live statistics

It should not show:

- Decorative widgets that cover the map
- Permanent multi-card dashboards
- Unsolicited marketing copy
- Claims of complete global coverage

### 10.4 Zoom-Dependent Detail

Information density must change with zoom.

**World view**

- Aircraft icon
- Heading
- Alert state if present

**Regional view**

- Aircraft
- Callsign when available
- Altitude
- Optional short trail

**Close view**

- Callsign / identity
- Altitude
- Speed
- Heading
- Vertical rate when selected
- Trail
- Nearby airports

Labels must not collide into unreadability. When density is high, labels recede and selection/hover remains the path to detail.

### 10.5 Viewport Scope

The product shows aircraft in the current viewport, not necessarily every observed aircraft on Earth at once.

A global observed count may still be displayed in the statistics bar.

This is a product requirement as well as a performance requirement: the user should feel they are looking at *this* airspace.

---

## 11. Aircraft Visualization

Each aircraft is a live object in space, not a static pin.

### 11.1 Marker Meaning

A marker should communicate:

- Position
- Heading, when available
- Airborne vs on-ground, when known
- Selection
- Follow
- Alert
- Stale / lost contact

The icon should rotate with heading when heading is available.

### 11.2 Movement

Aircraft should move smoothly between observed positions.

The user should perceive continuous flight, not discrete jumps, unless the data gap is large enough that interpolation would be misleading.

When interpolation is used, it is **estimated motion**, not a new observation.

If contact is lost, the aircraft should not continue flying indefinitely as if still observed.

### 11.3 Marker States

| State | Meaning |
| ----- | ------- |
| Default | Observed, not interacting |
| Hover | Discovery preview |
| Selected | Detail panel open, visual emphasis |
| Followed | Camera tracking this aircraft |
| Alert | A detected condition is active |
| Stale | Last observation is older than the live threshold |
| Removed | No longer observed; leave the scene after a short grace period |

Selected and alert states must remain distinguishable in dense traffic.

### 11.4 Ground vs Airborne

When `onGround` is known, ground traffic should be visually quieter than airborne traffic.

Ground aircraft may be hidden behind a filter. They should not dominate a regional airborne view.

---

## 12. Aircraft Inspection

Selecting an aircraft is the primary way to go deeper.

### 12.1 Hover vs Select

Hover is for discovery.

Select is for commitment.

Hover must not open the full detail panel.

### 12.2 Detail Panel

The detail panel is telemetry-first.

Primary fields:

- Callsign or best available identity
- Airline / aircraft type when available
- Status (airborne, on ground, stale)
- Altitude
- Speed
- Heading
- Vertical rate

Secondary fields:

- ICAO24
- Registration when available
- Squawk
- Latitude / longitude
- Last contact
- Data source
- Origin / destination when available

Actions:

- Follow
- Show / hide trail
- Focus / recenter
- Close

The panel must not bury altitude, speed, and heading below metadata.

### 12.3 Missing Fields

Aviation data is incomplete.

If a field is unavailable, show that it is unavailable. Do not invent a value.

Preferred language:

- `—`
- `UNAVAILABLE`
- `UNKNOWN`

Not:

- `0 FT` when altitude was not observed
- `N/A` without context on primary telemetry

### 12.4 Selection Persistence

An aircraft stays selected until the user:

- Selects another aircraft
- Closes the panel
- Or the aircraft has been unobserved longer than a configured grace period

If the selected aircraft leaves the viewport, the panel remains; a recenter action should still work.

---

## 13. Follow Mode

Follow mode creates a focused live experience around one aircraft.

While following:

- The camera stays with the aircraft
- Telemetry remains visible
- The followed aircraft stays visually distinct
- An obvious **Exit Follow** control is always available

Follow must never trap the user.

Exiting follow restores a normal Explore camera around the last position.

Follow is available from:

- The aircraft detail panel
- Keyboard shortcut when an aircraft is selected

If the followed aircraft is lost, the product should say so and exit or pause follow rather than tracking a ghost.

---

## 14. Flight Trails

Trails show recent movement.

They are optional, selected-aircraft-first, and never the default for every aircraft on screen.

### 14.1 Live Trail

A live trail is the recent observed/interpolated path of the current aircraft.

Requirements:

- Newer path is more visible than older path
- Length is limited
- Trails must not obscure other aircraft
- Trails can be toggled per aircraft

### 14.2 Historical Trail

A longer historical path may be loaded on demand once historical storage exists.

Historical trails must be labeled as historical, not as the live path.

### 14.3 Default Behavior

MVP:

- No trails for the full fleet
- Trail available for the selected or followed aircraft

Later:

- Trails for a small set of watched aircraft
- Historical path on request

---

## 15. Altitude and 3D

Altitude is a first-class dimension of the product.

### 15.1 Modes

The map should support:

- **2D** — classic chart view
- **3D airspace** — altitude as height above the map
- **3D terrain** — geographic relief, when available, without hiding aircraft

Switching modes must preserve:

- Geographic location
- Selected aircraft
- Active filters
- Relevant layers

The 2D / 3D control must be easy to find.

### 15.2 Encoding Altitude

Altitude may be shown through:

- Actual 3D height
- Numeric labels
- Optional altitude layer

Color must not be the only altitude encoding.

### 15.3 Capability Fallback

If a device cannot sustain 3D, AETHERA should fall back to 2D rather than stutter.

The product is still valid in 2D. 3D is a defining capability, not a requirement for basic use.

---

## 16. Search

Search is one of the most important interactions after the map itself.

### 16.1 Access

Search should be available from the header and via:

- `⌘ K` on macOS
- `Ctrl K` elsewhere

It should feel instant.

### 16.2 Search Targets

Users should be able to search for:

- Callsign
- Flight number
- ICAO24
- Registration, when available
- Airport
- Airline, when available
- Aircraft type, when available

Later, search may also run commands:

- Toggle 3D
- Go to a region
- Open Alerts
- Apply a filter

### 16.3 Results Behavior

Selecting an aircraft result:

- Flies the camera to the aircraft
- Selects it
- Opens the detail panel

Selecting an airport result:

- Flies to the airport
- Opens the airport context
- Shows surrounding observed traffic

If there is no match, say so plainly. Do not return unrelated filler results.

### 16.4 Identity Ambiguity

Callsigns and flight numbers can collide or be missing.

Results should show enough secondary identity (ICAO24, position, altitude) for the user to choose the correct aircraft.

---

## 17. Filters and Layers

Filters reduce the scene. Layers change what the scene is showing.

They must be available without permanently covering the map.

### 17.1 MVP Filters

- Altitude range
- Airborne / on ground
- Alert / emergency squawk
- Viewport-only is implicit

### 17.2 Later Filters

- Speed
- Vertical rate
- Aircraft type
- Airline
- Region
- Squawk
- Data freshness
- Origin / destination

### 17.3 Layers

Optional layers:

- Airports
- Trails
- Alert emphasis

Layer state should be obvious: the user should know which optional layers are active.

### 17.4 Filter Clarity

When filters are active, the UI must say so.

The user should be able to clear all filters in one action.

Filtered-out aircraft are hidden, not deleted. Global observed counts should remain honest about whether they represent the full observed set or the filtered set.

---

## 18. Alerts

Alerts surface unusual observed conditions.

They are detections, not confirmed events, emergencies, or official reports.

### 18.1 Role

Alerts answer:

> "What unusual states are currently being observed?"

They do not answer:

> "What accidents or incidents are happening?"

Copy must stay observational:

- `7700 OBSERVED`
- `RAPID DESCENT DETECTED`
- `SIGNAL LOST`

Not:

- `EMERGENCY!!!`
- `CRASH RISK`
- `MAYDAY IN PROGRESS`

### 18.2 Alerts Area

The Alerts area is a chronological feed of active and recent detected conditions.

Each item should show:

- Condition type
- Severity
- Aircraft identity
- Key telemetry at detection when available
- Time since observation
- Active vs resolved

Selecting an alert focuses the aircraft on the map.

### 18.3 Map Integration

Aircraft with active alerts remain visible in Explore with a distinct marker state.

A compact alert count belongs in the statistics bar.

New alerts may appear in a restrained notification. They must not flash, stack aggressively, or play alarming sounds by default.

### 18.4 Lifecycle

An alert is:

1. Detected
2. Active
3. Resolved
4. Retained briefly in history

The same condition on the same aircraft must not be re-announced on every data refresh.

Resolved alerts should not vanish so quickly that the user cannot inspect them.

### 18.5 User Control

Users should be able to:

- Open the alerts feed
- Filter by type or severity in later versions
- Jump to the aircraft
- Mute non-critical notifications

Critical observed squawks (7500 / 7600 / 7700) remain visible in the feed even if decorative notifications are muted.

---

## 19. Airports

Airports are geographic anchors for traffic, not a separate consumer travel product.

### 19.1 Airport Identity

An airport view should present:

- Name
- IATA / ICAO codes when available
- Location
- Nearby observed aircraft
- A way to focus arrivals/departures-like traffic in the vicinity

AETHERA should not claim airline schedules, gates, delays, or passenger information unless a dedicated source is later added.

### 19.2 Airport Traffic

"Airport traffic" means observed aircraft in a defined radius or approach volume — not official arrival/departure boards.

The product should label this as observed nearby traffic.

### 19.3 Map Presence

Airport markers appear at appropriate zoom levels.

They must remain secondary to aircraft.

Selecting an airport recenters the map and opens a compact airport panel, not a full-page brochure.

### 19.4 Scope

MVP may include airport search and a simple nearby-traffic focus.

A richer Airports area — congestion, patterns, persistent airport pages — comes after the live map is excellent.

---

## 20. Analytics

Analytics help the user see patterns, not spreadsheets.

### 20.1 Live Statistics

The statistics bar is the first analytics surface.

Example:

```text
12,482 OBSERVED
8,932 AIRBORNE
1,842 CLIMBING
1,327 DESCENDING
7 ALERTS
```

Numbers should update calmly. They must reflect observed data and current filters where relevant.

### 20.2 Analytics Area

A later Analytics area may include:

- Observed aircraft over time
- Altitude distribution
- Climb / descent balance
- Alert frequency
- Airport-area activity

Charts exist to reveal structure in the airspace. They are not a dashboard of vanity metrics.

## 21. History and Replay

History is part of the product vision. It is not required for the first live experience.

### 21.1 Purpose

Replay lets the user inspect what was observed in a past window:

- A region
- An aircraft
- An alert
- An airport area

### 21.2 Replay Principles

- Playback is of **stored observations**, not a cinematic reconstruction presented as truth.
- Interpolated frames during playback are estimates.
- Time is always visible.
- The user can pause, scrub, and exit to live.

### 21.3 Live vs History

The product must never mix live and replay without labeling the mode.

When in replay:

```text
REPLAY
2026-08-26 14:32:10 UTC
```

Returning to live should be a single clear action.

---

## 22. System Status and Data Freshness

Real-time data is only useful if the user knows how fresh it is.

### 22.1 Connection States

The product must distinguish:

| State | Meaning |
| ----- | ------- |
| LIVE | Receiving current observations |
| DELAYED | Updates are arriving later than expected |
| DEGRADED | Partial data or reduced fidelity |
| STALE | Displayed observations are old |
| OFFLINE | No live connection |

The UI must not show a live indicator when the session is stale or offline.

### 22.2 Per-Aircraft Freshness

Each aircraft has a last-seen time.

The detail panel shows last contact.

Aircraft that have not been updated within the live threshold become stale, then are removed after a grace period.

### 22.3 Failure Communication

If the upstream source is unavailable, keep the last known picture when possible and say that data is delayed or unavailable.

Explain:

- What happened
- Whether the system is reconnecting
- What the user can do, if anything

Example:

```text
LIVE DATA UNAVAILABLE

Attempting to reconnect to the airspace data service.

[ RETRY ]
```

---

## 23. Settings

Settings should be few and high-leverage.

MVP:

- Units: feet / meters, knots / km/h
- 2D / 3D default
- Reduced motion respect (system preference first)
- Restore last map position

Later:

- Notification preferences
- Density of labels
- Default region
- Watched aircraft
- Theme, only if a full light theme is designed

There is no account system required for MVP. Preferences may live locally.

---

## 24. Data Sources and Coverage

### 24.1 Initial Source

The initial observation source is the OpenSky Network, via AETHERA's own ingestion layer.

Users never talk to OpenSky directly. The product still depends on what that network can observe.

### 24.2 Coverage Honesty

AETHERA displays **observed** aircraft.

Coverage varies by region, altitude, receiver density, and source availability.

The product must not imply:

- Complete worldwide radar
- Military completeness
- Coverage of aircraft that are not broadcasting or not received
- Official ATC-quality surveillance

A short, durable disclaimer belongs in the product (About / status), not as a banner on every pixel.

### 24.3 Additional Sources

The product should be able to add providers later without changing the user-facing flight model.

New sources may improve coverage. They do not change the rule: show what is observed, label what is derived.

### 24.4 Metadata Enrichment

Airline, aircraft type, registration, route, and airport metadata may come from separate reference datasets.

Enrichment is metadata, not telemetry. If enrichment is missing, telemetry still works.

### 24.5 OpenSky credit budget

AETHERA's OpenSky account is **Standard: 4,000 `/states` credits per day**. That quota is for the whole product, not per visitor.

What it means in practice:

- A **global** live snapshot costs **4 credits**.
- The instance can take about **1,000 global snapshots per day**, so ingestion polls about every **90 seconds**, not every few seconds.
- A **small region** (≤ 25 square degrees) costs **1 credit** and can be refreshed about every **22 seconds**.
- `/tracks` and `/flights` have **separate** 4,000-credit buckets. Phase 1 does not spend them.
- When credits run out, OpenSky returns `429` until the daily refill. The map should keep the last observed state and show delayed/degraded status.

The product still feels live because aircraft **interpolate** between snapshots. The UI must not imply a continuous radar picture or second-by-second official surveillance.

Do not add features that multiply OpenSky calls (per-user polling, aggressive historical REST, unbounded track fetch) while this tier remains the source of truth.

---

## 25. Observed vs Derived Data

This is a product integrity rule.

| Category | Examples | Presentation |
| -------- | -------- | ------------ |
| Observed | Position, altitude, velocity, squawk, last seen | Stated as observed |
| Derived | Climbing/descending, alert flags | Stated as detected or calculated |
| Estimated | Interpolated position between updates | Used for motion; not a new fix |
| Metadata | Airline, type, airport names | Secondary; may be incomplete |
| Unavailable | Missing altitude, unknown callsign | Explicitly unknown |

Never promote an estimate or detection to a fact.

Especially:

- An emergency squawk is an observed transponder code, not a confirmed emergency.
- A rapid descent is a detected vertical-rate pattern, not a declaration of distress.
- A smooth trail segment may be interpolated.

---

## 26. Anomaly Catalog

Anomalies are deterministic detections on normalized flight state.

AI/ML is not required for the initial product.

### 26.1 MVP Detections

| Detection | Signal | Product language |
| --------- | ------ | ---------------- |
| Emergency squawk | Squawk 7700 | `7700 OBSERVED` |
| Hijack squawk | Squawk 7500 | `7500 OBSERVED` |
| Radio failure squawk | Squawk 7600 | `7600 OBSERVED` |
| Extreme sink rate | Vertical rate below a defined threshold | `RAPID DESCENT DETECTED` |
| Extreme climb rate | Vertical rate above a defined threshold | `RAPID CLIMB DETECTED` |
| Lost signal | No update beyond stale threshold while previously live | `SIGNAL LOST` |

### 26.2 Later Detections

- Sudden heading change
- Sudden altitude change
- Prolonged circling / holding-like patterns
- Airport-area congestion
- User-defined rules

### 26.3 Severity

| Severity | Use |
| -------- | --- |
| Critical | 7500 / 7600 / 7700 |
| High | Extreme sink/climb |
| Medium | Lost signal, sudden state change |
| Low | Informational detections |

Severity affects visual emphasis and ordering. It does not authorize sensational copy.

### 26.4 Thresholds

Numeric thresholds are product decisions and should be documented in implementation, tunable, and conservative.

False calm is better than false alarm. AETHERA should not feel like it is constantly shouting.

---

## 27. Information Architecture

### 27.1 Screen Hierarchy

```text
Header
  identity · search · live status

Map
  aircraft · trails · layers · selection

Context panel
  aircraft or airport detail

Statistics
  observed counts · alerts

Navigation
  Explore · Alerts · Airports · Analytics · History
```

On desktop, navigation can be compact and persistent.

On mobile, navigation sits at the edge of the screen so the map keeps as much area as possible.

### 27.2 Global vs Local

Always global:

- Search
- Live status
- Primary navigation

Local to selection:

- Detail panel
- Follow
- Trail toggle

Local to view:

- Filters
- Layers
- Replay controls when in History

### 27.3 Progressive Depth

```text
Airspace
  → Aircraft
    → Hover preview
      → Selected telemetry
        → Extended identity and transponder
          → Trail / follow / alert context
```

The user should be able to stop at any level.

---

## 28. Interaction Model

### 28.1 Pointer and Touch

- Hover preview on capable devices
- Click / tap to select
- Drag to pan
- Scroll / pinch to zoom
- Double-click / pinch-out to go closer, without fighting follow mode

### 28.2 Keyboard

Power users should be able to:

- Open search
- Close panels (`Esc`)
- Exit follow
- Toggle 2D / 3D
- Move between a small set of map controls

Keyboard operation does not need to match a GIS expert tool. It needs to make the core loop usable without a mouse.

### 28.3 Command Palette

Search may grow into a command palette.

Commands are shortcuts to existing product actions, not a hidden second application.

---

## 29. Platforms

AETHERA is a web application.

### 29.1 Desktop

Desktop wide screens are the primary experience.

The product should feel like a calm command surface:

- Large map
- Optional side panel
- Compact stats
- Precise typography

### 29.2 Mobile

Mobile must be usable, not merely scaled down.

Requirements:

- Map remains the dominant surface
- Aircraft details open as a bottom sheet
- Search remains reachable
- Follow and exit follow remain obvious
- Navigation is compact

Hover-dependent features need a tap equivalent.

### 29.3 Unsupported as MVP

- Native iOS / Android apps
- Embedded cockpit / operational ATC use
- Offline-first operation
- Multi-user accounts and teams

---

## 30. Accessibility

Accessibility is a product requirement, not a polish pass.

The product should support:

- Keyboard access to primary controls
- Visible focus
- Screen-reader labels on icon-only controls
- Contrast that remains readable on a dark map UI
- Reduced motion
- No information encoded by color alone

Alert state, live/stale state, and selection must remain understandable without color.

When reduced motion is requested:

- Decorative motion stops
- Camera moves simplify
- Aircraft interpolation may be reduced
- The map remains usable

---

## 31. Product Voice

The in-product voice is:

- Neutral
- Precise
- Confident
- Informative
- Concise

Prefer:

- `LIVE`
- `OBSERVED`
- `TRACKING`
- `STALE`
- `DEGRADED`

Avoid:

- Marketing hype inside the UI
- Exclamation marks
- Casual copy
- Sensational language around detections

AETHERA can be striking visually and still speak quietly.

---

## 32. Empty, Loading, and Error States

These states are part of the product, because live systems spend time in them.

### 32.1 Loading

First load may show a restrained map skeleton or dimmed globe while the first aircraft set arrives.

Do not block the entire UI behind a branded splash for long.

If aircraft are still loading, say `CONNECTING` or `LOADING AIRSPACE`, not a spinner with no words.

### 32.2 Empty

Empty should explain the cause:

- No aircraft in view — zoom out or clear filters
- No alerts — no detected conditions match
- No search results — no match for the query
- No historical data — replay is not available yet

No illustrative mascots. No fake aircraft.

### 32.3 Errors

Errors should be recoverable when possible.

Do not replace a populated map with a full-page failure if last-known aircraft can still be shown as delayed.

---

## 33. What AETHERA Is Not

AETHERA is not:

- An official ATC system
- A complete global surveillance network
- A consumer flight-booking or status product
- A copy of Flightradar24 or ADS-B aggregators with a darker theme
- A gaming / combat / drone-war interface
- A news ticker for aviation accidents
- A generic SaaS dashboard with a map widget
- A social network

The product should refuse features that pull it toward those identities.

---

## 34. MVP Scope

The MVP exists to prove the core experience:

> A beautiful, live, honest airspace that a user can explore, inspect, and follow.

### 34.1 In MVP

- Explore live map
- Smooth aircraft motion
- Hover preview and selection
- Aircraft detail panel
- Follow mode
- Search for callsign, ICAO24, and airports
- Basic filters (altitude, airborne/ground, alert)
- 2D / 3D toggle with graceful fallback
- Live / delayed / stale / offline status (cadence matches the ~90 s OpenSky poll, not a 5 s tick)
- Observed counts
- Emergency squawk detections (7500 / 7600 / 7700)
- At least one additional kinematic detection (rapid descent or lost signal)
- Selected-aircraft trail
- Responsive desktop and usable mobile layout
- No required account

### 34.2 Explicitly Out of MVP

- Full Analytics area
- Historical replay
- Multi-provider coverage
- User accounts, watchlists, and sharing
- Light theme
- Machine-learning detections
- Official schedules, delays, and passenger data
- Custom enterprise dashboards
- Public developer API

### 34.3 MVP Quality Bar

MVP is not a sparse prototype.

It should already feel:

- Fast
- Precise
- Atmospheric
- Trustworthy

A thin feature set with excellent motion, hierarchy, and honesty is a successful MVP. A wide feature set with jumpy aircraft and unclear data is not.

---

## 35. Phased Roadmap

Product phases follow capability, not infrastructure fashion.

### Phase 1 — Foundation

Live Explore, telemetry panel, search, follow, basic filters, live status, 2D/3D, selected trail, emergency squawks.

### Phase 2 — Intelligence

Richer anomaly catalog, airport traffic views, aircraft enrichment, advanced filters, stronger trails.

### Phase 3 — Presence

Live statistics quality, better regional defaults, notification control, data-density options.

### Phase 4 — Memory

Historical storage, replay, alert history, longer trails on demand.

### Phase 5 — Patterns

Analytics area, airport congestion, route-scale views, custom alert rules.

### Phase 6 — Platform

Additional data providers, saved views, optional accounts, professional APIs.

Each phase should deepen understanding of airspace, not merely add screens.

---

## 36. Success Criteria

AETHERA is succeeding when:

1. A new user understands it is live within a few seconds.
2. Aircraft motion feels physical rather than jumpy.
3. Selecting an aircraft makes telemetry obvious.
4. Search finds a callsign or airport quickly.
5. Follow mode is easy to enter and impossible to get stuck in.
6. Alerts feel useful and calm, not theatrical.
7. Dense traffic remains readable.
8. Stale or delayed data is never dressed up as live.
9. The interface looks premium without looking busy.
10. A visitor remembers the product as airspace intelligence, not as "another map."

Quantitative targets can be added once the live system exists. Until then, these qualitative bars are the release standard.

---

## 37. Constraints and Disclaimers

### 37.1 Safety

AETHERA is for visualization and exploration.

It must not be used as a source of control instructions, navigation, or emergency response.

A persistent but quiet disclaimer is required in About / legal copy.

### 37.2 Source Limits

Observation quality is bounded by the upstream network.

Gaps, jumps, missing callsigns, and regional holes are expected. The product should absorb them gracefully.

### 37.3 Privacy and Sensitivity

Aircraft identities in public ADS-B-style data can include sensitive operations.

The product should:

- Display what the configured public source provides
- Avoid extra doxxing-style enrichment
- Avoid sensational treatment of 7500 / 7600 / 7700
- Avoid features designed to pursue or expose operators

### 37.4 Performance Envelope

The product must remain usable with large observed fleets by rendering the viewport intelligently.

If everything is on fire visually, the product has failed even if the data is correct.

---

## 38. Units and Formatting

Telemetry formatting should be consistent and aviation-literate.

Defaults:

- Altitude: feet
- Speed: knots
- Vertical rate: feet per minute
- Heading: degrees
- Time: relative (`4 SEC AGO`) plus UTC where a timestamp is shown
- Coordinates: decimal degrees in detail, not on the map labels

Users may switch metric units in settings.

Numeric values should not jump visually in a distracting way. Tabular figures and stable alignment matter more than animated counters.

---

## 39. Open Questions

These decisions can wait until implementation, but they should not be ignored:

1. Which region is the best first-load default for a global audience?
2. How long should a lost aircraft remain on the map before removal?
3. Exact numerical thresholds for climb/descent detections
4. Whether origin/destination is shown in MVP if enrichment quality is low
5. Whether airport markers appear in MVP or only after airport search
6. How prominently the coverage disclaimer appears
7. Whether replay becomes a top-level area or a mode inside Explore
8. Whether saved camera position is worth storing before accounts exist

Until answered, choose the option that keeps the map clearer and the data more honest.

---

## 40. Glossary

| Term | Meaning in AETHERA |
| ---- | ------------------ |
| Observed | Present in the configured live data source |
| Derived | Calculated from observations (e.g. climbing) |
| Estimated | Interpolated between observations |
| Live | Fresh enough to treat as current |
| Stale | Last observation older than the live threshold |
| Alert / anomaly | A detected unusual state, not a confirmed incident |
| Squawk | Transponder code, when provided by the source |
| ICAO24 | 24-bit aircraft transponder address used as the primary technical identity |
| Callsign | Broadcast flight identity, often missing or messy |
| Trail | Recent path of an aircraft |
| Follow | Camera and context locked to one aircraft |
| Viewport | The geographic area currently shown |
| Enrichment | Reference metadata joined onto an observation |

---

## 41. Related Documents

This specification defines **what AETHERA is and what it must do**.

Companion documents:

| Document | Owns |
| -------- | ---- |
| `PRODUCT_SPEC.md` | Product intent, scope, features, honesty rules |
| `DESIGN_SYSTEM.md` | Visual language, interaction design, UI behavior |
| `ARCHITECTURE.md` | Systems, data flow, stack, runtime design |

If these documents conflict:

- Product honesty and scope win over feature ambition.
- Architecture may constrain delivery timing, not the meaning of "observed" vs "derived."
- Design may refine presentation, not invent capabilities the product spec excluded.

---

## 42. Final Product Statement

AETHERA should make live airspace feel intelligible.

The user opens the product and sees aircraft in motion. They can look, find, inspect, follow, and notice what is unusual — without being told that the system knows more than it does.

The map is the product.

The telemetry is the proof.

The alerts are observations.

The interface stays out of the way.

**AETHERA — Live Airspace Intelligence.**
