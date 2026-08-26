# AETHERA — Roadmap

**Product:** AETHERA  
**Tagline:** Live Airspace Intelligence  
**Document:** Roadmap  
**Version:** 0.1  
**Status:** Initial Delivery Plan  
**Last Updated:** 2026-08-26

---

## Purpose

This roadmap is the product delivery sequence for AETHERA.

It turns the product specification and architecture into four phases. Each phase ships a complete, usable slice of the experience rather than an incomplete layer of infrastructure.

The five application surfaces are delivered in this order:

```text
Explore  →  Alerts  →  Airports + Analytics  →  History
```

Technical work exists to support those surfaces. It is not a phase on its own.

AETHERA starts as a single-server, Docker-first system. Scale, additional providers, and machine learning arrive only when the core experience is already strong.

---

## Guiding Constraints

- The map and the aircraft are the product. Every phase must leave the visualization better, not busier.
- The browser never talks to OpenSky. Ingestion, Redis, and the API stay in front of every data source.
- Observed data, derived data, interpolated motion, and detected anomalies remain visually and verbally distinct.
- AI/ML is not required to ship intelligence. Early detection is deterministic.
- Kafka, Kubernetes, and a microservice explosion are out of scope until a later phase proves they are needed.
- Coverage is whatever the configured sources can observe. The product does not claim a complete worldwide picture.

---

## Phase Overview

| Phase | Name | Ships | Outcome |
| --- | --- | --- | --- |
| 1 | Foundation | Explore | Live airspace that feels fast, precise, and premium |
| 2 | Intelligence | Alerts | Unusual activity is detected, explained, and followable |
| 3 | Context | Airports, Analytics | Places and patterns, not only individual aircraft |
| 4 | Memory | History | The airspace can be replayed, stored, and extended |

```text
Phase 1 — Foundation
   Live pipeline, Explore map, aircraft inspection

Phase 2 — Intelligence
   Anomaly engine, Alerts, trails, enrichment

Phase 3 — Context
   Airport traffic, density, airspace statistics

Phase 4 — Memory
   Historical replay, durable tracks, platform growth
```

---

## Phase 1 — Foundation

**Focus:** Make the live airspace real.

This phase proves the architecture and ships **Explore**. A user should open AETHERA, immediately understand that the system is live, and start inspecting aircraft without reading documentation.

### Goals

- Stand up the backend-first pipeline: OpenSky → ingestion → Redis → API / realtime → web.
- Render observed aircraft smoothly on a premium Mapbox + Deck.gl map.
- Make telemetry, search, and filtering useful without covering the map.
- Establish the visual language: dark, precise, restrained, map-first.

### In scope

**Platform**

- Monorepo, pnpm, TypeScript, Docker Compose
- `ingestion`, `api`, `web`, PostgreSQL, Redis
- Environment configuration for OpenSky, Mapbox, and database credentials
- Shared types and validation packages
- Health checks and graceful degradation when OpenSky is unavailable

**Data**

- OpenSky polling and state-vector normalization
- Deduplication and validation
- Redis as the live aircraft store
- WebSocket flight updates
- Client-side interpolation so aircraft move between updates instead of jumping

**Explore**

- Live 2D airspace map as the primary surface
- Aircraft positions, heading, altitude, and velocity
- Hover telemetry and a selected-aircraft intelligence panel
- Search by callsign / ICAO24
- A small set of filters: altitude, airborne vs ground, region
- Live indicators, last-update timestamps, and observed-aircraft counts
- Basic 3D viewing: perspective, altitude, and camera follow

**UI**

- Application shell and navigation for later surfaces
- Design-system foundations: typography, color, density, motion
- Clear labeling of observed vs interpolated positions

### Explicitly out of scope

- Anomaly detection and the Alerts surface
- Airport-centric views
- Analytics dashboards
- Historical replay or durable flight tracks
- Multiple data providers
- Authentication, accounts, and saved searches
- Light theme
- Kubernetes, Kafka, or horizontally scaled API/WebSocket clusters

