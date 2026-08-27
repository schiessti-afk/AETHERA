# Post-Roadmap Features

High-value, community-requested features that sit **beyond** the [Roadmap](ROADMAP.md) delivery sequence. They differentiate AETHERA from standard trackers (e.g. Flightradar24) and can be built at zero extra API cost.

Interpolation, anomaly squawks / extreme kinematics, aircraft metadata filters, and airport arrivals/departures are already in the Roadmap (Phases 1–3). They are not repeated here.

---

## 1. Advanced Spotter & Rarity Filtering Engine

Planespotters need more than type-when-metadata-exists (Roadmap Phase 2). This layer isolates rare airframes and paints traffic by category without hiding the rest of the sky.

* **Feasibility / Cost:** 100% Free (Open-source datasets + In-Memory Lookup).
* **Data Sources:** Open-source ICAO Aircraft Database (CSV/JSON dumps from OpenSky or public GitHub archives), layered on the Phase 2 metadata store.
* **Key Capabilities:**
  - **Rarity Index:** Flag specific ICAO typecodes (e.g., `MD11`, `B742`, `CONC`, `A388`, `AN12`, `IL76`).
  - **Color-Coded Multi-Filter:** Keep all traffic visible but render categories with distinct hues (e.g., Widebodies = Cyan, Turboprops = Amber, Military/Special = Purple, General Aviation = Dim Gray).
  - **Wildcard / Substring Search:** Query by regex or wildcard patterns over callsigns and registrations (e.g., `*834A`, `TAP*`, `N12*`).
* **Implementation Tasks:**
  - [x] Build a rarity index on top of existing `icao24` / `typecode` metadata.
  - [x] Add category color encoding as an optional Explore map style, off by default.
  - [x] Expose wildcard / regex predicates in the frontend filter state (beyond exact callsign / ICAO24 search).

---

## 2. Holding Pattern Detection

Automatically detects when an aircraft enters a holding pattern (racetrack orbit). Emergency squawks and extreme sink/climb are already Phase 2 anomalies; this is geometric track analysis those detections do not cover.

* **Feasibility / Cost:** 100% Free (Geometric & kinematic track analysis).
* **Detection Logic:**
  - Maintain a ring buffer of the last 15–30 positions per aircraft.
  - Calculate cumulative heading change. If heading rotation exceeds $360^\circ$ over 2–4 minutes within a bounded geographic radius (< 10 NM) at steady altitude, flag `IN_HOLDING_PATTERN`.
* **Implementation Tasks:**
  - [ ] Write a track analyzer utility calculating angular velocity ($\omega = \Delta \theta / \Delta t$) and bounding-box area of recent track points.
  - [ ] Surface holding stacks as a derived anomaly type (same honesty rules as Phase 2: labeled as detected, not confirmed ATC holds).

---

## 3. Live ATC Audio Stream Integration

Plays the local Tower, Approach, or Departure radio stream when a user clicks on an airport or an aircraft in terminal airspace. Not in the Roadmap (Phase 3 explicitly defers professional ATC products).

* **Feasibility / Cost:** Free (Public Icecast / LiveATC audio streams).
* **Technical Considerations:** Browser mixed-content restrictions (HTTPS client calling HTTP Icecast streams) and CORS policies.
* **Implementation Tasks:**
  - [ ] Create an airport-to-stream mapping table (`ICAO` $\to$ Stream URL).
  - [ ] Set up a lightweight streaming reverse proxy in the backend to bridge Icecast streams securely via HTTPS to the frontend.
  - [ ] Implement an embedded web audio player bar (Play/Pause, Volume, Signal Status indicator).