### Success looks like

- A new user understands within seconds that AETHERA is live.
- Observed aircraft move smoothly and remain selectable under typical OpenSky load.
- Selecting an aircraft reveals telemetry without turning the UI into a dashboard.
- Restarting services restores live state from Redis/ingestion without manual repair.
- The product already feels like a visualization platform, not a generic radar page.

---

## Phase 2 — Intelligence

**Focus:** Show what is happening, not only where aircraft are.

This phase ships **Alerts** and deepens Explore. Unusual states become first-class objects: detected, ranked, inspectable, and visible on the map.

### Goals

- Detect unusual telemetry with a deterministic anomaly engine.
- Give Alerts its own surface without stealing focus from the map.
- Add flight trails and richer aircraft context so inspection feels complete.
- Keep inferences visually distinct from observed facts.

### In scope

**Anomaly engine**

- Emergency and special squawks
- Extreme sink and climb rates
- Sudden heading or altitude changes
- Lost or stale signal
- Anomaly lifecycle: detected, active, resolved
- Persist events to PostgreSQL; keep active anomalies in Redis

**Alerts**

- Live alert list with severity, type, aircraft, and recency
- Jump from an alert to the aircraft on the map
- Map highlighting for active anomalies
- Filters by severity and type
- Honest copy: detections are derived, not confirmed incidents

**Explore depth**

- Flight trails for selected and recently observed aircraft
- Stronger aircraft intelligence panel: identity, telemetry, recent events
- Follow mode that tracks a selected aircraft in 2D and 3D
- Additional filters: squawk, vertical rate, aircraft type when metadata exists
- Three.js (or equivalent) used only where it improves aircraft presence, not as decoration

**Enrichment**

- Aircraft metadata where a reliable source exists
- Clear separation of registry/metadata from live ADS-B state

### Explicitly out of scope

- Machine-learning anomaly detection
- Predictive routing or intent estimation
- Airport traffic pages
- Density heatmaps and statistical analytics
- Full historical replay
- Custom alert rules for end users

### Success looks like

- Emergency squawks and extreme kinematics surface within seconds of observation.
- A user can go from alert → aircraft → trail → telemetry without losing the map.
- Trails and detections are labeled as derived.
- Explore still feels calm when many alerts are active; severity does the ranking.

---

## Phase 3 — Context

**Focus:** Make places and patterns as clear as individual aircraft.

This phase ships **Airports** and **Analytics**. AETHERA should answer questions about a region, an airport, and the shape of traffic—not only about a single ICAO24.

### Goals

- Turn airports into first-class destinations with surrounding traffic.
- Visualize airspace density and movement patterns from observed data.
- Add statistics that support the map instead of replacing it.
- Keep aggregation honest: charts describe what AETHERA observed, not the entire sky.

### In scope

**Airports**

- Airport search and directory backed by seeded airport data
- Focused map view around a selected airport
- Arrivals, departures, and nearby airborne traffic as observed
- Airport-centric counts, altitude bands, and recent events
- Congestion and activity cues based on observed density, not operational claims

**Analytics**

- Airspace statistics: observed counts, altitude distribution, speed bands
- Density visualization for the current viewport or selected region
- Time-of-day and regional pattern views from retained aggregates
- Traffic composition where metadata allows (airborne vs ground, type, operator)
- Export of summary figures for a selected window, clearly marked as observed

**Explore / Alerts integration**

- Density as an optional map layer, off by default
- Airport peek from the map without leaving Explore
- Anomaly rates as an analytics signal, not a separate product

### Explicitly out of scope

- Full flight-history replay
- Multi-provider ingestion
- Sectorization, FIR overlays, and professional ATC products
- Custom user dashboards and enterprise APIs
- Predictive models

### Success looks like

- Selecting an airport immediately shows what is happening around it right now.
- Density and charts help a user understand a region without hiding aircraft.
- Every statistic is attributable to an observation window and a data source.
- Airports and Analytics feel like lenses on the same live system, not separate apps.

---

## Phase 4 — Memory

**Focus:** Let the airspace be remembered, replayed, and grown.

This phase ships **History** and matures AETHERA from a live viewer into a durable intelligence platform. Scale and additional sources are introduced because the product now has something worth keeping.

### Goals

- Persist useful flight history and make it explorable.
- Replay a region and window with the same visual quality as live Explore.
- Support more than one data provider behind the existing ingestion interface.
- Scale the API and realtime layer when a single instance is no longer enough.
- Open a path to professional features without rewriting the core.

### In scope

**History**

- Durable flight records, selected track points, and anomaly history in PostgreSQL
- History surface: pick a time range and region, then replay
- Playback controls: play, pause, speed, scrub
- Continuity with Explore: same map language, same aircraft panel, same honesty about interpolation
- Retention policy that stores useful tracks and events, not every raw tick forever

**Platform**

- Provider interface with OpenSky as the first implementation
- Additional ADS-B or metadata providers behind the same normalize → store path
- Horizontal API and WebSocket instances with Redis Pub/Sub
- Load balancing, monitoring, and operational dashboards
- Authentication, saved views, and user preferences if the product needs them
- PostGIS or equivalent only if geographic history queries demand it

**Professional depth, as needed**

- Advanced alerts and notification channels
- Route and sector analysis built on stored history
- Documented API for programmatic access
- Custom dashboards for repeatable investigations

**Optional later in this phase**

- ML-assisted anomaly scoring on top of the deterministic engine
- Data-density modes (comfort / standard / dense)
- Light theme as a complete visual system, not an invert

### Explicitly out of scope until justified

- Claiming complete worldwide coverage
- Replacing the visualization product with a generic BI tool
- Introducing Kafka, NATS, or Kubernetes before measured load requires them
- Treating predictive models as facts in the UI

### Success looks like

- A user can replay yesterday’s airspace over a chosen airport or region.
- Live and historical views share one visual and data language.
- A second provider can be added without changing the browser.
- The system stays smooth as clients and retained history grow.
- AETHERA is recognizably the same product as Phase 1—only deeper.

---

## Dependencies Between Phases

```text
OpenSky + Redis + API + Map
            │
            ▼
     Phase 1  Explore
            │
            ├── anomaly events ──────────► Phase 2  Alerts
            │
            ├── airport seed + live traffic ► Phase 3  Airports
            │
            └── aggregates from live state ► Phase 3  Analytics
                        │
                        ▼
              persisted tracks + events
                        │
                        ▼
                 Phase 4  History
                        │
                        ▼
              providers, scale, professional APIs
```

Phase 2 may persist anomaly events early. Full track storage waits for Phase 4 unless a narrower persistence need appears sooner.

Phase 3 analytics should start from live and recently retained state. It must not block on a complete historical warehouse.

---

## What Does Not Move Between Phases

These remain true from the first release:

| Principle | Meaning |
| --- | --- |
| Visualization first | New features attach to the map; they do not replace it |
| Progressive disclosure | Airspace → aircraft → telemetry → detail |
| Real-time by default | Live state is obvious; stale state is labeled |
| Data transparency | Observed, derived, interpolated, and detected stay distinct |
| Performance is a feature | Smoothness beats additional chrome |
| Premium simplicity | Capability without clutter |

---

## Relationship to Other Documents

| Document | Role |
| --- | --- |
| [Product Specification](PRODUCT_SPEC.md) | What AETHERA is and which surfaces exist |
| [Design System](DESIGN_SYSTEM.md) | How those surfaces should look and behave |
| [Architecture](ARCHITECTURE.md) | How the system is built and how it can scale |

This roadmap is the delivery order. If architecture and product disagree on sequence, this document wins for planning; those documents win for behavior and structure.
